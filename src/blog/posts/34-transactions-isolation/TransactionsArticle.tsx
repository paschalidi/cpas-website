import React from 'react';
import SceneCard from './SceneCard';
import MiniAnimation from './MiniAnimation';
import {
  anomalies,
  cols,
  levels,
  solutions,
} from './data';

const pipMap: Record<string, { className: string; label: string }> = {
  on: { className: 'bg-green-600/80 border-green-500', label: 'prevented' },
  off: { className: 'bg-transparent border-red-500/60', label: 'still possible' },
  warn: { className: 'bg-peach-300/40 border-peach-300', label: 'usually prevented' },
};

const matrixSymbols: Record<string, { text: string; className: string }> = {
  on: { text: '\u2713 safe', className: 'text-green-400' },
  off: { text: '\u2717 possible', className: 'text-red-400' },
  warn: { text: '~ usually safe', className: 'text-peach-300' },
};

const solutionAnimMap: Record<string, React.ReactNode> = {
  atomic: <MiniAnimation kind="atomic" />,
  lock: <MiniAnimation kind="lock" />,
  detect: <MiniAnimation kind="detect" />,
  cas: <MiniAnimation kind="cas" />,
  merge: <MiniAnimation kind="merge" />,
};

export default function TransactionsArticle() {
  return (
    <div className="blog-content max-w-none">
      {/* ════════════════════════════════════
          ANOMALIES — 6 interactive scenes
      ════════════════════════════════════ */}
      <section id="anomalies" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Part I \u2014 What goes wrong
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          The anomalies
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-0">
          Each scene runs two transactions against a single value. When they interleave badly,
          something the application assumed turns out to be false. These are the named failure modes.
        </p>

        <div className="mt-2 border-0 border-t border-blog-border/10"></div>

        {anomalies.map((scene) => (
          <SceneCard key={scene.id} scene={scene} />
        ))}
      </section>

      {/* ════════════════════════════════════
          ISOLATION LADDER + MATRIX
      ════════════════════════════════════ */}
      <section id="ladder" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Part II \u2014 The defense
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          The isolation ladder
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          Isolation levels are defined by which anomalies they forbid. Climb the ladder and each rung
          outlaws more \u2014 at the cost of more contention. A filled square means "this bug cannot
          happen."
        </p>

        {/* Ladder rungs — rendered in reverse order (strongest at top) */}
        <div className="flex flex-col gap-0.5 mt-8">
          {[...levels].reverse().map((L) => (
            <div
              key={L.cls}
              className={`grid grid-cols-[1fr_auto] gap-4 items-center px-5 py-4 border border-forest-800/30 bg-forest-900/40 hover:bg-forest-900/60 hover:translate-x-1 transition-all duration-200 cursor-default relative overflow-hidden
                ${L.cls === 'r3' ? 'rounded-t-xl' : ''}
                ${L.cls === 'r0' ? 'rounded-b-xl' : ''}
              `}
            >
              {/* Strength bar */}
              <span
                className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                style={{
                  background:
                    L.cls === 'r0' ? '#7c766a' :
                    L.cls === 'r1' ? '#a78bd6' :
                    L.cls === 'r2' ? '#6fa8e0' :
                    '#4cc4a0',
                }}
              ></span>
              <div>
                <div className="text-lg font-semibold text-blog-text">{L.name}</div>
                <div className="font-mono text-xs text-blog-muted/60">// {L.aka}</div>
              </div>
              <div className="flex gap-1.5">
                {L.pips.map((p, i) => (
                  <span
                    key={i}
                    className={`w-3 h-3 rounded-[3px] border ${pipMap[p].className}`}
                    title={pipMap[p].label}
                  ></span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-5 flex-wrap mt-4 font-mono text-xs text-blog-muted/60">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-green-600/80 border border-green-500 inline-block"></span>
            prevented
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-peach-300/40 border border-peach-300 inline-block"></span>
            usually prevented
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-transparent border border-red-500/60 inline-block"></span>
            still possible
          </span>
        </div>

        {/* Matrix table */}
        <div className="mt-8 border border-forest-800/30 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className="font-mono text-[0.7rem] tracking-wider uppercase text-blog-muted/60 bg-forest-900/40 px-4 py-3.5 text-left border-b border-forest-800/30">
                  Isolation level
                </th>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="font-mono text-[0.7rem] tracking-wider uppercase text-blog-muted/60 bg-forest-900/40 px-4 py-3.5 text-left border-b border-forest-800/30"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {levels.map((L) => (
                <tr key={L.cls}>
                  <td className="px-4 py-3.5 text-left border-b border-forest-800/30 text-base font-semibold text-blog-text">
                    {L.name}
                  </td>
                  {L.pips.map((p, i) => (
                    <td
                      key={i}
                      className="px-4 py-3.5 text-left border-b border-forest-800/30 font-mono text-xs"
                    >
                      <span className={`inline-flex items-center gap-1.5 ${matrixSymbols[p].className}`}>
                        {matrixSymbols[p].text}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════════════════════════════════
          LOST UPDATE SOLUTIONS
      ════════════════════════════════════ */}
      <section id="lost" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Part III \u2014 Your toolbox
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Preventing lost updates
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          When the isolation level isn't enough, the chapter hands you a menu. Each one is a
          different way to stop two read-modify-write cycles from clobbering each other.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {solutions.map((sol) => (
            <div
              key={sol.ic}
              className="rounded-xl border border-forest-800/30 bg-forest-900/40 p-6 hover:border-peach-300/40 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
            >
              <h4 className="text-lg font-semibold text-blog-text mb-1 flex items-center gap-2">
                <span className="font-mono text-peach-300 text-sm">{sol.ic}</span>
                {sol.name}
              </h4>
              <p className="text-blog-muted/70 text-sm leading-relaxed mt-2">{sol.text}</p>
              <code className="font-mono text-xs bg-[#0c0c0b] border border-forest-800/30 rounded-md px-1.5 py-0.5 text-green-400 inline-block mt-1">
                {sol.code}
              </code>
              <div className="h-16 mt-4 rounded-lg bg-[#0c0c0b] border border-forest-800/30 overflow-hidden">
                {solutionAnimMap[sol.anim]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════
          SERIALIZABILITY
      ════════════════════════════════════ */}
      <section id="serial" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Part IV \u2014 The gold standard
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Achieving serializability
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          The strongest guarantee: the result is identical to running transactions one-at-a-time, in{' '}
          <em>some</em> order. Every anomaly above becomes impossible. Three ways databases pull it off.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {/* Actual serial execution */}
          <div className="rounded-xl border border-forest-800/30 bg-forest-900/40 p-6 border-t-[3px] border-t-blue-500/60">
            <h4 className="text-lg font-semibold text-blog-text mb-1">Actual serial execution</h4>
            <div className="font-mono text-[0.68rem] text-blog-muted/60 tracking-wider mb-3">
              VoltDB \u00B7 Redis
            </div>
            <p className="text-blog-muted/70 text-sm leading-relaxed">
              Stop pretending. Run transactions literally one at a time on a single thread. Cheap RAM
              made datasets fit in memory; short OLTP transactions made it fast enough. Often shipped as
              stored procedures so nothing waits on the network mid-transaction.
            </p>
            <div className="mt-3 pt-3 border-t border-forest-800/30 text-xs text-blog-muted/70">
              <span className="font-mono text-[0.66rem] tracking-wider uppercase text-peach-300 block mb-0.5">
                Trade-off
              </span>
              Throughput capped at one CPU core. Great until you outgrow a single core.
            </div>
          </div>

          {/* Two-phase locking */}
          <div className="rounded-xl border border-forest-800/30 bg-forest-900/40 p-6 border-t-[3px] border-t-violet-500/60">
            <h4 className="text-lg font-semibold text-blog-text mb-1">Two-phase locking</h4>
            <div className="font-mono text-[0.68rem] text-blog-muted/60 tracking-wider mb-3">
              2PL \u00B7 the 30-year classic
            </div>
            <p className="text-blog-muted/70 text-sm leading-relaxed">
              Readers and writers block each other with shared and exclusive locks, held until commit.
              Phantoms are caught with predicate locks (or the practical index-range lock) that lock
              rows matching a condition \u2014 even rows that don't exist yet.
            </p>
            <div className="mt-3 pt-3 border-t border-forest-800/30 text-xs text-blog-muted/70">
              <span className="font-mono text-[0.66rem] tracking-wider uppercase text-peach-300 block mb-0.5">
                Trade-off
              </span>
              Lots of waiting, reduced concurrency, frequent deadlocks forcing aborts and retries.
            </div>
          </div>

          {/* Serializable snapshot isolation */}
          <div className="rounded-xl border border-forest-800/30 bg-forest-900/40 p-6 border-t-[3px] border-t-green-500/60">
            <h4 className="text-lg font-semibold text-blog-text mb-1">Serializable snapshot isolation</h4>
            <div className="font-mono text-[0.68rem] text-blog-muted/60 tracking-wider mb-3">
              SSI \u00B7 PostgreSQL \u00B7 since 2008
            </div>
            <p className="text-blog-muted/70 text-sm leading-relaxed">
              Optimistic. Transactions run freely on a snapshot, like snapshot isolation. The database
              tracks read-write dependencies and, at commit, aborts any transaction whose reads were
              invalidated by another. Bet that conflicts are rare \u2014 usually they are.
            </p>
            <div className="mt-3 pt-3 border-t border-forest-800/30 text-xs text-blog-muted/70">
              <span className="font-mono text-[0.66rem] tracking-wider uppercase text-peach-300 block mb-0.5">
                Trade-off
              </span>
              Aborts and retries under high contention, but far less blocking than 2PL.
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          FOOTER
      ════════════════════════════════════ */}
      <footer className="mt-20 pt-10 border-t border-forest-800/30 pb-16">
        <p className="text-blog-muted/60 text-sm leading-relaxed max-w-[640px]">
          <strong className="text-blog-muted/80">The throughline.</strong> Weak isolation levels are popular
          because they're fast \u2014 but they quietly move the burden of preventing these anomalies onto you,
          the developer. Getting every <code className="text-green-400">SELECT \u2026 FOR UPDATE</code> and
          compare-and-set right by hand is exactly the subtle, hard-to-test work that breeds bugs.
          Serializability moves that burden back into the database. The whole chapter is an argument about
          where that burden should live.
          <br /><br />
          <span className="text-blog-muted/40 text-xs">
            A visual companion to Chapter 8 of <em>Designing Data-Intensive Applications</em> by Martin
            Kleppmann. Built to be read, replayed, and remembered.
          </span>
        </p>
      </footer>
    </div>
  );
}
