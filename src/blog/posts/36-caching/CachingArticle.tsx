import React, { useState, useRef, useCallback, useEffect } from 'react';
import DecisionCard from '../../components/DecisionCard';
import TipCard from '../../components/TipCard';
import MiniDiagram from '../../components/MiniDiagram';
import ChecklistItem from '../../components/ChecklistItem';

/* ─────────────────────────────────────────────
   Colour tokens for the cache theme
───────────────────────────────────────────── */
const colors = {
  green: '#3ddc84',
  greenDeep: '#1c9d5a',
  cyan: '#34d6e8',
  cyanDeep: '#1893a5',
  amber: '#f5b73d',
  amberDeep: '#b9821a',
  red: '#ef5f5f',
  redDeep: '#b91c1c',
  fog: '#8aa6b0',
  fogDim: '#5a727c',
  white: '#f2fafc',
  panel: '#0e171c',
  line: '#1c2f37',
  lineBright: '#2a4651',
};

/* ─────────────────────────────────────────────
   Cache-aside animation — 5 steps
───────────────────────────────────────────── */
const CACHE_STEPS = [
  {
    title: '1 · Request arrives',
    body: 'The application needs a value — say a user profile. It has a key it can look up.',
    why: 'why we start here: every cache miss begins with a cache check. The order matters.',
    activeDot: 'client',
    highlight: null as string | null,
  },
  {
    title: '2 · Cache lookup (the fast path)',
    body: 'The application asks the cache (Redis) for the key. If found, return immediately. ~1ms.',
    why: 'why ~1ms: memory reads are nanoseconds; the network round-trip to Redis within the same AZ is what costs the millisecond. Still 20-50× faster than a database query.',
    activeDot: 'cache',
    highlight: 'h1',
  },
  {
    title: '3 · Cache miss — fall back to DB',
    body: 'Key not in cache. The application queries the database instead. 20-50ms for a typical indexed read.',
    why: 'why the miss cost is what makes caching worth optimising: one miss is cheap, 10,000 concurrent misses kill your database.',
    activeDot: 'db',
    highlight: 'h2',
  },
  {
    title: '4 · Store result in cache',
    body: 'The application writes the fetched value into the cache with a TTL, so subsequent requests hit the fast path.',
    why: 'why TTL: without it the cache grows unbounded and data never gets a chance to refresh if it changes in the DB.',
    activeDot: 'cache',
    highlight: 'h3',
  },
  {
    title: '5 · Return to client',
    body: 'Value returned to the caller. Next request for the same key goes straight to step 2 — cache hit.',
    why: 'why this pattern (cache-aside) is the default: the application controls both read and write paths, no special infra beyond a key-value store.',
    activeDot: 'client',
    highlight: 'h4',
  },
];

