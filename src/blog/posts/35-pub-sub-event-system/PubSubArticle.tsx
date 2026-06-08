import React, { useState, useRef, useCallback, useEffect } from 'react';
import DecisionCard from '../../components/DecisionCard';
import TipCard from '../../components/TipCard';
import MiniDiagram from '../../components/MiniDiagram';
import ChecklistItem from '../../components/ChecklistItem';

/* ─────────────────────────────────────────────
   Shared colour tokens for the event-theme
   (these aren't in the Tailwind config so we
    keep them in one place as inline-style maps)
───────────────────────────────────────────── */
const colors = {
  green: '#3ddc84',
  greenDeep: '#1c9d5a',
  cyan: '#34d6e8',
  cyanDeep: '#1893a5',
  amber: '#f5b73d',
  amberDeep: '#b9821a',
  violet: '#9d8cf0',
  violetDeep: '#6f5fc4',
  red: '#ef5f5f',
  fog: '#8aa6b0',
  fogDim: '#5a727c',
  ink: '#dcebf0',
  white: '#f2fafc',
  panel: '#0e171c',
  line: '#1c2f37',
  lineBright: '#2a4651',
};

/* ─────────────────────────────────────────────
   Pipeline animation — SVG + controls
───────────────────────────────────────────── */
const STEP_NARRATIVES = [
  {
    title: '1 · Producer emits a fact',
    body: 'A domain action completes and the service produces an immutable, past-tense event. It names no consumer.',
    why: 'why emitting a fact, not calling a consumer, is what lets subscribers be added or removed without ever touching this code.',
    activeEl: 'n-app',
    highlightLine: null as string | null,
    packetPos: { x: 170, y: 147 },
  },
  {
    title: '2 · Cross the async boundary',
    body: 'The event is written to an outbox row or queue — ideally in the same DB transaction as the state change — and the request returns.',
    why: 'why this is not just speed. Committing the event atomically with the data is how you avoid the dual-write problem (Decision 2).',
    activeEl: 'n-proc',
    highlightLine: 'l1',
    packetPos: { x: 170, y: 242 },
  },
  {
    title: '3 · Publisher client publishes',
    body: 'A relay or worker reads the outbox and calls <code>publish()</code> on the broker SDK. App code never touches the wire protocol.',
    why: 'why the relay may publish twice if it crashes after publish but before marking the row sent — so delivery is at-least-once by design.',
    activeEl: 'n-es',
    highlightLine: 'l2',
    packetPos: { x: 170, y: 330 },
  },
  {
    title: '4 · The event lands on the broker',
    body: 'Now a message on a topic. Whether it is retained (log) or removed on ack (queue) is the deeper architectural choice.',
    why: 'why log vs. queue (Decision 3) decides replay, fan-out, and whether a future consumer can ever see this event.',
    activeEl: 'n-broker',
    highlightLine: 'l3',
    packetPos: { x: 490, y: 179 },
  },
  {
    title: '5 · Routing config names destinations',
    body: 'A subscriber registry, kept as version-controlled IaC, declares who subscribes and how partitioning / ordering is keyed.',
    why: 'why partitioning by aggregate id here (Decision 5) is what buys per-entity ordering without serializing the whole stream.',
    activeEl: 'n-cfg',
    highlightLine: null,
    packetPos: { x: 490, y: 295 },
  },
  {
    title: '6 · Delivered to the consumer',
    body: 'Push: the broker POSTs to a registered URL. Pull: a worker fetches at its own pace and tracks an offset.',
    why: 'why push vs. pull (Decision 4) decides who controls the rate — and therefore who absorbs a burst without falling over.',
    activeEl: 'n-endpoint',
    highlightLine: 'l4',
    packetPos: { x: 810, y: 177 },
  },
  {
    title: '7 · Verify sender, then decode',
    body: 'A push endpoint authenticates the caller before anything else, then deserializes — validating against the registered schema.',
    why: 'why schema validation here (Decision 7) is where a backward-incompatible producer change gets caught instead of corrupting state.',
    activeEl: 'n-auth',
    highlightLine: 'l5',
    packetPos: { x: 810, y: 272 },
  },
  {
    title: '8 · Idempotent handler runs',
    body: 'The handler keys on the event id, no-ops if seen before, does the work, and acks. Non-2xx (push) or no-commit (pull) triggers redelivery.',
    why: 'why idempotency (Decision 6) is what makes at-least-once safe — redelivery, DLQ replay, and offset rewinds all stop being dangerous.',
    activeEl: 'n-router',
    highlightLine: 'l6',
    packetPos: { x: 810, y: 357 },
  },
];

