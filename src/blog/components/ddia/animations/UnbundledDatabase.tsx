import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * The unbundled database: inside one DB, a write updates indexes
 * transactionally; across an organization, an ordered log plays the role of
 * the WAL and every specialized system becomes an index.
 */

const steps = [
  {
    caption: (
      <>
        Inside a single database, look what one <code>UPDATE</code> quietly
        does: write the WAL, change the heap, fix the B-tree, refresh a
        materialized view — all <strong>transactionally, in one agreed
        order</strong>. A database is a bundle: storage + indexes + views +
        a log that keeps them in lockstep. That bundle is the product.
      </>
    ),
  },
  {
    caption: (
      <>
        But no single product wins at everything, so a real organization runs
        the bundle&apos;s components as <em>separate systems</em>: an OLTP store,
        a search engine, a cache, a warehouse. Squint: these are{" "}
        <strong>indexes of the same data</strong> — scattered across vendors,
        with the lockstep mechanism… missing.
      </>
    ),
  },
  {
    caption: (
      <>
        Gluing them with application dual-writes re-creates chapter 11&apos;s
        trap: no shared order, no atomicity, silent divergence. The unbundling
        idea: give the scattered components what the database&apos;s internals
        had — <strong>one ordered log of changes</strong> that everything
        subscribes to.
      </>
    ),
  },
  {
    caption: (
      <>
        The assembled machine: apps write to the system of record; CDC publishes
        its commits into the log; search, cache, and warehouse each consume{" "}
        <em>the same sequence in the same order</em>, at their own pace. It is a
        database turned inside out — log as WAL, systems as indexes, the
        org&apos;s data flow as the query planner&apos;s pipeline.
      </>
    ),
  },
  {
    caption: (
      <>
        Why the order matters so much: a totally ordered, durable log is the
        same primitive as chapter 9&apos;s <strong>total order broadcast</strong>{" "}
        — and applying a log deterministically is state machine replication.
        The views don&apos;t need distributed transactions to agree; they need
        the <em>same inputs in the same order</em>, and convergence follows.
        Asynchrony is the price: each view trails by its own lag.
      </>
    ),
  },
  {
    caption: (
      <>
        What unbundling buys: <strong>loose coupling</strong> — add a new view
        next year by replaying the log from zero, touching no writers;{" "}
        <strong>best-of-breed</strong> components; <strong>failure
        isolation</strong> — a slow warehouse never blocks checkout writes; and
        every view is disposable, because the log can rebuild it.
      </>
    ),
  },
  {
    caption: (
      <>
        The honest invoice: views lag, so <em>cross-view read-your-writes</em>{" "}
        isn&apos;t free (write to DB, search for it instantly — miss); there are
        no transactions <em>across</em> views; the log is now tier-zero
        infrastructure; and event schemas become a public API governed by
        chapter 4&apos;s rules. Unbundling doesn&apos;t abolish the database —
        it asks you to <em>be</em> one, deliberately, at organization scale.
      </>
    ),
  },
];

