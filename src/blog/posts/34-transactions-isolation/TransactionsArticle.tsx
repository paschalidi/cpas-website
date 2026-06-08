import React from 'react';
import SceneCard from './SceneCard';
import MiniAnimation from './MiniAnimation';
import DecisionCard from '../../components/DecisionCard';
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
  on: { text: '✓ safe', className: 'text-green-400' },
  off: { text: '✗ possible', className: 'text-red-400' },
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
          Part I — What goes wrong
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
          Part II — The defense
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          The isolation ladder
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          Isolation levels are defined by which anomalies they forbid. Climb the ladder and each rung
          outlaws more — at the cost of more contention. A filled square means "this bug cannot
          happen."
        </p>

        {/* Ladder rungs — rendered in reverse order (strongest at top) */}
        <div className="flex flex-col gap-0.5 mt-8">
          {[...levels].reverse().map((L) => (
            <div
              key={L.cls}
              className={`grid grid-cols-[1fr_auto] gap-4 items-center px-5 py-4 border border-blog-border/15 bg-forest-925/40 relative overflow-hidden
                ${L.cls === 'r3' ? 'rounded-t-xl' : ''}
                ${L.cls === 'r0' ? 'rounded-b-xl' : ''}
              `}
            >
              {/* Strength bar */}
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-blog-accent rounded-r"></span>
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
        <div className="mt-8 border border-blog-border/15 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className="font-mono text-[0.7rem] tracking-wider uppercase text-blog-muted/60 bg-forest-925/40 px-4 py-3.5 text-left border-b border-blog-border/15">
                  Isolation level
                </th>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="font-mono text-[0.7rem] tracking-wider uppercase text-blog-muted/60 bg-forest-925/40 px-4 py-3.5 text-left border-b border-blog-border/15"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {levels.map((L) => (
                <tr key={L.cls}>
                  <td className="px-4 py-3.5 text-left border-b border-blog-border/15 text-base font-semibold text-blog-text">
                    {L.name}
                  </td>
                  {L.pips.map((p, i) => (
                    <td
                      key={i}
                      className="px-4 py-3.5 text-left border-b border-blog-border/15 font-mono text-xs"
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
          Part III — Your toolbox
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
              className="rounded-xl border border-blog-border/15 bg-forest-925/40 p-6 hover:border-peach-300/40 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
            >
              <h4 className="text-lg font-semibold text-blog-text mb-1 flex items-center gap-2">
                <span className="font-mono text-peach-300 text-sm">{sol.ic}</span>
                {sol.name}
              </h4>
              <p className="text-blog-muted/70 text-sm leading-relaxed mt-2">{sol.text}</p>
              <code className="font-mono text-xs bg-[#0c0c0b] border border-blog-border/15 rounded-md px-1.5 py-0.5 text-green-400 inline-block mt-1">
                {sol.code}
              </code>
              <div className="h-16 mt-4 rounded-lg bg-[#0c0c0b] border border-blog-border/15 overflow-hidden">
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
          Part IV — The gold standard
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Achieving serializability
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          The strongest guarantee: the result is identical to running transactions one-at-a-time, in{' '}
          <em>some</em> order. Every anomaly above becomes impossible. Three ways databases pull it off.
        </p>

        <div className="flex flex-col gap-5 mt-8">
          <DecisionCard
            eyebrow="approach"
            title="Actual serial execution"
            frame="Stop pretending. Run transactions literally one at a time on a single thread. Cheap RAM made datasets fit in memory; short OLTP transactions made it fast enough. Often shipped as stored procedures so nothing waits on the network mid-transaction."
            options={[{
              name: 'Actual serial',
              color: '#3b82f6',
              pro: 'No concurrency bugs, no coordination, predictable performance.',
              con: 'Throughput capped at one CPU core.',
              use: 'Dataset fits in memory, transactions are short OLTP. VoltDB, Redis.',
            }]}
            verdict="The easiest concurrency model is no concurrency. Great until you outgrow a single core."
          />

          <DecisionCard
            eyebrow="approach"
            title="Two-phase locking"
            frame="Readers and writers block each other with shared and exclusive locks, held until commit. Phantoms are caught with predicate locks (or the practical index-range lock) that lock rows matching a condition &mdash; even rows that don&rsquo;t exist yet."
            options={[{
              name: '2PL',
              color: '#a78bd6',
              pro: 'Proven track record, wide support, intuitive semantics (lock&nbsp;=&nbsp;exclusive access).',
              con: 'Lots of waiting, reduced concurrency, frequent deadlocks forcing aborts and retries.',
              use: 'Standard approach for serializability when conflicts are moderate. Oracle, SQL&nbsp;Server.',
            }]}
            verdict="The 30-year classic. It works, but blocking and deadlocks are the price."
          />

          <DecisionCard
            eyebrow="approach"
            title="Serializable snapshot isolation"
            frame="Optimistic. Transactions run freely on a snapshot, like snapshot isolation. The database tracks read-write dependencies and, at commit, aborts any transaction whose reads were invalidated by another. It bets that conflicts are rare &mdash; usually they are."
            options={[{
              name: 'SSI',
              color: '#4cc4a0',
              pro: 'No blocking for readers or writers during execution. Great throughput under low-to-moderate contention.',
              con: 'Aborts and retries under high contention. Can waste work when conflicts are frequent.',
              use: 'Best default for serializability. PostgreSQL (since&nbsp;2008), FoundationDB.',
            }]}
            verdict="The modern default. Optimistic concurrency works because most transactions don&rsquo;t conflict."
          />
        </div>
      </section>

      {/* ════════════════════════════════════
          FOOTER
      ════════════════════════════════════ */}
      <footer className="mt-20 pt-10 border-t border-blog-border/15 pb-16">
        <p className="text-blog-muted/60 text-sm leading-relaxed max-w-[640px]">
          <strong className="text-blog-muted/80">The throughline.</strong> Weak isolation levels are popular
          because they're fast — but they quietly move the burden of preventing these anomalies onto you,
          the developer. Getting every <code className="text-green-400">SELECT … FOR UPDATE</code> and
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