function CacheAsideAnimation() {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [doneDots, setDoneDots] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speed = 1400;

  const current = cursor < CACHE_STEPS.length ? CACHE_STEPS[cursor] : null;

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
    setDoneDots(new Set());
  }, [clearTimer]);

  const advance = useCallback(() => {
    setCursor((prev) => {
      if (prev >= CACHE_STEPS.length) return prev;
      if (prev > 0) {
        const prevStep = CACHE_STEPS[prev - 1];
        setDoneDots((d) => new Set(d).add(prevStep.activeDot));
      }
      return prev + 1;
    });
  }, []);

  const stepOnce = useCallback(() => {
    if (cursor >= CACHE_STEPS.length) {
      resetAnim();
      setTimeout(advance, 50);
    } else {
      advance();
    }
  }, [cursor, advance, resetAnim]);

  const togglePlay = useCallback(() => {
    if (playing) {
      clearTimer();
      setPlaying(false);
    } else {
      if (cursor >= CACHE_STEPS.length) {
        resetAnim();
        setTimeout(() => setPlaying(true), 100);
      } else {
        setPlaying(true);
      }
    }
  }, [playing, cursor, resetAnim, clearTimer]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= CACHE_STEPS.length) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(advance, cursor === 0 ? 200 : speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, cursor, speed, advance]);

  const isActive = (id: string) => current?.activeDot === id;
  const isDone = (id: string) => doneDots.has(id);
  const isLit = (id: string) => current?.highlight === id && cursor > 0;
  const allDone = cursor >= CACHE_STEPS.length;

  return (
    <div className="mt-10">
      {/* SVG board */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#0e171c] to-[#0b1216] border border-[#2a4651] rounded-xl p-4 md:p-6">
        <div className="absolute top-3 right-4 font-mono text-[0.6rem] tracking-[0.18em] uppercase" style={{ color: colors.fogDim }}>
          // cache-aside flow
        </div>
        <svg viewBox="0 0 800 280" className="w-full h-auto overflow-visible" aria-label="Cache-aside flow animation">
          {/* Zones */}
          <rect x={15} y={50} width={180} height={180} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={30} y={74} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>APPLICATION</text>

          <rect x={240} y={50} width={170} height={180} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={255} y={74} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>CACHE (REDIS)</text>

          <rect x={455} y={50} width={170} height={180} rx={14} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="5 5" />
          <text x={470} y={74} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9} letterSpacing=".22em" style={{ textTransform: 'uppercase' }}>DATABASE</text>

          {/* Flow lines */}
          {/* Client → Cache */}
          <path d="M 195 130 L 225 130 L 240 130" fill="none" stroke={isLit('h1') ? colors.green : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('h1') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.5))' : 'none', transition: 'stroke 0.4s' }} />
          {/* Cache → Client (hit) */}
          <path d="M 240 170 L 210 170 L 195 170" fill="none" stroke={isLit('h4') ? colors.cyan : colors.lineBright} strokeWidth={1.5} strokeDasharray="4 3"
            style={{ filter: isLit('h4') ? 'drop-shadow(0 0 5px rgba(52,214,232,0.5))' : 'none', transition: 'stroke 0.4s' }} />
          {/* Cache → DB (miss) */}
          <path d="M 410 130 L 440 130 L 455 130" fill="none" stroke={isLit('h2') ? colors.amber : colors.lineBright} strokeWidth={2}
            style={{ filter: isLit('h2') ? 'drop-shadow(0 0 5px rgba(245,183,61,0.5))' : 'none', transition: 'stroke 0.4s' }} />
          {/* DB → Cache (store) */}
          <path d="M 455 170 L 425 170 L 410 170" fill="none" stroke={isLit('h3') ? colors.green : colors.lineBright} strokeWidth={1.5} strokeDasharray="4 3"
            style={{ filter: isLit('h3') ? 'drop-shadow(0 0 5px rgba(61,220,132,0.5))' : 'none', transition: 'stroke 0.4s' }} />

          {/* Node: Client */}
          <g>
            <rect x={50} y={110} width={145} height={55} rx={10} fill={colors.panel}
              stroke={isActive('client') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('client') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={68} y={135} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Client / App</text>
            <text x={68} y={152} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>get(key)</text>
          </g>

          {/* Node: Cache */}
          <g>
            <rect x={255} y={110} width={140} height={55} rx={10} fill={colors.panel}
              stroke={isActive('cache') ? colors.green : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('cache') ? 'drop-shadow(0 0 10px rgba(61,220,132,0.5))' : 'none' }} />
            <text x={273} y={135} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Cache</text>
            <text x={273} y={152} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>key → value · ~1ms</text>
          </g>

          {/* Node: DB */}
          <g>
            <rect x={470} y={110} width={140} height={55} rx={10} fill={colors.panel}
              stroke={isActive('db') ? colors.amber : colors.lineBright} strokeWidth={1.5}
              style={{ transition: 'stroke 0.3s', filter: isActive('db') ? 'drop-shadow(0 0 10px rgba(245,183,61,0.5))' : 'none' }} />
            <text x={488} y={135} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={14}>Database</text>
            <text x={488} y={152} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9.5}>SELECT · 20-50ms</text>
          </g>

          {/* Animated packet */}
          {current && cursor < CACHE_STEPS.length ? (
            <g>
              <circle cx={
                current.activeDot === 'client' ? 122
                : current.activeDot === 'cache' ? 325
                : 540
              } cy={137} r={4} fill={colors.green}
                style={{ filter: 'drop-shadow(0 0 8px rgba(61,220,132,0.9))', transition: 'cx 0.5s cubic-bezier(.45,0,.25,1), cy 0.5s cubic-bezier(.45,0,.25,1)' }} />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Narrator panel */}
      <div className="mt-4 min-h-[90px] bg-[#070b0d] border border-[#1c2f37] rounded-xl p-4 md:p-5 flex gap-4 items-start">
        <span
          className="font-mono text-xs font-bold shrink-0 rounded-lg px-2.5 py-1.5 leading-none"
          style={{
            background: allDone ? '#f3c6ad' : colors.lineBright,
            color: allDone ? '#070b0d' : colors.fog,
          }}
        >
          {allDone ? '✓' : cursor + 1}
        </span>
        <div>
          <h4 className="text-lg font-semibold text-[#f2fafc] mb-1">
            {allDone ? 'Full round-trip complete' : (current?.title ?? '')}
          </h4>
          {allDone ? (
            <p style={{ color: colors.fog }} className="text-base leading-relaxed">
              Cache miss → DB fallback → cache population → next request hits fast path.
              Each of the decisions below refines this basic flow.
            </p>
          ) : current ? (
            <>
              <p className="text-base leading-relaxed" style={{ color: colors.fog }}>{current.body}</p>
              <div className="mt-2 text-sm leading-relaxed border-l-2 border-peach-300/40 pl-3 text-blog-muted/60">
                <b className="font-mono text-[0.7rem] tracking-[0.08em] uppercase text-peach-300">why</b>
                {' '}{current.why}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          onClick={togglePlay}
          className="font-mono text-xs tracking-wider px-4 py-2.5 rounded-full border border-blog-border/15 bg-forest-950/60 text-blog-text hover:border-peach-300/50 hover:bg-forest-800/60 active:scale-97 transition-all duration-200 flex items-center gap-2"
          style={playing ? { borderColor: '#f3c6ad', color: '#f3c6ad' } : undefined}
        >
          {playing ? '❚❚ Pause' : cursor >= CACHE_STEPS.length ? '↺ Replay' : '▶ Play'}
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
        <div className="flex-1 min-w-[100px] h-1 bg-forest-800/40 rounded-full overflow-hidden">
          <span
            className="block h-full rounded-full transition-all duration-300"
            style={{
              width: `${(Math.min(cursor, CACHE_STEPS.length) / CACHE_STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #f3c6ad, #c9a58e)',
            }}
          />
        </div>
        <div className="font-mono text-xs text-blog-muted/60 whitespace-nowrap">
          {Math.min(cursor, CACHE_STEPS.length)} / {CACHE_STEPS.length}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Cache architecture diagrams (inline SVG)
───────────────────────────────────────────── */
function WriteThroughDiagram() {
  return (
    <div className="mt-4 bg-[#070b0d] border border-blog-border/15 rounded-lg p-4">
      <svg viewBox="0 0 680 120" className="w-full h-auto" aria-label="Write-through cache flow">
        {/* App box */}
        <rect x={20} y={15} width={120} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={36} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>App</text>

        {/* Cache box */}
        <rect x={250} y={15} width={140} height={50} rx={8} fill={colors.panel} stroke={colors.greenDeep} strokeWidth={1.5} />
        <text x={268} y={38} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Cache (primary)</text>
        <text x={268} y={54} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9}>write(key, value)</text>

        {/* DB box */}
        <rect x={500} y={15} width={140} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={518} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Database</text>

        {/* Flow: App → Cache → DB */}
        <path d="M 140 40 L 220 40 L 250 40" fill="none" stroke={colors.green} strokeWidth={2} markerEnd="url(#arrowGreen)" />
        <path d="M 390 40 L 470 40 L 500 40" fill="none" stroke={colors.green} strokeWidth={2} markerEnd="url(#arrowGreen)" />
        <path d="M 640 40 L 660 40 L 660 70 L 160 70 L 160 65" fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeDasharray="4 3" />

        {/* Legend */}
        <text x={96} y={100} fill={colors.green} fontFamily="Chivo Mono, monospace" fontSize={7}>write</text>
        <text x={136} y={100} fill={colors.cyan} fontFamily="Chivo Mono, monospace" fontSize={7}>ack</text>

        {/* Defs for arrow markers */}
        <defs>
          <marker id="arrowGreen" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
            <path d="M 0 0 L 8 3 L 0 6 Z" fill={colors.green} />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

function WriteBehindDiagram() {
  return (
    <div className="mt-4 bg-[#070b0d] border border-blog-border/15 rounded-lg p-4">
      <svg viewBox="0 0 680 120" className="w-full h-auto" aria-label="Write-behind cache flow">
        {/* App box */}
        <rect x={20} y={15} width={120} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={36} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>App</text>

        {/* Cache box */}
        <rect x={250} y={15} width={160} height={50} rx={8} fill={colors.panel} stroke={colors.amber} strokeWidth={1.5} />
        <text x={268} y={38} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Cache + queue</text>
        <text x={268} y={54} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9}>async flush</text>

        {/* DB box */}
        <rect x={520} y={15} width={140} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={538} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Database</text>

        {/* Flow */}
        <path d="M 140 40 L 220 40 L 250 40" fill="none" stroke={colors.green} strokeWidth={2} />
        <path d="M 140 40 L 140 100 L 590 100 L 590 65" fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d="M 410 40 L 490 40" fill="none" stroke={colors.amber} strokeWidth={1.5} strokeDasharray="5 4" />
        {/* Async flush pulse */}
        <circle cx={450} cy={40} r={4} fill={colors.amber} opacity={0.8}>
          <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
        </circle>

        <text x={96} y={100} fill={colors.green} fontFamily="Chivo Mono, monospace" fontSize={7}>write (instant)</text>
        <text x={210} y={100} fill={colors.amber} fontFamily="Chivo Mono, monospace" fontSize={7}>async flush to DB</text>
        <text x={450} y={100} fill={colors.cyan} fontFamily="Chivo Mono, monospace" fontSize={7}>ack to client</text>
      </svg>
    </div>
  );
}

function ReadThroughDiagram() {
  return (
    <div className="mt-4 bg-[#070b0d] border border-blog-border/15 rounded-lg p-4">
      <svg viewBox="0 0 680 120" className="w-full h-auto" aria-label="Read-through cache flow">
        {/* Client */}
        <rect x={20} y={15} width={90} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={36} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Client</text>

        {/* Cache */}
        <rect x={230} y={15} width={160} height={50} rx={8} fill={colors.panel} stroke={colors.cyan} strokeWidth={1.5} />
        <text x={248} y={38} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Cache (aware)</text>
        <text x={248} y={54} fill={colors.fogDim} fontFamily="Chivo Mono, monospace" fontSize={9}>loads from DB on miss</text>

        {/* DB */}
        <rect x={510} y={15} width={140} height={50} rx={8} fill={colors.panel} stroke={colors.lineBright} strokeWidth={1.5} />
        <text x={528} y={44} fill={colors.white} fontFamily="Sora, sans-serif" fontWeight={600} fontSize={12}>Database</text>

        {/* Flow */}
        <path d="M 110 40 L 200 40 L 230 40" fill="none" stroke={colors.green} strokeWidth={2} />
        <path d="M 230 40 L 200 40 L 110 40" fill="none" stroke={colors.green} strokeWidth={2} />
        <path d="M 390 40 L 470 40 L 510 40" fill="none" stroke={colors.cyan} strokeWidth={2} strokeDasharray="5 4" />
        <path d="M 650 40 L 680 40 L 680 80 L 160 80 L 160 65" fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeDasharray="3 3" />

        <text x={80} y={100} fill={colors.green} fontFamily="Chivo Mono, monospace" fontSize={7}>get(key)</text>
        <text x={320} y={100} fill={colors.cyan} fontFamily="Chivo Mono, monospace" fontSize={7}>miss → auto-load</text>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Eviction comparison grid
───────────────────────────────────────────── */
function EvictionGrid() {
  const rows = [
    { name: 'LRU', desc: 'Evicts the item used longest ago.', strength: 'Good general-purpose. Works when recency correlates with relevance.', fail: 'Scan workloads — reading every row once fills cache with cold data.', interview: 'Default answer. Start here unless you have a reason not to.' },
    { name: 'LFU', desc: 'Evicts the item accessed least frequently.', strength: 'Keeps true hot keys around regardless of when they were last hit.', fail: 'A once-popular key that is now dead lingers forever. Needs age weighting.', interview: 'Worth mentioning if the workload has clear hot/cold skew (e.g., viral posts).' },
    { name: 'FIFO', desc: 'Evicts the oldest inserted item regardless of access.', strength: 'Simple. No bookkeeping per access.', fail: 'Purely by age, not usefulness. A heavily accessed item gets evicted on schedule.', interview: 'Almost never the right answer. Shows you know the alternatives.' },
    { name: 'TTL', desc: 'Data expires after a fixed wall-clock time.', strength: 'Bounded staleness. Prevents data going stale even if accessed constantly.', fail: 'Cannot distinguish hot vs cold — every key lives exactly as long.', interview: 'Not an eviction policy — pair it with one. Always set a TTL.' },
  ];
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-sm leading-relaxed border-collapse">
        <thead>
          <tr className="border-b border-blog-border/15">
            <th className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-blog-accent text-left pb-3 pr-4">Policy</th>
            <th className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-blog-muted/60 text-left pb-3 pr-4">How it works</th>
            <th className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-green-500 text-left pb-3 pr-4">Strength</th>
            <th className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-red-400 text-left pb-3 pr-4">Weakness</th>
            <th className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-peach-300 text-left pb-3">Interview use</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-blog-border/10">
              <td className="py-3 pr-4 font-semibold text-blog-text">{r.name}</td>
              <td className="py-3 pr-4 text-blog-muted/70">{r.desc}</td>
              <td className="py-3 pr-4 text-blog-muted/70">{r.strength}</td>
              <td className="py-3 pr-4 text-blog-muted/70">{r.fail}</td>
              <td className="py-3 text-blog-muted/70">{r.interview}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Common problems comparison
───────────────────────────────────────────── */
function ProblemCard({ title, cause, impact, defense }: { title: string; cause: string; impact: string; defense: string }) {
  return (
    <div className="bg-[#070b0d] border border-blog-border/15 rounded-xl p-5">
      <h4 className="text-lg font-semibold text-blog-text mb-3">{title}</h4>
      <div className="space-y-2 text-sm leading-relaxed">
        <div className="flex gap-3">
          <span className="shrink-0 w-[60px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-red-400 pt-0.5">cause</span>
          <span className="text-blog-muted/70">{cause}</span>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-[60px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-amber pt-0.5">impact</span>
          <span className="text-blog-muted/70">{impact}</span>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-[60px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-green-500 pt-0.5">defense</span>
          <span className="text-blog-muted/70">{defense}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function CachingArticle() {
  return (
    <div className="blog-content max-w-none">
      {/* ════════════════════════════════════
          HERO
      ════════════════════════════════════ */}
      <section id="flow">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">
          Caching · Staff-Level Guide
        </div>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          Caching comes up in <em>nearly every</em> system design interview. When your database becomes a bottleneck, latency creeps up, and the interviewer waits for you to say the word — cache. What separates a good answer from a great one is not naming Redis. It is knowing <strong className="text-blog-text font-medium">where</strong> to cache, <strong className="text-blog-text font-medium">which architecture</strong> to use, and — critically — <strong className="text-blog-text font-medium">what breaks</strong> when you do.
        </p>

        <CacheAsideAnimation />
      </section>

      {/* ════════════════════════════════════
          WHERE TO CACHE
      ════════════════════════════════════ */}
      <section id="where" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 1</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Where to cache</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          Cache is not a single layer. The answer that gets you hired says &ldquo;I put it here, but I also considered here and here, and here is why I did not.&rdquo;
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="Which cache layer is right for this data?"
          frame="Not everything belongs in the same place. The right cache <em>location</em> depends on who reads the data, how often, at what latency, and whether sharing across instances matters. The four layers below stack: you almost always start with external, then add others only when the bottleneck demands it."
          options={[
            { name: 'External cache (Redis)', color: colors.green, pro: 'Shared across all instances. ~1ms reads. Handles 100k+ ops/sec. Survives restarts with persistence.', con: 'Network round-trip cost. Another service to run. Memory-bound.', use: 'Your default. Start here for any read-heavy workload.' },
            { name: 'In-process cache', color: colors.cyan, pro: 'No network hop — nanoseconds. Perfect for hot keys that every request hits.', con: 'Per-instance: each machine has its own copy. Wasted memory on replicas. Stale on other nodes.', use: 'Layer on top of Redis for the hottest 1% of keys. Feature flags, config.' },
            { name: 'CDN', color: colors.amber, pro: 'Geo-distributed. Offloads origin. Best for static media and assets.', con: 'Cache invalidation is slow (purge takes minutes). Not for dynamic per-user data.', use: 'Images, videos, JS bundles — anything served by URL.' },
            { name: 'Client-side cache', color: colors.fog, pro: 'Zero origin load. Instant reads on repeat visit.', con: 'Zero control. Cache lives on user devices. Stale until TTL or purge.', use: 'Static assets in browser. API responses with Cache-Control headers.' },
          ]}
          verdict='&ldquo;External cache with Redis is my starting answer. I layer in-process caching only for the hottest keys — the 1% that cause a stampede risk. CDN when the problem mentions media or global users. Client-side cache for idle-until-needed static data.&rdquo;'
        />
        <div className="mt-6">
          <TipCard title="The &ldquo;mention in-process&rdquo; signal" accent={colors.cyan}>
            Most candidates stop at Redis. The ones who add &ldquo;and for the absolute hottest keys I put a small in-memory cache in the application layer, with a short TTL, so we do not even hit Redis for that 1% of reads&rdquo; — those candidates show they understand that every network hop, even to Redis, is avoidable for the hottest data. It is a small detail that consistently impresses interviewers.
          </TipCard>
        </div>
      </section>

      {/* ════════════════════════════════════
          CACHE ARCHITECTURE
      ════════════════════════════════════ */}
      <section id="architecture" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 2</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Cache architecture</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          How data flows through your cache changes consistency, latency, and how much you trust your cache as a source of truth.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="Which read/write pattern fits your consistency needs?"
          frame="The animation at the top shows <em>cache-aside</em> — the simplest and most common pattern. But three other architectures exist, each with a different trade-off between consistency and complexity. Interviewers often follow up &ldquo;you mentioned caching&rdquo; with &ldquo;which pattern?&rdquo; Have an answer."
          options={[
            { name: 'Cache-aside (lazy loading)', color: colors.green, pro: 'Simple. Cache is not the source of truth. Handles stale data naturally via TTL.', con: 'Cache miss adds latency. Loading on first read means a cold start hits the DB hard.', use: 'The default for 90% of systems. Start here.' },
            { name: 'Write-through', color: colors.cyan, pro: 'Cache is always fresh. No stale reads after a write.', con: 'Slower writes (must wait for DB). Cache must be available for writes.', use: 'When reads must be consistent with the latest write. Profile data, settings, permissions.' },
            { name: 'Write-behind (write-back)', color: colors.amber, pro: 'Fast writes — acknowledged immediately. Batches DB writes for efficiency.', con: 'Data loss risk if cache fails before flush. Stale reads on other nodes until flushed.', use: 'High-volume writes where some data loss is tolerable. Analytics, clickstreams, logs.' },
            { name: 'Read-through', color: colors.fog, pro: 'Cache transparently loads from DB on miss. App code unaware of cache.', con: 'Cache must know how to load data. Tight coupling between cache and DB schema.', use: 'Less common. Useful when using dedicated caching middleware like a Redis module.' },
          ]}
          verdict='&ldquo;Cache-aside by default. If the requirement calls for strong read consistency after writes, I switch to write-through for those specific keys. Write-behind only when write throughput is the bottleneck and I can tolerate small data loss. Read-through is rarely worth the coupling.&rdquo;'
        />

        <div className="mt-6">
          <h3 className="text-xl md:text-2xl font-semibold text-blog-text mb-3">What each pattern looks like in practice</h3>
          <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0 max-w-[72ch]">
            These three alternatives to cache-aside are worth knowing. You will not always use them, but naming them shows range.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div>
              <MiniDiagram title="Write-through" subtitle="cache writes to DB before responding" caption="Write-through ensures cache and DB are always in sync, but every write pays the full price of both hops. Use it when a stale read has visible consequences (e.g., permissions, payment limits).">
                <WriteThroughDiagram />
              </MiniDiagram>
            </div>
            <div>
              <MiniDiagram title="Write-behind" subtitle="cache writes to DB asynchronously" caption="Write-behind batches DB writes for throughput but risks data loss on cache failure. Use it for high-volume append-only data like clickstreams or analytics events.">
                <WriteBehindDiagram />
              </MiniDiagram>
            </div>
            <div>
              <MiniDiagram title="Read-through" subtitle="cache auto-loads on miss" caption="Read-through pushes the miss-handling into the cache layer itself. The cache becomes smarter but also more coupled to the database schema. Rarely the right call in interviews.">
                <ReadThroughDiagram />
              </MiniDiagram>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          EVICTION
      ════════════════════════════════════ */}
      <section id="eviction" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">Decision 3</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Eviction policy</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          Caches are finite. Something has to leave when the memory fills up. Interviewers rarely drill deep here, but the right answer shows you understand the trade-off.
        </p>
        <DecisionCard
          eyebrow="the decision"
          title="What gets evicted when the cache is full?"
          frame="Every cache has a max-size policy. When a new entry arrives and the cache is full, something must go. The policy determines <em>what</em>. Interviewer expectation: name the policy and justify it based on access patterns."
          options={[
            { name: 'LRU (Least Recently Used)', color: colors.green, pro: 'Matches real-world access patterns for most workloads. Simple, effective, built into Redis.', con: 'Vulnerable to scans — reading every key once fills the cache entirely.', use: 'The default. Start here.' },
            { name: 'LFU (Least Frequently Used)', color: colors.amber, pro: 'Hot keys stay regardless of last access time. Resists scan-based pollution.', con: 'A once-popular key that loses relevance lingers. Needs decay factor.', use: 'Workloads with clear hot/cold skew. Viral content, trending items.' },
            { name: 'FIFO (First In, First Out)', color: colors.red, pro: 'Dead simple. No per-access bookkeeping.', con: 'No consideration of usefulness. Frequently accessed items evicted on age.', use: 'Almost never the right answer. Mention it only to explain why you are not picking it.' },
          ]}
          verdict='&ldquo;LRU with a TTL. LRU handles the finite-memory problem; TTL handles the staleness problem. If I know the workload has hot-key skew, I consider LFU — but I want to measure first.&rdquo;'
        />

        <div className="mt-6">
          <h3 className="text-xl md:text-2xl font-semibold text-blog-text mb-3">Eviction policies at a glance</h3>
          <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0 max-w-[72ch]">
            Interviewers are rarely algorithmic deep-divers here. What they want is a confident recommendation and a brief justification.
          </p>
          <EvictionGrid />
          <div className="mt-5 p-5 md:p-6 rounded-xl border border-blog-border/15 bg-blog-surface">
            <h4 className="font-mono text-[0.72rem] tracking-[0.14em] uppercase text-peach-300 mb-3">the &ldquo;always set a TTL&rdquo; rule</h4>
            <p className="text-blog-muted/70 text-base leading-relaxed max-w-[72ch]">
              TTL is not an eviction policy — it is a <em>safety net</em>. Without a TTL, data that is never evicted by LRU stays forever, even if the underlying data changed. A TTL bounds how stale your cache can be. The right value depends on how fresh the data needs to be: user profiles might tolerate 10 minutes, stock prices tolerate seconds, permissions tolerate minutes. A common staff-level answer: &ldquo;Set a TTL even if LRU would handle memory — the TTL is for data freshness, not memory.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          COMMON PROBLEMS
      ════════════════════════════════════ */}
      <section id="problems" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">The hard parts</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">Common caching problems</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          Interviewers love caching as a honeypot. They nod when you mention Redis, then start digging. These three problems are what they probe. If you bring up caching without showing awareness of these, you look like you have only read the happy path.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <ProblemCard
            title="Cache stampede (thundering herd)"
            cause="A popular cache key expires. 1000 concurrent requests all miss and hit the DB simultaneously."
            impact="Database sees a spike of identical queries, potentially crashing under the sudden load."
            defense="Locking (only one request regenerates, others wait), early recomputation (refresh before expiry), or staggering TTLs with jitter."
          />
          <ProblemCard
            title="Cache consistency"
            cause="Data updates in the database but the cache still serves the old value. Users see stale information."
            impact="UX issues, incorrect decisions based on stale data, potential compliance violations in regulated domains."
            defense="Invalidate cache entries on write (or use write-through for fresh reads), accept short TTLs, or tolerate eventual consistency where appropriate."
          />
          <ProblemCard
            title="Hot keys"
            cause="A single key (e.g., a celebrity profile, viral post) gets disproportionate traffic. Even with a distributed cache, one shard is hammered."
            impact="Uneven load distribution. One cache node saturated while others idle. Request latency spikes for the hot key."
            defense="Local in-process cache as a first layer. Replicate the hot key across multiple shard IDs (key_1, key_2, … key_n) with consistent hashing. Add read replicas and route hot keys separately."
          />
        </div>

        <div className="mt-6">
          <TipCard title="When the cache goes down" accent={colors.red}>
            &ldquo;What happens if Redis crashes?&rdquo; is a standard follow-up. The answer is not &ldquo;we add a replica.&rdquo; The answer is &ldquo;every request hits the database. We need circuit breakers to shed load, a grace period where we serve stale-but-acceptable data, and — eventually — a warm-up strategy that pre-populates the cache before turning it back on.&rdquo; If you mention an in-process cache as a last-resort fallback, you separate yourself from 90% of candidates.
          </TipCard>
        </div>
      </section>

      {/* ════════════════════════════════════
          INTERVIEW STRATEGY
      ════════════════════════════════════ */}
      <section id="strategy" className="mt-16">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-4">The interview</div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-2">When and how to bring up caching</h2>
        <p className="text-blog-muted/60 text-lg leading-[1.8] mb-0">
          Do not front-load it. Jumping to &ldquo;we need Redis&rdquo; in the first two minutes signals that you cargo-cult caching rather than diagnosing a bottleneck. Bring it up at the right moment and walk through it systematically.
        </p>

        <div className="mt-6">
          <h3 className="text-xl md:text-2xl font-semibold text-blog-text mb-3">When to bring it up</h3>
          <p className="text-blog-muted/60 text-lg leading-[1.8] mb-4 max-w-[72ch]">
            Introduce caching when you identify one of these problems:
          </p>
          <div className="bg-blog-surface border border-blog-border/15 rounded-xl p-5">
            <ChecklistItem num="1" label="Read-heavy workload">
              &ldquo;We are serving 10M daily active users, each making 20 requests per day. That is 200M reads hitting the database. Even with indexes, we are looking at 20-50ms per query. A cache drops that to under 2ms and takes load off the database.&rdquo;
            </ChecklistItem>
            <ChecklistItem num="2" label="Expensive queries">
              &ldquo;Computing a user's feed requires joining posts, followers, and likes. That query takes 200ms. We can cache the computed feed for 60 seconds and serve it in 1ms.&rdquo;
            </ChecklistItem>
            <ChecklistItem num="3" label="High database CPU">
              &ldquo;Our database CPU is at 80% during peak — the same queries running over and over. Cache the hot queries and cut DB load by 70-80%.&rdquo;
            </ChecklistItem>
            <ChecklistItem num="4" label="Latency requirements">
              &ldquo;We need sub-10ms response times. Database queries take 30-50ms. We have to cache.&rdquo;
            </ChecklistItem>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xl md:text-2xl font-semibold text-blog-text mb-3">How to introduce it — 5 steps</h3>
          <p className="text-blog-muted/60 text-lg leading-[1.8] mb-4 max-w-[72ch]">
            Once you have identified the bottleneck, walk through your caching strategy in this order:
          </p>
          <div className="bg-blog-surface border border-blog-border/15 rounded-xl p-5">
            <ChecklistItem num="1" label="Identify the bottleneck">
              Be specific: &ldquo;User profile queries are hitting the database 500 times per second during peak. Each takes 30ms. That is our bottleneck.&rdquo;
            </ChecklistItem>
            <ChecklistItem num="2" label="Decide what to cache">
              Not everything. Focus on data that is read frequently, does not change often, and is expensive to compute or fetch.
            </ChecklistItem>
            <ChecklistItem num="3" label="Choose the architecture">
              Cache-aside by default. Write-through for consistency-sensitive data. Mention CDN for media and in-process for hot keys.
            </ChecklistItem>
            <ChecklistItem num="4" label="Set eviction and TTL">
              &ldquo;LRU eviction with a 10-minute TTL on user profiles. That keeps the cache bounded and ensures profiles do not get too stale.&rdquo;
            </ChecklistItem>
            <ChecklistItem num="5" label="Address the downsides">
              Invalidation, stampede, hot keys, cache failure. Pick one or two most relevant to your system and explain your defense. At staff level, focus on the non-obvious ones.
            </ChecklistItem>
          </div>
        </div>

        <div className="mt-6 p-5 md:p-6 rounded-xl border border-blog-border/15 bg-blog-surface">
          <h4 className="font-mono text-[0.72rem] tracking-[0.14em] uppercase text-peach-300 mb-3">the trap: caching everything</h4>
          <p className="text-blog-muted/70 text-base leading-relaxed max-w-[72ch]">
            A common mistake is caching indiscriminately. If you cache data that changes on every write, you are just adding latency and complexity for no benefit. If you cache data that is rarely read, you waste memory that could hold hot data. The staff-level signal is knowing what <em>not</em> to cache: session data that is read once per login, ephemeral states, data that fits in a well-indexed database query under 5ms. Caching is a bet on repetition. If the data is not accessed repeatedly, the bet does not pay off.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════
          SUMMARY
      ════════════════════════════════════ */}
      <section id="summary" className="mt-20">
        <div className="h-px bg-gradient-to-r from-blog-accent/20 via-blog-accent/10 to-transparent mb-10" />
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-4">The cheat sheet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blog-surface border border-blog-border/15 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-blog-text mb-2">Do say</h4>
            <ul className="list-disc pl-5 text-sm text-blog-muted/70 space-y-1.5">
              <li>&ldquo;Cache-aside with Redis, LRU eviction, TTL of N minutes.&rdquo;</li>
              <li>&ldquo;I use write-through for permissions data where stale reads are visible.&rdquo;</li>
              <li>&ldquo;In-process cache as a first layer for the hottest 1% of keys.&rdquo;</li>
              <li>&ldquo;CDN for static media, client cache for browser assets.&rdquo;</li>
              <li>&ldquo;Stampede protection via lock or early recomputation.&rdquo;</li>
              <li>&ldquo;What happens if Redis goes down — circuit breakers and fallback.&rdquo;</li>
            </ul>
          </div>
          <div className="bg-blog-surface border border-blog-border/15 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-blog-text mb-2">Do not say</h4>
            <ul className="list-disc pl-5 text-sm text-blog-muted/70 space-y-1.5">
              <li>&ldquo;We need Redis&rdquo; without identifying the bottleneck first.</li>
              <li>&ldquo;We cache everything.&rdquo;</li>
              <li>&ldquo;TTL handles eviction.&rdquo; (It handles staleness, not memory.)</li>
              <li>&ldquo;Cache invalidation is easy.&rdquo;</li>
              <li>&ldquo;We just add more cache nodes.&rdquo;</li>
              <li>FIFO as your primary eviction policy.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
