import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Dual writes vs change data capture: why "the app updates everything"
 * silently diverges, and how tailing the database's log fixes it.
 */

const steps = [
  {
    caption: (
      <>
        Real systems keep the same fact in several places: the{" "}
        <strong>database</strong> (truth), a <strong>search index</strong>, a{" "}
        <strong>cache</strong>. A product&apos;s price changes — all three must
        learn. The obvious code: the app writes to each system, one after
        another. This is the <strong>dual-write</strong> pattern, and it is a
        trap with two doors.
      </>
    ),
  },
  {
    caption: (
      <>
        Door 1 — the <strong>race</strong>: two concurrent updates set the price
        to <code>$30</code> and <code>$25</code>. The database happens to apply
        30-then-25; the search index, on its own network schedule, applies
        25-then-30. Final state: DB says <strong>$25</strong>, search says{" "}
        <strong>$30</strong> — <em>permanently</em>, with no error logged
        anywhere. Two independent destinations, no shared ordering.
      </>
    ),
  },
  {
    caption: (
      <>
        Door 2 — the <strong>partial failure</strong>: the app writes the DB,
        then crashes before updating the cache. The cache serves the old price
        until something happens to evict it. There&apos;s no transaction
        spanning Postgres, Elasticsearch, and Redis — atomic commit across
        heterogeneous systems (2PC) is rarely available and operationally
        painful (chapter 9&apos;s in-doubt limbo). Dual writes have neither
        ordering nor atomicity.
      </>
    ),
  },
  {
    caption: (
      <>
        The fix is a change of topology, not more retries: appoint{" "}
        <strong>one</strong> system the writer-of-record (the DB), and let every
        other copy be <em>derived from its log</em>. The DB already serializes
        writes internally — its replication log is a perfect, totally-ordered
        record of every change. We just need to get it out.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Change data capture (CDC)</strong>: a connector tails the
        database&apos;s logical replication log — posing as a replica — and
        publishes each row change as an event into a durable log (one partition
        per table key-range keeps per-key order). The app now writes to{" "}
        <em>one</em> place; the pipeline fans out.
      </>
    ),
  },
  {
    caption: (
      <>
        Both price updates flow through in <strong>database commit order</strong>{" "}
        — 30, then 25 — and every consumer applies them in that same order:
        search and cache converge on <code>$25</code>, matching the DB. A
        crashed consumer resumes at its offset; a <em>new</em> consumer
        bootstraps from a snapshot plus the log — or, with{" "}
        <strong>log compaction</strong> (keep the latest event per key), from
        the compacted log alone.
      </>
    ),
  },
  {
    caption: (
      <>
        Cousin pattern when you can&apos;t tail the log, or want richer events
        than row diffs: the <strong>transactional outbox</strong>. The app
        writes the business row <em>and</em> an event row into an outbox table{" "}
        <strong>in one local ACID transaction</strong>; a relay publishes the
        outbox to the stream. Atomicity borrowed from the only place it&apos;s
        cheap — a single database — no distributed transaction required.
      </>
    ),
  },
  {
    caption: (
      <>
        Zoom out and the architecture inverts: the log of changes becomes the
        spine, and database, search, cache are all just <em>views</em> —
        materializations — hanging off it. Push the idea further and you store
        the events themselves as truth (<strong>event sourcing</strong>:
        immutable intents, state rebuilt by folding them). Either way the slogan
        holds: <em>state is a cache of the log; the log can rebuild any
        state</em>. Chapter 12 runs with this.
      </>
    ),
  },
];

