import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SceneData, SceneStep } from './data';

const STEP_H = 46;
const NOTE_EXTRA = 14;
const TICK_MS = 1250;

type RenderedOp = {
  step: SceneStep;
  yPos: number;
};

type PacketAnim = {
  id: number;
  left: number;
  top: number;
  val: string;
  color: string;
  bg: string;
};

const trackColors: Record<string, { dot: string; label: string; accent: string; bg: string; border: string }> = {
  A: { dot: 'bg-peach-300', label: 'text-peach-300', accent: '#e8a33d', bg: 'rgba(232,163,61,.25)', border: 'border-peach-300/40' },
  B: { dot: 'bg-sand-300', label: 'text-sand-300', accent: '#c9a58e', bg: 'rgba(201,165,142,.25)', border: 'border-sand-300/40' },
};

const kindLabels: Record<string, string> = {
  read: 'READ ',
  write: 'WRITE ',
  commit: 'COMMIT ',
  abort: 'ROLLBACK ',
};

const kindColors: Record<string, string> = {
  read: 'border-blue-900/70',
  write: 'border-peach-300/50',
  commit: 'border-forest-700/70',
  abort: 'border-red-900/70',
  note: '',
  wait: 'border-dashed',
};

let packetId = 0;

export default function SceneCard({ scene }: { scene: SceneData }) {
  const [renderedOps, setRenderedOps] = useState<RenderedOp[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dbValue, setDbValue] = useState(scene.dbStart);
  const [dbFlashClass, setDbFlashClass] = useState('');
  const [showVerdict, setShowVerdict] = useState(false);
  const [packets, setPackets] = useState<PacketAnim[]>([]);
  const [seen, setSeen] = useState(false);

  const yPosA = useRef(34);
  const yPosB = useRef(34);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setPlaying(false);
    setCursor(0);
    setRenderedOps([]);
    yPosA.current = 34;
    yPosB.current = 34;
    setDbValue(scene.dbStart);
    setDbFlashClass('');
    setShowVerdict(false);
    setPackets([]);
  }, [scene.dbStart, clearTimer]);

  const step = useCallback(() => {
    setCursor((prev) => {
      if (prev >= scene.steps.length) return prev;
      const st = scene.steps[prev];
      const yPos = st.t === 'A' ? yPosA.current : yPosB.current;
      // increment y position for next op on this track
      const stepHeight = st.note ? STEP_H + NOTE_EXTRA : STEP_H;
      if (st.t === 'A') {
        yPosA.current += stepHeight;
      } else {
        yPosB.current += stepHeight;
      }

      // Update db value
      if (st.db !== undefined) {
        setDbValue(st.db);
      }
      if (st.flash) {
        setDbFlashClass(st.flash);
        if (st.flash === 'flash') {
          setTimeout(() => setDbFlashClass(''), 600);
        }
      }

      // Handle packet animation
      if (st.packet) {
        const pkt = st.packet;
        // Compute positions after state update — use refs for current positions
        requestAnimationFrame(() => {
          if (!stageRef.current || !dbRef.current) return;
          const stageRect = stageRef.current.getBoundingClientRect();
          const dbRect = dbRef.current.getBoundingClientRect();
          const dbX = dbRect.left - stageRect.left + dbRect.width / 2 - 15;
          const dbY = dbRect.top - stageRect.top + dbRect.height / 2 - 10;
          const trackSide = st.t === 'A'
            ? 'left'
            : 'right';
          const sideX = trackSide === 'left'
            ? (dbRect.left - stageRect.left - 70)
            : (dbRect.right - stageRect.left + 40);
          const goingToDB = pkt.to === 'db';
          const startX = goingToDB ? sideX : dbX;
          const endX = goingToDB ? dbX : sideX;
          const color = st.t === 'A' ? '#e8a33d' : '#c9a58e';
          const bg = st.t === 'A' ? 'rgba(232,163,61,.25)' : 'rgba(201,165,142,.25)';
          const id = ++packetId;
          // Start position
          const newPacket: PacketAnim = { id, left: startX, top: dbY, val: pkt.val, color, bg };
          setPackets((p) => [...p, newPacket]);
          // After a frame, animate to end position
          requestAnimationFrame(() => {
            setPackets((p) =>
              p.map((pk) => (pk.id === id ? { ...pk, left: endX } : pk))
            );
            // Fade out and remove
            setTimeout(() => {
              setPackets((p) =>
                p.map((pk) => (pk.id === id ? { ...pk, val: '' } : pk))
              );
              setTimeout(() => {
                setPackets((p) => p.filter((pk) => pk.id !== id));
              }, 400);
            }, 650);
          });
        });
      }

      const newOp: RenderedOp = { step: st, yPos };
      setRenderedOps((prevOps) => [...prevOps, newOp]);

      const newCursor = prev + 1;
      if (newCursor >= scene.steps.length) {
        setTimeout(() => setShowVerdict(true), 500);
      }
      return newCursor;
    });
  }, [scene.steps]);

  const play = useCallback(() => {
    if (playing) {
      clearTimer();
      setPlaying(false);
      return;
    }
    setPlaying(true);
  }, [playing, clearTimer]);

  // Tick effect for play
  useEffect(() => {
    if (!playing) return;
    if (cursor >= scene.steps.length) {
      setPlaying(false);
      return;
    }
    const tick = () => {
      step();
    };
    timerRef.current = setTimeout(tick, cursor === 0 ? 150 : TICK_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, cursor, scene.steps.length, step]);

  // IntersectionObserver for auto-play
  useEffect(() => {
    if (!cardRef.current || seen) return;
    const el = cardRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen) {
            setSeen(true);
            if (scene.id === 'dirty-read') {
              setPlaying(true);
            }
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scene.id, seen]);

  const handleStep = useCallback(() => {
    if (playing) {
      clearTimer();
      setPlaying(false);
    }
    if (cursor >= scene.steps.length) {
      reset();
    }
    // need to step after potential reset — use setTimeout to batch
    setTimeout(() => step(), 0);
  }, [playing, cursor, scene.steps.length, clearTimer, reset, step]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const progressPct = scene.steps.length > 0 ? (cursor / scene.steps.length) * 100 : 0;

  const renderOpContent = (op: RenderedOp) => {
    const st = op.step;
    const isNote = st.kind === 'note';
    const trackStyle = st.t === 'A' ? trackColors.A : trackColors.B;

    let cls = 'absolute w-[calc(100%-22px)] px-3 py-2 rounded-lg font-mono text-xs leading-tight border transition-all duration-350 ';
    cls += 'opacity-100 translate-y-0 scale-100 ';
    if (isNote) {
      cls += 'bg-transparent border-none text-blog-muted italic not-italic font-sans text-xs';
    } else {
      cls += `bg-forest-925/60 text-blog-muted ${kindColors[st.kind] || 'border-blog-border/15'}`;
    }
    if (st.t === 'A') cls += ' left-0';
    else cls += ' right-0';

    // compute top offset — our rendered yPos is the top of the op
    const top = op.yPos;

    return (
      <div
        key={`${st.t}-${op.yPos}`}
        className={cls}
        style={{ top: `${top}px` }}
      >
        {isNote ? (
          <span dangerouslySetInnerHTML={{ __html: st.text }} />
        ) : (
          <>
            <span className="text-[0.6rem] tracking-wider uppercase opacity-70 block leading-none mb-0.5"
              style={st.kind === 'read' ? { color: '#6fa8e0' } : st.kind === 'write' ? { color: '#e8a33d' } : st.kind === 'commit' ? { color: '#4cc4a0' } : st.kind === 'abort' ? { color: '#e8654f' } : {}}
            >
              {kindLabels[st.kind] || ''}
            </span>
            <span dangerouslySetInnerHTML={{ __html: st.text }} />
            {st.note && (
              <div className="text-blog-muted/60 text-[0.66rem] italic mt-0.5 font-sans not-italic" style={{ fontFamily: 'inherit' }}>
                {st.note}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div ref={cardRef} className="rounded-xl border border-blog-border/10 bg-blog-surface p-6 mt-8 relative overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <h3 className="text-xl font-semibold text-blog-text m-0">{scene.title}</h3>
          <div className="font-mono text-xs text-blog-muted/60 mt-0.5">// {scene.aka}</div>
        </div>
        {scene.tagText && (
          <span className="font-mono text-[0.66rem] tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap border border-current"
            style={scene.tag === 't-bug' ? { color: '#e8654f' } : { color: '#4cc4a0' }}
          >
            {scene.tagText}
          </span>
        )}
      </div>
      <p className="text-blog-muted/80 mt-3.5 max-w-[62ch] leading-relaxed">{scene.desc}</p>

      {/* Stage */}
      <div ref={stageRef} className="mt-6 bg-[#0c0c0b] border border-blog-border/15 rounded-xl p-5 pb-4 relative">
        {/* Tracks grid */}
        <div className="grid grid-cols-[1fr_80px_1fr] gap-0 items-stretch">
          {/* Track A */}
          <div className="relative" style={{ minHeight: '248px' }}>
            <div className="font-mono text-xs tracking-wider mb-3.5 flex items-center gap-2" style={{ color: trackColors.A.accent }}>
              <span className="w-2 h-2 rounded-full" style={{ background: trackColors.A.accent }}></span>
              Transaction A
            </div>
            {/* Timeline line */}
            <div className="absolute top-[34px] bottom-1.5 w-0.5 bg-forest-800/40" style={{ right: '8px' }}></div>
            {/* Rendered operations */}
            {renderedOps.filter((op) => op.step.t === 'A').map(renderOpContent)}
          </div>

          {/* Center — DB */}
          <div className="relative flex flex-col items-center">
            <div
              ref={dbRef}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[70px] px-3 py-2 h-14 border-2 rounded-lg flex flex-col items-center justify-center bg-forest-925/60 transition-all duration-400
                ${dbFlashClass === 'flash' ? 'border-peach-300/70 shadow-[0_0_0_4px_rgba(232,163,61,0.14)]' : ''}
                ${dbFlashClass === 'bad' ? 'border-red-500/70 shadow-[0_0_0_4px_rgba(232,101,79,0.16)]' : ''}
                ${dbFlashClass === 'good' ? 'border-green-500/70 shadow-[0_0_0_4px_rgba(76,196,160,0.16)]' : ''}
                ${!dbFlashClass ? 'border-forest-800/40' : ''}
              `}
            >
              <span className="font-mono text-sm font-semibold text-blog-text">{dbValue}</span>
              <span className="font-mono text-[0.54rem] text-blog-muted/60 tracking-wider">{scene.dbLabel}</span>
            </div>
          </div>

          {/* Track B */}
          <div className="relative" style={{ minHeight: '248px' }}>
            <div className="font-mono text-xs tracking-wider mb-3.5 flex items-center gap-2" style={{ color: trackColors.B.accent }}>
              <span className="w-2 h-2 rounded-full" style={{ background: trackColors.B.accent }}></span>
              Transaction B
            </div>
            {/* Timeline line */}
            <div className="absolute top-[34px] bottom-1.5 w-0.5 bg-forest-800/40" style={{ left: '8px' }}></div>
            {/* Rendered operations */}
            {renderedOps.filter((op) => op.step.t === 'B').map(renderOpContent)}
          </div>
        </div>

        {/* Packet animations */}
        {packets.map((p) => (
          <div
            key={p.id}
            className="absolute top-1/2 w-[30px] h-5 rounded flex items-center justify-center font-mono text-[0.62rem] font-semibold z-10 pointer-events-none"
            style={{
              left: `${p.left}px`,
              top: `${p.top}px`,
              opacity: p.val ? 1 : 0,
              transition: p.val ? 'left 0.55s cubic-bezier(0.5,0,0.3,1), opacity 0.55s' : 'opacity 0.4s',
              background: p.bg,
              border: `1px solid ${p.color}`,
              color: p.color,
            }}
          >
            {p.val}
          </div>
        ))}

        {/* Verdict */}
        {showVerdict && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm flex gap-3 items-start animate-fadeIn
              ${scene.verdict.type === 'bad' ? 'bg-red-900/10 border border-red-500/40 text-red-200' : 'bg-green-900/10 border border-green-500/40 text-green-200'}
            `}
          >
            <span className="font-mono font-semibold flex-none">{scene.verdict.icon}</span>
            <span>{scene.verdict.text}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3.5 mt-4 flex-wrap">
        <button
          onClick={playing ? () => { clearTimer(); setPlaying(false); } : play}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-925/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200 flex items-center gap-2"
          style={playing ? { borderColor: '#f3c6ad', color: '#f3c6ad' } : {}}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button
          onClick={handleStep}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-925/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200"
        >
          Step ›
        </button>
        <button
          onClick={handleReset}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-925/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200"
        >
          ↺ Reset
        </button>
        <div className="flex-1 min-w-[120px] h-1 bg-forest-800/40 rounded-full overflow-hidden">
          <span
            className="block h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #f3c6ad, #c9a58e)',
            }}
          ></span>
        </div>
        <div className="font-mono text-xs text-blog-muted/60 whitespace-nowrap">
          {cursor} / {scene.steps.length}
        </div>
      </div>
    </div>
  );
}