export default function UnbundledDatabase() {
  return (
    <AnimationShell
      title="The unbundled database"
      subtitle="log as the WAL of the whole organization"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const inside = step === 0;
        const scattered = step === 1 || step === 2;
        const assembled = step >= 3;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Unbundled database diagram">
            <VizDefs />

            {inside && (
              <g>
                <rect x={130} y={36} width={460} height={230} rx={14} fill="none" stroke="var(--line-strong)" strokeDasharray="5 5" />
                <Txt x={150} y={62} size={10} mono weight={700} tone="mut">ONE DATABASE (the bundle)</Txt>
                <NodeBox x={160} y={84} w={150} h={48} label="WAL" sub="ordered changes" tone="acc" />
                <NodeBox x={410} y={84} w={150} h={48} label="heap / rows" sub="primary storage" tone="default" />
                <NodeBox x={160} y={176} w={150} h={48} label="B-tree index" sub="kept in lockstep" tone="default" />
                <NodeBox x={410} y={176} w={150} h={48} label="materialized view" sub="kept in lockstep" tone="default" />
                <Arrow x1={310} y1={108} x2={406} y2={108} tone="acc" show />
                <Arrow x1={235} y1={132} x2={235} y2={172} tone="acc" show />
                <Arrow x1={485} y1={132} x2={485} y2={172} tone="acc" show />
                <Badge x={360} y={290} label="one UPDATE → all of these, atomically, in one order" tone="ok" />
              </g>
            )}

            {scattered && (
              <g>
                <NodeBox x={40} y={50} w={150} h={52} label="OLTP store" sub="orders, users" tone="acc" />
                <NodeBox x={530} y={50} w={150} h={52} label="search engine" sub="full-text" tone="default" />
                <NodeBox x={40} y={190} w={150} h={52} label="cache" sub="hot reads" tone="default" />
                <NodeBox x={530} y={190} w={150} h={52} label="warehouse" sub="analytics" tone="default" />
                <Txt x={360} y={130} size={11} anchor="middle" tone="mut" weight={600}>
                  same data, four vendors — indexes without a database around them
                </Txt>
                {step === 2 && (
                  <>
                    <NodeBox x={285} y={142} w={150} h={52} label="app" sub="writes to all four?" tone="bad" />
                    <Arrow x1={285} y1={160} x2={194} y2={84} tone="bad" show dashed />
                    <Arrow x1={435} y1={160} x2={526} y2={84} tone="bad" show dashed />
                    <Arrow x1={285} y1={184} x2={194} y2={208} tone="bad" show dashed />
                    <Arrow x1={435} y1={184} x2={526} y2={208} tone="bad" show dashed />
                    <Badge x={360} y={282} label="dual writes: no shared order, no atomicity (ch 11)" tone="bad" />
                  </>
                )}
              </g>
            )}

            {assembled && (
              <g>
                <NodeBox x={16} y={40} w={130} h={50} label="apps" sub="write once" tone="default" />
                <NodeBox x={186} y={40} w={160} h={50} label="system of record" sub="OLTP DB" tone="acc" />
                <Arrow x1={146} y1={65} x2={182} y2={65} tone="acc" show />

                <rect x={186} y={132} width={348} height={42} rx={8} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.5} />
                <Txt x={200} y={148} size={9} mono weight={700} tone="acc">THE LOG — total order of changes</Txt>
                <Txt x={200} y={164} size={10} mono>[e1][e2][e3][e4][e5] →</Txt>
                <Arrow x1={266} y1={90} x2={266} y2={128} tone="acc" show label="CDC" />

                <NodeBox x={580} y={36} w={128} h={46} label="search" sub={step >= 4 ? "applies e1…e5" : "consumes"} tone="ok" />
                <NodeBox x={580} y={108} w={128} h={46} label="cache" sub={step >= 4 ? "applies e1…e5" : "consumes"} tone="ok" />
                <NodeBox x={580} y={180} w={128} h={46} label="warehouse" sub={step >= 4 ? "applies e1…e4 (lag)" : "consumes"} tone={step >= 4 ? "warn" : "ok"} />
                <Arrow x1={534} y1={146} x2={576} y2={62} tone="ok" show />
                <Arrow x1={534} y1={152} x2={576} y2={130} tone="ok" show />
                <Arrow x1={534} y1={160} x2={576} y2={202} tone="warn" show dashed />

                <g className="tr" opacity={step === 4 ? 1 : 0}>
                  <Badge x={300} y={216} label="same inputs, same order ⇒ convergence — this is total order broadcast (ch 9)" tone="info" />
                </g>
                <g className="tr" opacity={step === 5 ? 1 : 0}>
                  <NodeBox x={580} y={250} w={128} h={46} label="next year's view" sub="replay from e1 ✓" tone="info" />
                  <Arrow x1={400} y1={174} x2={576} y2={266} tone="info" show dashed curve={30} label="rebuildable" />
                  <Badge x={250} y={246} label="loose coupling · best-of-breed · slow view ≠ blocked writes" tone="ok" />
                </g>
                <g className="tr" opacity={step === 6 ? 1 : 0}>
                  <rect x={16} y={232} width={520} height={66} rx={10} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
                  <Txt x={32} y={252} size={9.5} mono weight={700} tone="warn">THE INVOICE</Txt>
                  <Txt x={32} y={270} size={10.5}>views lag (no cross-view read-your-writes) · no cross-view transactions</Txt>
                  <Txt x={32} y={288} size={10.5}>the log = tier-zero infra · event schemas = public API (ch 4 rules)</Txt>
                </g>
              </g>
            )}
          </svg>
        );
      }}
    </AnimationShell>
  );
}