export default function CdcOutbox() {
  return (
    <AnimationShell
      title="Dual writes vs change data capture"
      subtitle="one writer-of-record, everything else derived in order"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const dual = step <= 2;
        const race = step === 1;
        const partial = step === 2;
        const cdc = step >= 4;
        const outbox = step === 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Dual write vs CDC diagram">
            <VizDefs />

            {dual ? (
              <g>
                <Txt x={16} y={28} size={11} mono weight={700} tone="bad">PATTERN UNDER TEST · DUAL WRITES</Txt>
                <NodeBox x={16} y={120} w={150} h={56} label="app" sub={race ? "two updates: $30, $25" : partial ? "wrote DB… crashed ✗" : "writes everywhere"} tone={partial ? "bad" : "acc"} fillTone={partial ? "bad" : undefined} />
                <NodeBox x={420} y={36} w={180} h={52} label="database (truth)" sub={race ? "30 → 25 ⇒ $25" : partial ? "$25 ✓" : "$30"} tone="ok" />
                <NodeBox x={420} y={126} w={180} h={52} label="search index" sub={race ? "25 → 30 ⇒ $30 ✗" : partial ? "$30 (never told)" : "$30"} tone={race || partial ? "bad" : "default"} />
                <NodeBox x={420} y={216} w={180} h={52} label="cache" sub={partial ? "$30 stale ✗" : race ? "…either…" : "$30"} tone={partial ? "bad" : "default"} />

                <Arrow x1={166} y1={134} x2={416} y2={64} tone="acc" show label={race ? "order: 30,25" : "write"} />
                <Arrow x1={166} y1={148} x2={416} y2={150} tone={race ? "bad" : partial ? "bad" : "acc"} show label={race ? "order: 25,30 ?!" : partial ? "✗ never sent" : "write"} dashed={partial} />
                <Arrow x1={166} y1={162} x2={416} y2={238} tone={partial ? "bad" : "acc"} show dashed={partial} label={partial ? "✗ never sent" : "write"} labelDy={12} />

                <Badge x={330} y={290} label={race ? "no shared order: DB $25, search $30 — forever, silently" : partial ? "no atomicity: DB new, cache stale — until luck intervenes" : "three destinations, three fates"} tone={step >= 1 ? "bad" : "info"} show />
              </g>
            ) : (
              <g>
                <Txt x={16} y={28} size={11} mono weight={700} tone="acc">{outbox ? "VARIANT · TRANSACTIONAL OUTBOX" : "PATTERN THAT WORKS · CHANGE DATA CAPTURE"}</Txt>

                <NodeBox x={16} y={70} w={130} h={52} label="app" sub={outbox ? "1 local txn" : "writes DB only"} tone="acc" />
                <NodeBox x={186} y={70} w={170} h={52} label="database" sub={outbox ? "row + outbox event" : "commit order: 30, 25"} tone="ok" />
                <Arrow x1={146} y1={96} x2={182} y2={96} tone="acc" show />

                {/* log */}
                <rect x={186} y={158} width={340} height={44} rx={8} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.4} className="tr" opacity={cdc || outbox ? 1 : 0.3} />
                <Txt x={200} y={174} size={9} mono tone="acc" weight={700}>CHANGE LOG (ordered, durable)</Txt>
                <Txt x={200} y={192} size={10} mono>[price=30] [price=25] [stock=4] …</Txt>
                <Arrow x1={271} y1={122} x2={271} y2={154} tone="acc" show label={outbox ? "relay reads outbox" : "CDC tails WAL"} />

                {/* consumers */}
                <NodeBox x={560} y={70} w={144} h={48} label="search index" sub={step >= 5 ? "$25 ✓ (log order)" : "subscribes"} tone={step >= 5 ? "ok" : "default"} />
                <NodeBox x={560} y={142} w={144} h={48} label="cache" sub={step >= 5 ? "$25 ✓ (log order)" : "subscribes"} tone={step >= 5 ? "ok" : "default"} />
                <NodeBox x={560} y={214} w={144} h={48} label="warehouse / next thing" sub={step >= 5 ? "replays from 0" : ""} tone={step >= 5 ? "info" : "mut"} dim={step < 5} />
                <Arrow x1={526} y1={172} x2={556} y2={96} tone="ok" show={cdc || outbox} />
                <Arrow x1={526} y1={180} x2={556} y2={164} tone="ok" show={cdc || outbox} />
                <Arrow x1={526} y1={190} x2={556} y2={236} tone="info" show={step >= 5} dashed />

                <g className="tr" opacity={step === 4 ? 1 : 0}>
                  <Badge x={330} y={240} label="connector poses as a replica · per-key order kept via partitioning" tone="info" />
                </g>
                <g className="tr" opacity={step === 5 ? 1 : 0}>
                  <Badge x={330} y={240} label="everyone applies the SAME order → convergence · compaction keeps latest-per-key" tone="ok" />
                </g>
                <g className="tr" opacity={outbox ? 1 : 0}>
                  <rect x={16} y={236} width={500} height={62} rx={10} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.3} />
                  <Txt x={32} y={256} size={10.5} mono>BEGIN; UPDATE product SET price=25;</Txt>
                  <Txt x={32} y={272} size={10.5} mono>INSERT INTO outbox VALUES (price_changed, 25); COMMIT;</Txt>
                  <Txt x={32} y={290} size={10} tone="mut">atomicity from one DB — no 2PC, no lost events</Txt>
                </g>
                <g className="tr" opacity={step === 7 ? 1 : 0}>
                  <rect x={16} y={236} width={688} height={62} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
                  <Txt x={32} y={258} size={10.5} tone="acc" weight={600}>
                    the inversion: DB, search, cache = materialized views; the log = the spine
                  </Txt>
                  <Txt x={32} y={280} size={10.5}>
                    event sourcing pushes further: store the events as truth · state is a cache of the log — rebuildable, always
                  </Txt>
                </g>
              </g>
            )}
          </svg>
        );
      }}
    </AnimationShell>
  );
}
