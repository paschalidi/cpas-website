'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';

/* ─── Palette helpers (matches Tailwind forest/peach/cream) ─── */
const C = {
  forest950: 'rgb(2,10,5)',
  forest900: 'rgb(12,42,23)',
  forest800: 'rgb(33,52,37)',
  forest700: 'rgb(13,36,24)',
  peach300: 'rgb(243,198,173)',
  peach200: 'rgb(247,217,204)',
  cream50: 'rgb(248,247,244)',
  cream50_06: 'rgb(248,247,244 / 0.06)',
  cream50_04: 'rgb(248,247,244 / 0.04)',
  muted: 'rgb(248,247,244 / 0.5)',
};

/* ─── Step definitions ─── */
interface StepDef {
  node: string;
  line: string | null;
  at: [number, number];
  title: string;
  body: string;
  peach?: boolean; // accent instead of green highlight
}

const STEPS: StepDef[] = [
  {
    node: 'n-app',
    line: null,
    at: [170, 147],
    title: '1 · App code emits a fact',
    body: "Something happens — say an appointment is created. The app doesn't call any downstream service. It just produces an event object describing what occurred.",
  },
  {
    node: 'n-proc',
    line: 'l1',
    at: [170, 242],
    title: '2 · Handed to task queue',
    body: "Rather than publish inline, the app defers to a background task in <code>event_publish.py</code>. The HTTP request can now return immediately — the user never waits on Pub/Sub.",
  },
  {
    node: 'n-es',
    line: 'l2',
    at: [170, 330],
    title: '3 · Published via events-system',
    body: "The background task serializes the event and pushes it through <code>events-system</code>, the shared package that wraps Google Cloud Pub/Sub. App code never touches Google's SDK directly.",
  },
  {
    node: 'n-pubsub',
    line: 'l3',
    at: [490, 179],
    title: '4 · Lands in Pub/Sub',
    body: "The event is now a message on a Pub/Sub topic. The app's job is done — from here, routing is entirely Google's concern, governed by external config.",
  },
  {
    node: 'n-yml',
    line: null,
    at: [490, 295],
    title: '5 · events.yml decides the destinations',
    body: "The <code>events.yml</code> registry in the infra repo declares who subscribes to this topic, with what endpoint and retry policy. Push subscriptions are configured from it.",
    peach: true,
  },
  {
    node: 'n-endpoint',
    line: 'l4',
    at: [810, 177],
    title: '6 · Pushed to a Ninja endpoint',
    body: "Pub/Sub actively POSTs the event to <code>/events/&lt;topic&gt;/</code> in the app. No polling — the delivery is a push, driven by the subscription config.",
  },
  {
    node: 'n-handler',
    line: 'l5',
    at: [810, 272],
    title: '7 · Verified and deserialized',
    body: "Before any logic runs, <code>@event_handler</code> verifies the Google service-account JWT (proving it really came from Pub/Sub) and deserializes the push payload.",
  },
  {
    node: 'n-processor',
    line: 'l6',
    at: [810, 357],
    title: '8 · Routed to a domain handler',
    body: "<code>EventProcessor</code> inspects the topic and dispatches to the matching domain handler — the code that finally does the work the event was meant to trigger. Journey complete.",
  },
];

/* ─── CSS-in-JS for the pipeline ─── */
const styles = {
  zone: {
    fill: 'none',
    stroke: C.cream50_06,
    strokeWidth: 1,
  },
  zoneLabel: {
    fill: C.muted,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
  },
  flowLine: {
    stroke: C.cream50_06,
    strokeWidth: 1.5,
    fill: 'none',
    strokeLinecap: 'round' as const,
    transition: 'stroke .4s, stroke-width .4s',
  },
  flowLineLit: {
    stroke: C.peach300,
    strokeWidth: 2.5,
  },
  nBox: {
    fill: C.forest900,
    stroke: C.cream50_06,
    strokeWidth: 1,
    rx: 10,
    transition: 'stroke .35s, fill .35s',
  },
  nBoxActive: {
    stroke: C.peach300,
    strokeWidth: 1.5,
    fill: C.forest700,
  },
  nBoxDone: {
    stroke: C.cream50_04,
    fill: C.forest950,
  },
  nTitle: {
    fill: C.cream50,
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: 11,
    fontWeight: 350,
  },
  nSub: {
    fill: C.muted,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
  },
};