function PipelineAnimation() {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [doneEls, setDoneEls] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const current = cursor < STEP_NARRATIVES.length ? STEP_NARRATIVES[cursor] : null;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetAnim = useCallback(() => {
    clearTimer();
    setPlaying(false);
    setCursor(0);
    setDoneEls(new Set());
  }, [clearTimer]);

  const advance = useCallback(() => {
    setCursor((prev) => {
      if (prev >= STEP_NARRATIVES.length) return prev;
      // mark the previous element as done
      if (prev > 0) {
        const prevStep = STEP_NARRATIVES[prev - 1];
        setDoneEls((d) => new Set(d).add(prevStep.activeEl));
      }
      return prev + 1;
    });
  }, []);

  const stepOnce = useCallback(() => {
    if (cursor >= STEP_NARRATIVES.length) {
      resetAnim();
      // need to wait for reset to flush, then advance
      setTimeout(advance, 50);
    } else {
      advance();
    }
  }, [cursor, advance, resetAnim]);

  const stepBack = useCallback(() => {
    if (playing) {
      clearTimer();
      setPlaying(false);
    }
    setCursor((prev) => {
      if (prev <= 0) return prev;
      const newCursor = prev - 1;
      // undo the "mark done" that happened when we advanced INTO `prev`
      if (newCursor > 0) {
        const stepToUnmark = STEP_NARRATIVES[newCursor - 1];
        setDoneEls((d) => {
          const next = new Set(d);
          next.delete(stepToUnmark.activeEl);
          return next;
        });
      } else {
        setDoneEls(new Set());
      }
      return newCursor;
    });
  }, [playing, clearTimer]);

  const togglePlay = useCallback(() => {
    if (playing) {
      clearTimer();
      setPlaying(false);
      return;
    }
    if (cursor >= STEP_NARRATIVES.length) {
      resetAnim();
      // slight delay to let reset flush
      setTimeout(() => setPlaying(true), 100);
    } else {
      setPlaying(true);
    }
  }, [playing, cursor, resetAnim, clearTimer]);

  // Tick loop
  useEffect(() => {
    if (!playing) return;
    if (cursor >= STEP_NARRATIVES.length) {
      setPlaying(false);
      return;
    }
    const tick = () => {
      advance();
    };
    timerRef.current = setTimeout(tick, cursor === 0 ? 150 : speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, cursor, speed, advance]);

  const isActive = (id: string) => current?.activeEl === id;
  const isDone = (id: string) => doneEls.has(id);
  const isLit = (lineId: string) => current?.highlightLine === lineId && cursor < STEP_NARRATIVES.length && cursor > 0;

  const stepNum = cursor < STEP_NARRATIVES.length ? cursor + 1 : 8;
  const allDone = cursor >= STEP_NARRATIVES.length;

  return (
    <div className="mt-10">
      {/* Stage board */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#0e171c] to-[#0b1216] border border-[#2a4651] rounded-xl p-5 md:p-7">
        <div className="absolute top-3 right-4 font-mono text-[0.6rem] tracking-[0.18em] uppercase" style={{ color: colors.fogDim }}>
          // event flow monitor
        </div>

        <svg ref={svgRef} viewBox="0 0 980 440" className="w-full h-auto overflow-visible" aria-label="Animated event pipeline">
          {/* Producer zone */}
          <rect x={20} y={60} width={300} height={230} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={34} y={80} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>PRODUCER SERVICE</text>

          {/* Broker zone */}
          <rect x={392} y={120} width={196} height={110} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={406} y={140} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>MESSAGE BROKER</text>

          {/* Subscriber zone */}
          <rect x={660} y={60} width={300} height={320} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={674} y={80} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>SUBSCRIBER SERVICE</text>

          {/* Flow lines */}
          <path d="M 170 175 L 170 215" fill="none" stroke={isLit('l1') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l1') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />
          <path d="M 170 270 L 170 305" fill="none" stroke={isLit('l2') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l2') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />
          <path d="M 250 330 L 460 330 L 460 232" fill="none" stroke={isLit('l3') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l3') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />
          <path d="M 490 175 L 490 120 L 810 120 L 810 150" fill="none" stroke={isLit('l4') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l4') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />
          <path d="M 810 205 L 810 245" fill="none" stroke={isLit('l5') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l5') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />
          <path d="M 810 300 L 810 335" fill="none" stroke={isLit('l6') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('l6') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.6))' : 'none', transition: 'stroke 0.4s' }} />

          {/* Node: Producer */}
          <g>
            <rect x={60} y={120} width={220} height={55} rx={10} fill={colors.panel}
              stroke={isDone('n-app') ? colors.cyanDeep : isActive('n-app') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-app') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={80} y={145} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Producer</text>
            <text x={80} y={162} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>domain event occurred</text>
          </g>

          {/* Node: Async dispatch */}
          <g>
            <rect x={60} y={215} width={220} height={55} rx={10} fill={colors.panel}
              stroke={isDone('n-proc') ? colors.cyanDeep : isActive('n-proc') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-proc') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={80} y={240} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Async dispatch</text>
            <text x={80} y={257} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>outbox / queue · non-blocking</text>
          </g>

          {/* Node: Publisher client */}
          <g>
            <rect x={60} y={305} width={220} height={50} rx={10} fill={colors.panel}
              stroke={isDone('n-es') ? colors.cyanDeep : isActive('n-es') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-es') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={80} y={328} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Publisher client</text>
            <text x={80} y={344} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>broker SDK · publish()</text>
          </g>

          {/* Node: Broker */}
          <g>
            <rect x={410} y={150} width={160} height={58} rx={10} fill={colors.panel}
              stroke={isDone('n-broker') ? colors.cyanDeep : isActive('n-broker') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-broker') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={430} y={175} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Broker</text>
            <text x={430} y={193} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>topic · log or queue</text>
          </g>

          {/* Node: Routing config */}
          <g>
            <rect x={392} y={270} width={196} height={50} rx={10} fill={colors.panel}
              stroke={isDone('n-cfg') ? colors.cyanDeep : isActive('n-cfg') ? colors.amber : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-cfg') ? 'drop-shadow(0 0 10px rgba(245,183,61,0.5))' : 'none' }} />
            <text x={412} y={293} fill={isActive('n-cfg') ? colors.amber : colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Routing config</text>
            <text x={412} y={309} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>subscriptions · IaC</text>
          </g>
          <path d="M 490 270 L 490 232" fill="none" stroke={colors.amberDeep} strokeWidth={1} strokeDasharray="4 4" />

          {/* Node: Consumer */}
          <g>
            <rect x={700} y={150} width={220} height={55} rx={10} fill={colors.panel}
              stroke={isDone('n-endpoint') ? colors.cyanDeep : isActive('n-endpoint') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-endpoint') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={720} y={175} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Consumer</text>
            <text x={720} y={192} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>push endpoint or pull loop</text>
          </g>

          {/* Node: Verify + decode */}
          <g>
            <rect x={700} y={245} width={220} height={55} rx={10} fill={colors.panel}
              stroke={isDone('n-auth') ? colors.cyanDeep : isActive('n-auth') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-auth') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={720} y={270} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Verify + decode</text>
            <text x={720} y={287} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>authenticate · deserialize</text>
          </g>

          {/* Node: Handler */}
          <g>
            <rect x={700} y={335} width={220} height={45} rx={10} fill={colors.panel}
              stroke={isDone('n-router') ? colors.cyanDeep : isActive('n-router') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('n-router') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={720} y={362} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Handler · idempotent</text>
          </g>

          {/* Packet dot */}
          {current && cursor < STEP_NARRATIVES.length ? (
            <g>
              <circle cx={current.packetPos.x} cy={current.packetPos.y} r={11} fill="none" stroke={colors.cyan} strokeWidth={1.5} opacity={0.7}
                style={{ transition: 'cx 0.55s cubic-bezier(.45,0,.25,1), cy 0.55s cubic-bezier(.45,0,.25,1)' }} />
              <circle cx={current.packetPos.x} cy={current.packetPos.y} r={5} fill={colors.green}
                style={{ filter: 'drop-shadow(0 0 8px rgba(61,220,132,0.9))', transition: 'cx 0.55s cubic-bezier(.45,0,.25,1), cy 0.55s cubic-bezier(.45,0,.25,1)' }} />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Narrator panel */}
      <div className="mt-4 min-h-[100px] bg-[#070b0d] border border-[#1c2f37] rounded-xl p-4 md:p-5 flex gap-4 items-start">
        <span
          className="font-mono text-xs font-bold shrink-0 rounded-lg px-2.5 py-1.5 leading-none"
          style={{
            background: allDone ? '#f3c6ad' : colors.lineBright,
            color: allDone ? '#070b0d' : colors.fog,
          }}
        >
          {allDone ? '✓' : stepNum}
        </span>
        <div>
          <h4 className="text-lg font-semibold text-[#f2fafc] mb-1">
            {allDone ? 'Full round-trip complete' : (current?.title ?? 'Ready when you are')}
          </h4>
          {allDone ? (
            <p style={{ color: colors.fog }} className="text-base leading-relaxed">
              The event travelled from producer through broker to consumer, passing every stage.
              Each of the eight steps below is a decision you make about this path.
            </p>
          ) : current ? (
            <>
              <p className="text-base leading-relaxed" style={{ color: colors.fog }} dangerouslySetInnerHTML={{ __html: current.body }} />
              <div className="mt-2 text-sm leading-relaxed border-l-2 border-peach-300/40 pl-3 text-blog-muted/60">
                <b className="font-mono text-[0.7rem] tracking-[0.08em] uppercase text-peach-300">why</b>
                {' '}{current.why}
              </div>
            </>
          ) : (
            <p className="text-base leading-relaxed" style={{ color: colors.fog }}>
              Hit <b>Play</b> to watch one event travel the full round-trip. Each step pairs what happens with the <b>why</b> a staff engineer would give.
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3.5 mt-4 flex-wrap">
        <button
          onClick={togglePlay}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-950/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200 flex items-center gap-2"
          style={playing ? { borderColor: '#f3c6ad', color: '#f3c6ad' } : undefined}
        >
          {playing ? '❚❚ Pause' : cursor >= STEP_NARRATIVES.length ? '↺ Replay' : '▶ Play the journey'}
        </button>
        <button
          onClick={stepBack}
          disabled={cursor === 0}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-950/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-blog-border/15 disabled:hover:bg-forest-950/60"
        >
          ‹ Back
        </button>
        <button
          onClick={stepOnce}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-950/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200"
        >
          Step ›
        </button>
        <button
          onClick={resetAnim}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-950/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200"
        >
          ↺ Reset
        </button>
        <div className="flex-1 min-w-[120px] h-1 bg-forest-800/40 rounded-full overflow-hidden">
          <span
            className="block h-full rounded-full transition-all duration-300"
            style={{
              width: `${(Math.min(cursor, STEP_NARRATIVES.length) / STEP_NARRATIVES.length) * 100}%`,
              background: 'linear-gradient(90deg, #f3c6ad, #c9a58e)',
            }}
          />
        </div>
        <div className="font-mono text-xs text-blog-muted/60 whitespace-nowrap">
          {Math.min(cursor, STEP_NARRATIVES.length)} / {STEP_NARRATIVES.length}
        </div>
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-1.5 mt-3 font-mono text-[0.7rem] text-blog-muted/60">
        speed
        {[1900, 1200, 650].map((sp) => (
          <button
            key={sp}
            onClick={() => setSpeed(sp)}
            className={`px-2 py-1 rounded-md border text-[0.65rem] transition-all duration-200 ${
              speed === sp
                ? 'border-peach-300 text-peach-300'
                : 'border-blog-border/15 text-blog-muted/60 hover:border-peach-300/50'
            }`}
          >
            {sp === 1900 ? '0.5×' : sp === 1200 ? '1×' : '2×'}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function PubSubArticle() {
  return (
    <div className="blog-content max-w-none">
      {/* ───── HERO ───── */}
      <section id="flow">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">
          Events · Staff-Level Map
        </div>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          The happy path is easy: emit a fact, a broker delivers it, a handler runs. The <strong className="text-blog-text font-medium">staff-level</strong> work is everything that path hides — delivery semantics, ordering, the log-vs-queue choice, failure modes, and how a contract evolves when producer and consumer ship independently. Below: the round-trip animated, then each hard decision framed with what it actually costs.
        </p>

        <PipelineAnimation />
      </section>

      {/* ───── 1. DELIVERY SEMANTICS ───── */}
      <section id="delivery" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 1</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Delivery semantics</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          The first thing a staff interview probes. The trap is the phrase &ldquo;exactly-once&rdquo; — say it without qualification and you have failed the question.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="What guarantee do you promise, and where?"
          frame="Separate <em>delivery</em> from <em>processing</em>. Exactly-once <b>delivery</b> over a network is effectively impossible — the ack can be lost after the work is done, so the broker cannot know if you got it and must choose to risk a drop or a dupe. Exactly-once <b>processing</b> is achievable: accept at-least-once delivery, then make the effect idempotent so duplicates are harmless."
          options={[
            { name: 'At-most-once', color: colors.red, pro: 'Simplest. No retries, no dedup.', con: 'Drops on failure. Data loss is allowed.', use: 'Metrics, fire-and-forget telemetry where a gap is fine.' },
            { name: 'At-least-once', color: colors.green, pro: 'No loss. The pragmatic default for almost everything.', con: 'Duplicates happen. Pushes idempotency onto you.', use: 'The 90% answer — paired with idempotent handlers.' },
            { name: 'Effectively-once', color: colors.amber, pro: 'No loss, no visible dupes — the real goal.', con: 'You build it: dedup store or transactional consumer.', use: 'Money, inventory — anything where a dupe is a bug.' },
          ]}
          verdict='&ldquo;At-least-once delivery, exactly-once processing via idempotency.&rdquo; Then explain how: a dedup key on the event id with a TTL window, or fold the side effect into the same transaction that records the id. Never claim the broker gives you exactly-once for free.'
        />
      </section>

      {/* ───── 2. DUAL-WRITE TRAP ───── */}
      <section id="dualwrite" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 2</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">The dual-write trap</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          The single most common correctness bug in event systems, and a favourite follow-up. It is the reason that <code className="text-green-400">async dispatch</code> in the animation is not just a &ldquo;go faster&rdquo; optimisation.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="How do you write your DB and publish atomically?"
          frame="You cannot write to two systems in one atomic step. If you save the order to your database <em>and then</em> publish to the broker, a crash in between leaves them inconsistent: the order exists but no one was told, or — if you publish first — everyone reacts to an order that was never saved. This is the dual-write problem."
          options={[
            { name: 'Naive dual write', color: colors.red, pro: 'Trivial to write. Works in the demo.', con: 'Loses or phantoms events on any crash between the two writes.', use: 'Never, for anything that matters.' },
            { name: 'Transactional outbox', color: colors.green, pro: 'Event row written in the same DB txn as the data. A relay publishes it after commit. Atomic by construction.', con: 'Extra table + relay process. At-least-once (relay may double-publish).', use: 'The standard answer. Pairs with idempotent consumers.' },
            { name: 'Log-based CDC', color: colors.cyan, pro: 'Tail the DB change log; events derive from commits. No app-level publish at all.', con: 'Couples event shape to table shape unless you transform. Infra-heavy.', use: 'High-volume, or when you cannot change the producing app.' },
          ]}
          verdict='&ldquo;I do not dual-write. I use a transactional outbox so the event is committed atomically with the state change, then relayed — accepting at-least-once and making consumers idempotent.&rdquo; Naming this unprompted is a strong signal.'
        />
      </section>

      {/* ───── 3. LOG VS QUEUE ───── */}
      <section id="model" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 3</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Log vs. queue — the deeper fork</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          More fundamental than push vs. pull. It decides whether you can replay history, how fan-out works, and what &ldquo;consumed&rdquo; even means.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <MiniDiagram title="Queue model" subtitle="consumed = gone" caption="One logical consumer drains the queue; competing workers share the load. No replay — once acked, it is gone. Fan-out needs a copy per consumer.">
            <svg viewBox="0 0 320 120" className="w-full h-[120px]" aria-label="Queue: messages removed once consumed">
              <rect x={20} y={44} width={180} height={32} rx={6} fill={colors.panel} stroke={colors.lineBright} />
              <circle cx={50} cy={60} r={7} fill={colors.violet} />
              <circle cx={80} cy={60} r={7} fill={colors.violet} />
              <circle cx={110} cy={60} r={7} fill={colors.violet} opacity={0.5} />
              <line x1={200} y1={60} x2={250} y2={60} stroke={colors.lineBright} strokeWidth={2} />
              <defs>
                <marker id="qArrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M2 1L8 5L2 9" fill="none" stroke={colors.lineBright} strokeWidth={1.5} />
                </marker>
              </defs>
              <rect x={252} y={44} width={48} height={32} rx={6} fill={colors.panel} stroke={colors.greenDeep} />
              <text x={276} y={64} fill={colors.green} fontFamily="Chivo Mono, monospace" fontSize={9} textAnchor="middle">worker</text>
              <text x={110} y={105} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={8.5} textAnchor="middle">message leaves the queue on ack</text>
            </svg>
          </MiniDiagram>

          <MiniDiagram title="Log model" subtitle="retained · offset-tracked" caption="Events are retained for a window. Each consumer group tracks its own offset, so many read the same log independently — and you can rewind to reprocess.">
            <svg viewBox="0 0 320 120" className="w-full h-[120px]" aria-label="Log: messages retained, consumers track offsets">
              <rect x={20} y={44} width={200} height={32} rx={6} fill={colors.panel} stroke={colors.lineBright} />
              <circle cx={44} cy={60} r={6} fill={colors.cyan} />
              <circle cx={68} cy={60} r={6} fill={colors.cyan} />
              <circle cx={92} cy={60} r={6} fill={colors.cyan} />
              <circle cx={116} cy={60} r={6} fill={colors.cyan} />
              <circle cx={140} cy={60} r={6} fill={colors.cyan} />
              <line x1={92} y1={30} x2={92} y2={42} stroke={colors.green} strokeWidth={2} />
              <text x={92} y={24} fill={colors.green} fontFamily="Chivo Mono, monospace" fontSize={8} textAnchor="middle">A</text>
              <line x1={140} y1={30} x2={140} y2={42} stroke={colors.amber} strokeWidth={2} />
              <text x={140} y={24} fill={colors.amber} fontFamily="Chivo Mono, monospace" fontSize={8} textAnchor="middle">B</text>
              <text x={120} y={105} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={8.5} textAnchor="middle">consumers A &amp; B read at their own offset</text>
            </svg>
          </MiniDiagram>
        </div>

        <DecisionCard
          eyebrow="the decision"
          title="Do you need to replay and re-derive, or just process and discard?"
          frame="This is the question that picks the model. If a new consumer must be backfilled from history, if you will rebuild read models from the event stream, or if reprocessing after a bug fix matters — you need a retained log. If events are transient commands that are done once handled, a queue is simpler and cheaper."
          options={[
            { name: 'Queue', color: colors.violet, pro: 'Simple. Built-in competing-consumer load balancing. Per-message DLQ.', con: 'No replay. New consumer cannot see past events. Fan-out is awkward.', use: 'Task distribution, commands, work that is done once.' },
            { name: 'Log', color: colors.cyan, pro: 'Replay, multi-consumer fan-out for free, event sourcing, backfill.', con: 'You manage offsets, retention, partitions. Heavier mental model.', use: 'Event-driven analytics, read-model rebuilds, audit, high fan-out.' },
          ]}
          verdict='&ldquo;Depends on replay. If a future consumer needs history or I will re-derive state, a retained log. If events are transient work items, a queue. The log superpower is that adding a consumer is free and reprocessing is just rewinding an offset.&rdquo;'
        />
      </section>

      {/* ───── 4. PUSH VS PULL ───── */}
      <section id="delivery-model" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 4</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Push vs. pull</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          A real fork, but a level below log-vs-queue. It mostly decides who controls the rate and whether you expose an inbound door.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="Does the broker call you, or do you call the broker?"
          frame="Push delivers via HTTP POST to a URL you register — your consumer is a server, and the broker sets the pace. Pull means your consumer dials out and fetches at its own speed. The deciding factors are backpressure and surface area."
          options={[
            { name: 'Push', color: colors.green, pro: 'No worker to run. Fits serverless / HTTP services. Low latency.', con: 'Public, authenticated endpoint. Broker controls rate — bursts can swamp you.', use: 'Webhook-style integrations; consumers already behind HTTP.' },
            { name: 'Pull', color: colors.violet, pro: 'Consumer sets pace — natural backpressure. No inbound surface. Batch-friendly.', con: 'You run and scale a worker loop. Idle polling or long-poll complexity.', use: 'High throughput, batch processing, log consumers tracking offsets.' },
          ]}
          verdict='&ldquo;Push if my consumers are already HTTP services and volume is moderate — but I need flow control and a defended endpoint. Pull when I want the consumer to own its rate for backpressure, which is why high-throughput log consumers are almost always pull.&rdquo;'
        />
      </section>

      {/* ───── 5. ORDERING ───── */}
      <section id="ordering" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 5</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Ordering</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          The question behind the question: &ldquo;global ordering&rdquo; is almost never what you want, because it serialises everything. The art is ordering exactly where it matters and nowhere else.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="What is the smallest scope you can order within?"
          frame="Global total order means one partition, one consumer, zero parallelism — a throughput ceiling. Almost always you only need order <em>per entity</em>: events for account 42 must be in order; account 42 vs account 99 do not care. Partition by the entity id and you get per-entity order with full cross-entity parallelism."
          options={[
            { name: 'Global order', color: colors.red, pro: 'Simple to reason about. One true timeline.', con: 'Single partition / single consumer. Throughput ceiling. Does not scale.', use: 'Rarely. A single audit log, maybe.' },
            { name: 'Per-key order', color: colors.green, pro: 'Order where it matters, parallelism everywhere else. Scales horizontally.', con: 'Hot keys skew partitions. Key choice is a one-way door.', use: 'The default for entity event streams. Partition by aggregate id.' },
            { name: 'No order + handle it', color: colors.amber, pro: 'Max parallelism. No partitioning constraints at all.', con: 'Consumer must tolerate reorder — version numbers, timestamps, CRDTs.', use: 'When handlers are commutative or carry their own version.' },
          ]}
          verdict='&ldquo;I partition by the aggregate id so each entity events stay ordered while different entities run in parallel. Global order is a scaling trap. If even per-key order is too costly, I make handlers tolerate reordering with a version field.&rdquo;'
        />
      </section>

      {/* ───── 6. FAILURE MODES ───── */}
      <section id="failure" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 6</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Failure modes</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-6">
          Retries are easy to say and easy to get catastrophically wrong. Four failures every staff engineer names before being asked.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TipCard title="Poison messages → DLQ">
            A message that fails forever (bad schema, un-processable) will retry infinitely and block or burn the consumer. Cap retries, then route to a <code className="text-green-400">dead-letter queue</code> for inspection. The DLQ is a release valve, not a graveyard — alert on it.
          </TipCard>
          <TipCard title="Retry storms → backoff + jitter">
            A downstream blip makes every consumer retry at once, and the synchronized wave keeps it down. Exponential backoff spreads attempts; <code className="text-green-400">jitter</code> de-synchronizes them. Without jitter you have built a self-reinforcing outage.
          </TipCard>
          <TipCard title="Consumer lag → measure it">
            The quiet failure: you are not down, you are <em>behind</em>, and falling further. The single most important consumer metric is lag — unprocessed backlog or offset gap. Alert on lag trend, not just on errors. Slow is the new down.
          </TipCard>
          <TipCard title="Idempotency is the seatbelt">
            At-least-once means redelivery is normal, not exceptional. Every handler keys on the event id and no-ops on repeats. This is what makes retries, DLQ replays, and offset rewinds <em>safe</em> instead of corrupting.
          </TipCard>
        </div>
      </section>

      {/* ───── 7. SCHEMA EVOLUTION ───── */}
      <section id="schema" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 7</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Schema evolution</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          The one that bites in year two, not week one. Producer and consumer deploy independently — so the event contract must change without a coordinated release. Miss this and you have described a system that works only on launch day.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="How does the contract change without breaking live consumers?"
          frame="Because there is no synchronized deploy, at any moment an old producer talks to a new consumer and vice versa. The contract needs compatibility rules and a place to enforce them — a schema registry — or every change becomes a cross-team migration."
          options={[
            { name: 'Backward compatible', color: colors.green, pro: 'New consumer reads old events. Add optional fields, never remove or repurpose.', con: 'Schema only grows; cleanup needs a deprecation cycle.', use: 'The everyday rule for additive change.' },
            { name: 'Forward compatible', color: colors.cyan, pro: 'Old consumer tolerates new events — ignores unknown fields.', con: 'Consumers must be written to skip what they do not know.', use: 'When producers lead deploys, which is common.' },
            { name: 'Breaking → new version', color: colors.amber, pro: 'Clean break when you truly must reshape.', con: 'Run v1 and v2 in parallel; migrate consumers; retire v1.', use: 'Only when additive change cannot express it.' },
          ]}
          verdict='&ldquo;A schema registry enforcing compatibility in CI. Additive-only by default — new fields optional, never remove or repurpose one. Breaking changes get a new event version run alongside the old until consumers migrate. The contract is a public API, treated like one.&rdquo;'
        />
      </section>

      {/* ───── 8. EVENT DESIGN ───── */}
      <section id="design" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 8</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Event design &amp; observability</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          What goes <em>in</em> the event, and how you trace it across the async gap.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="Fat event with state, or thin event plus a fetch?"
          frame="An event can carry the full new state (consumers self-serve, but the payload couples to your model and can go stale) or carry just an id and let consumers fetch (decoupled and fresh, but adds a synchronous call back to the producer — re-introducing the coupling you left). It is a genuine tradeoff, not a rule."
          options={[
            { name: 'Event-carried state', color: colors.green, pro: 'Consumer needs no callback. Fully decoupled at read time. Replayable as-is.', con: 'Fatter payload; leaks producer model; can be stale by delivery.', use: 'High fan-out, or when consumers should not call back.' },
            { name: 'Thin event + fetch', color: colors.cyan, pro: 'Tiny payload; consumer fetches fresh, exactly what it needs.', con: 'Synchronous callback to producer — coupling + load + failure path.', use: 'Large entities, or when freshness beats decoupling.' },
          ]}
          verdict='&ldquo;Default to event-carried state for decoupling and replayability, accepting the model leak and versioning it carefully. Go thin when payloads are large or staleness is unacceptable — knowing I am trading the callback coupling back in. And the trace context rides <em>inside</em> the event, or distributed tracing dies at the async boundary.&rdquo;'
        />
      </section>

      {/* ───── CHECKLIST ───── */}
      <section id="checklist" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">The recall card</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">The interview checklist</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-6">
          If you can speak to each of these as a <em>decision with a tradeoff</em> — not a single right answer — you are covering the surface a staff interview expects.
        </p>
        <div className="bg-gradient-to-b from-[#0e171c] to-[#0b1216] border border-[#1c2f37] rounded-xl p-5 md:p-6">
          <ChecklistItem num="01" label="Delivery semantics">at-least-once + idempotent processing; &ldquo;exactly-once delivery&rdquo; is a red flag phrase.</ChecklistItem>
          <ChecklistItem num="02" label="Dual-write">transactional outbox, not DB-then-publish. Name it unprompted.</ChecklistItem>
          <ChecklistItem num="03" label="Log vs. queue">replay &amp; fan-out vs. simple transient work. The deeper fork.</ChecklistItem>
          <ChecklistItem num="04" label="Push vs. pull">who controls rate; backpressure vs. inbound surface area.</ChecklistItem>
          <ChecklistItem num="05" label="Ordering">partition by aggregate id; global order is a scaling trap.</ChecklistItem>
          <ChecklistItem num="06" label="Failure modes">DLQ for poison, backoff+jitter for storms, lag as the key metric.</ChecklistItem>
          <ChecklistItem num="07" label="Schema evolution">registry + compatibility rules; the contract is a public API.</ChecklistItem>
          <ChecklistItem num="08" label="Event design">fat vs. thin events; trace context travels in the payload.</ChecklistItem>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="mt-16 pt-10 border-t border-forest-800/30 pb-16">
        <p className="text-blog-muted/50 text-base leading-relaxed max-w-[640px]">
          <strong className="text-blog-muted/80 font-medium">What &ldquo;staff-level&rdquo; actually means here.</strong>
          {' '}Not knowing more facts — knowing that almost none of these have a single right answer. The mid-level answer is &ldquo;use at-least-once and idempotency.&rdquo; The staff answer is the same sentence followed by &ldquo;&hellip;because exactly-once delivery is impossible over a network, here is the dual-write problem it implies, here is the outbox that solves it, and here is what I would measure to know it is working.&rdquo; The depth is in the <strong className="text-blog-muted/80 font-medium">because</strong> and the <strong className="text-blog-muted/80 font-medium">what I would measure</strong>.
        </p>
      </footer>
    </div>
  );
}