export function AnimatedPipeline() {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const SPEED = 1000;

  const total = STEPS.length;

  /* ─── Apply a step ─── */
  const applyStep = useCallback(
    (i: number) => {
      // This is handled via data attributes we read from the DOM
      // Because we need to toggle classes on SVG elements
      const svg = document.querySelector('.pipe-svg') as SVGElement | null;
      if (!svg) return;

      // Clear active classes
      svg.querySelectorAll('.n-box-active').forEach((e) => e.classList.remove('n-box-active'));
      svg.querySelectorAll('.flow-line-lit').forEach((e) => e.classList.remove('flow-line-lit'));

      const s = STEPS[i];

      // Mark previous node as done
      if (i > 0) {
        const prevNode = document.querySelector(`#${STEPS[i - 1].node} .n-box`);
        if (prevNode) {
          prevNode.classList.remove('n-box-active');
          prevNode.classList.add('n-box-done');
        }
      }

      // Light up flow line
      if (s.line) {
        const line = document.getElementById(s.line);
        if (line) line.classList.add('flow-line-lit');
      }

      // Move packet
      const packet = document.getElementById('packet');
      if (packet) {
        packet.setAttribute('transform', `translate(${s.at[0]},${s.at[1]})`);
        packet.setAttribute('opacity', '1');
      }

      // Active node
      const box = document.querySelector(`#${s.node} .n-box`);
      if (box) box.classList.add('n-box-active');
    },
    [],
  );

  /* ─── Advance one step ─── */
  const advance = useCallback(() => {
    setCursor((prev) => {
      const next = prev + 1;
      return next;
    });
  }, []);

  // Effect to apply step when cursor changes
  useEffect(() => {
    if (cursor === 0) return;
    const i = cursor - 1;
    applyStep(i);
  }, [cursor, applyStep]);

  /* ─── Reset ─── */
  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
    setCursor(0);

    const svg = document.querySelector('.pipe-svg');
    if (svg) {
      svg.querySelectorAll('.n-box-active, .n-box-done').forEach((e) => {
        e.classList.remove('n-box-active', 'n-box-done');
      });
      svg.querySelectorAll('.flow-line-lit').forEach((e) => e.classList.remove('flow-line-lit'));
    }

    const packet = document.getElementById('packet');
    if (packet) {
      packet.setAttribute('transform', 'translate(170,147)');
      packet.setAttribute('opacity', '0');
    }
  }, []);

  /* ─── Toggle play ─── */
  const togglePlay = useCallback(() => {
    setPlaying((prev) => !prev);
  }, []);

  /* ─── Single step ─── */
  const step = useCallback(() => {
    if (playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPlaying(false);
    }
    if (cursor >= total) reset();
    advance();
  }, [playing, cursor, total, advance, reset]);

  /* ─── Auto-advance while playing ─── */
  useEffect(() => {
    if (!playing) return;
    if (cursor >= total) {
      setPlaying(false);
      return;
    }

    const tick = () => {
      advance();
    };
    timerRef.current = setTimeout(tick, SPEED);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, cursor, total, advance]);

  /* ─── Play button label ─── */
  const playLabel =
    cursor >= total ? '↺ Replay' : playing ? '❚❚ Pause' : cursor === 0 ? '▶ Play the journey' : '▶ Resume';

  /* ─── IntersectionObserver auto-play on first scroll ─── */
  useEffect(() => {
    if (seen) return;
    const el = boardRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen) {
            setSeen(true);
            setTimeout(() => setPlaying(true), 500);
          }
        });
      },
      { threshold: 0.45 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  /* ─── Narrator content ─── */
  const currentStep = cursor > 0 && cursor <= total ? STEPS[cursor - 1] : null;

  return (
    <div className="pipeline-wrap my-10">
      <div
        ref={boardRef}
        className="stage-board rounded-xl border border-white/10 bg-[rgb(1,6,3)] overflow-hidden"
      >
        <div className="font-mono text-[10px] text-white/40 px-4 pt-3 pb-1 select-none">
          // event flow monitor
        </div>
        {/* Self-contained animation styles */}
        <style>{`
          .n-box-active { stroke: rgb(243,198,173) !important; stroke-width: 1.5 !important; fill: rgb(13,36,24) !important; }
          .n-box-done { stroke: rgb(248,247,244 / 0.04) !important; fill: rgb(2,10,5) !important; }
          .flow-line-lit { stroke: rgb(243,198,173) !important; stroke-width: 2.5 !important; }
        `}</style>
        <svg
          className="pipe-svg w-full"
          viewBox="0 0 980 440"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Animated event pipeline"
        >
          {/* ZONES */}
          <rect x="20" y="60" width="300" height="230" rx="14" style={styles.zone} />
          <text x="34" y="80" style={styles.zoneLabel}>
            App · publish side
          </text>

          <rect x="392" y="120" width="196" height="110" rx="14" style={styles.zone} />
          <text x="406" y="140" style={styles.zoneLabel}>
            Google Cloud
          </text>

          <rect x="660" y="60" width="300" height="320" rx="14" style={styles.zone} />
          <text x="674" y="80" style={styles.zoneLabel}>
            App · receive side
          </text>

          {/* FLOW LINES */}
          <path id="l1" style={styles.flowLine} d="M 170 175 L 170 215" />
          <path id="l2" style={styles.flowLine} d="M 170 270 L 170 305 L 170 305" />
          <path id="l3" style={styles.flowLine} d="M 250 330 L 460 330 L 460 232" />
          <path id="l4" style={styles.flowLine} d="M 490 175 L 490 120 L 810 120 L 810 150" />
          <path id="l5" style={styles.flowLine} d="M 810 205 L 810 245" />
          <path id="l6" style={styles.flowLine} d="M 810 300 L 810 335" />

          {/* NODES: publish side */}
          <g id="n-app">
            <rect className="n-box" x="60" y="120" width="220" height="55" style={styles.nBox} />
            <text x="80" y="145" style={styles.nTitle}>
              App code
            </text>
            <text x="80" y="162" style={styles.nSub}>
              "appointment created"
            </text>
          </g>
          <g id="n-proc">
            <rect className="n-box" x="60" y="215" width="220" height="55" style={styles.nBox} />
            <text x="80" y="240" style={styles.nTitle}>
              Task queue
            </text>
            <text x="80" y="257" style={styles.nSub}>
              event_publish.py · deferred
            </text>
          </g>
          <g id="n-es">
            <rect className="n-box" x="60" y="305" width="220" height="50" style={styles.nBox} />
            <text x="80" y="328" style={styles.nTitle}>
              events-system
            </text>
            <text x="80" y="344" style={styles.nSub}>
              wraps Pub/Sub publish()
            </text>
          </g>

          {/* NODE: pubsub */}
          <g id="n-pubsub">
            <rect className="n-box" x="410" y="150" width="160" height="58" style={styles.nBox} />
            <text x="430" y="175" style={styles.nTitle}>
              Pub/Sub
            </text>
            <text x="430" y="193" style={styles.nSub}>
              topic · push subscription
            </text>
          </g>

          {/* routing registry callout */}
          <g id="n-yml">
            <rect
              className="n-box"
              x="392"
              y="270"
              width="196"
              height="50"
              rx="10"
              fill={C.forest900}
              stroke={C.peach300}
              strokeWidth={1}
            />
            <text x="412" y="293" style={{ ...styles.nTitle, fill: C.peach300 }}>
              events.yml
            </text>
            <text x="412" y="309" style={styles.nSub}>
              routing registry · infra repo
            </text>
          </g>
          <path
            style={{ ...styles.flowLine, stroke: C.peach300, strokeDasharray: '4 4' }}
            d="M 490 270 L 490 232"
          />

          {/* NODES: receive side */}
          <g id="n-endpoint">
            <rect className="n-box" x="700" y="150" width="220" height="55" style={styles.nBox} />
            <text x="720" y="175" style={styles.nTitle}>
              Ninja endpoint
            </text>
            <text x="720" y="192" style={styles.nSub}>
              /events/&lt;topic&gt;/
            </text>
          </g>
          <g id="n-handler">
            <rect className="n-box" x="700" y="245" width="220" height="55" style={styles.nBox} />
            <text x="720" y="270" style={styles.nTitle}>
              @event_handler
            </text>
            <text x="720" y="287" style={styles.nSub}>
              verify JWT · deserialize
            </text>
          </g>
          <g id="n-processor">
            <rect className="n-box" x="700" y="335" width="220" height="45" style={styles.nBox} />
            <text x="720" y="362" style={styles.nTitle}>
              EventProcessor → domain
            </text>
          </g>

          {/* the travelling packet */}
          <g
            id="packet"
            opacity="0"
            transform="translate(170,147)"
            style={{ transition: 'transform .55s cubic-bezier(.45,0,.25,1)' }}
          >
            <circle r="11" fill="none" stroke={C.peach300} strokeWidth={1} opacity={0.4} />
            <circle r="5" fill={C.peach300} />
          </g>
        </svg>
      </div>

      {/* Narrator */}
      <div className="narrator flex items-start gap-4 mt-4 px-1">
        <span
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
            'font-mono text-xs font-bold',
            cursor > 0
              ? 'bg-emerald-900/30 text-emerald-400'
              : 'bg-white/5 text-white/30',
          )}
        >
          {cursor > 0 ? cursor : '—'}
        </span>
        <div className="min-w-0">
          <h4 className="font-[350] text-sm text-white/80">
            {currentStep ? currentStep.title : 'Ready when you are'}
          </h4>
          <p
            className="mt-1 text-sm text-white/50 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: currentStep
                ? currentStep.body
                : 'Hit <b>Play the journey</b> to watch an event travel from the moment it is emitted, through the async queue and Pub/Sub, all the way to the domain handler that acts on it.',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="controls flex items-center gap-3 mt-5 flex-wrap">
        <button
          onClick={togglePlay}
          className={cn(
            'px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all',
            'bg-white/10 text-white/80 hover:bg-white/20',
          )}
        >
          {playLabel}
        </button>
        <button
          onClick={step}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            'bg-white/5 text-white/50 hover:bg-white/10',
          )}
        >
          Step ›
        </button>
        <button
          onClick={reset}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            'bg-white/5 text-white/50 hover:bg-white/10',
          )}
        >
          ↺ Reset
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 min-w-[80px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blog-accent to-emerald-400 transition-all duration-300"
            style={{ width: `${(cursor / total) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-white/40">
          {cursor} / {total}
        </span>
      </div>
    </div>
  );
}
