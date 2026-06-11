import AnimationShell from "./AnimationShell";
import { VizDefs, Arrow, Txt, Badge } from "./viz";

/**
 * MVCC, version by version: one row evolving as a chain of immutable versions,
 * with readers pinned to their snapshots.
 */

const steps = [
  {
    caption: (
      <>
        Under <strong>MVCC</strong> (multi-version concurrency control) the database
        never overwrites a row in place. Each version records which transaction{" "}
        <em>created</em> it and which (if any) <em>deleted</em> it. Here: one row,
        version v1, created by txn 10, alive. Every transaction gets a monotonically
        increasing ID.
      </>
    ),
  },
  {
    caption: (
      <>
        Reader <strong>R (txid 25)</strong> begins and takes a <em>snapshot</em>: the
        set of transactions that had committed when R started. Everything R reads for
        its whole lifetime is judged against this frozen list.
      </>
    ),
  },
  {
    caption: (
      <>
        Writer <strong>W (txid 30)</strong> updates the row. No overwrite: W creates{" "}
        <strong>v2</strong> (created_by=30) and stamps v1 as deleted_by=30. An update
        is a delete + create. Both versions now coexist on disk.
      </>
    ),
  },
  {
    caption: (
      <>
        R reads the row. <strong>Visibility rule:</strong> a version is visible if its
        creator committed <em>before my snapshot</em>, and it isn&apos;t deleted by such
        a transaction. Txn 30 isn&apos;t in R&apos;s snapshot → v2 invisible, v1&apos;s
        deletion invisible → <strong>R sees v1</strong>. Writers never blocked R;
        R never blocked W.
      </>
    ),
  },
  {
    caption: (
      <>
        W commits. A <em>new</em> reader R2 (txid 35) snapshots now and sees v2. But R,
        still inside its transaction, re-reads and <strong>still sees v1</strong> —
        same snapshot, same answer. That stability is exactly what &ldquo;repeatable
        read&rdquo; / snapshot isolation promises, and why backups and long analytics
        queries get a consistent view.
      </>
    ),
  },
  {
    caption: (
      <>
        Another writer (txid 40) updates again → <strong>v3</strong>. The chain grows:
        v1 → v2 → v3. Old versions must be kept as long as <em>any</em> active snapshot
        might need them — this is why a forgotten long-running transaction bloats
        storage.
      </>
    ),
  },
  {
    caption: (
      <>
        R finally commits. No active snapshot can see v1 or v2 anymore, so a background
        process (<strong>vacuum</strong> in PostgreSQL, purge in InnoDB) garbage-collects
        them. The whole trade in one line: <em>readers don&apos;t block writers,
        writers don&apos;t block readers — paid for with version chains and GC.</em>
      </>
    ),
  },
];

function VersionBox({
  x,
  show,
  v,
  createdBy,
  deletedBy,
  dead,
  highlight,
}: {
  x: number;
  show: boolean;
  v: string;
  createdBy: number;
  deletedBy?: number;
  dead?: boolean;
  highlight?: boolean;
}) {
  return (
    <g className="tr" opacity={show ? (dead ? 0.35 : 1) : 0}>
      <rect
        x={x}
        y={64}
        width={150}
        height={86}
        rx={10}
        fill={highlight ? "color-mix(in srgb, var(--accent) 12%, var(--bg))" : "var(--bg)"}
        stroke={highlight ? "var(--accent)" : "var(--line-strong)"}
        strokeWidth={highlight ? 1.8 : 1.2}
        className="tr"
      />
      <Txt x={x + 14} y={88} size={13} weight={700} tone="ink" mono>
        {v}
      </Txt>
      <Txt x={x + 14} y={110} size={10.5} mono>
        created_by: {createdBy}
      </Txt>
      <Txt x={x + 14} y={128} size={10.5} mono tone={deletedBy ? "bad" : "mut"}>
        deleted_by: {deletedBy ?? "∅"}
      </Txt>
      {dead ? (
        <line x1={x + 6} y1={144} x2={x + 144} y2={70} stroke="var(--bad)" strokeWidth={1.4} className="tr" />
      ) : null}
    </g>
  );
}

function ReaderToken({
  x,
  y,
  label,
  snapshot,
  show,
  targetX,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  snapshot: string;
  show: boolean;
  targetX?: number;
  tone: "info" | "ok";
}) {
  return (
    <g className="tr" opacity={show ? 1 : 0}>
      <rect x={x} y={y} width={170} height={40} rx={8} fill="var(--bg)" stroke={`var(--${tone})`} strokeWidth={1.4} />
      <Txt x={x + 12} y={y + 17} size={11} weight={700} tone="ink">
        {label}
      </Txt>
      <Txt x={x + 12} y={y + 32} size={9.5} mono>
        {snapshot}
      </Txt>
      {targetX !== undefined ? (
        <Arrow x1={x + 85} y1={y - 2} x2={targetX} y2={156} tone={tone} show label="sees" />
      ) : null}
    </g>
  );
}

export default function MvccVisualizer() {
  return (
    <AnimationShell
      title="Snapshot isolation and MVCC, version by version"
      subtitle="one row, many versions, zero blocking"
      steps={steps}
    >
      {(step) => {
        const v2 = step >= 2;
        const v3 = step >= 5;
        const gc = step >= 6;
        const wCommitted = step >= 4;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="MVCC version chain diagram">
            <VizDefs />

            <Txt x={16} y={30} size={11} weight={700} tone="ink">
              row &ldquo;post 42&rdquo; — version chain
            </Txt>

            {/* version chain */}
            <VersionBox x={40} show v="v1 · “Hello”" createdBy={10} deletedBy={v2 ? 30 : undefined} dead={gc} highlight={step === 3} />
            <g className="tr" opacity={v2 ? 1 : 0}>
              <Arrow x1={190} y1={107} x2={240} y2={107} tone="mut" show={v2} />
            </g>
            <VersionBox x={244} show={v2} v="v2 · “Hi all”" createdBy={30} deletedBy={v3 ? 40 : undefined} dead={gc} highlight={step === 4} />
            <g className="tr" opacity={v3 ? 1 : 0}>
              <Arrow x1={394} y1={107} x2={444} y2={107} tone="mut" show={v3} />
            </g>
            <VersionBox x={448} show={v3} v="v3 · “Hey all”" createdBy={40} highlight={v3} />

            {/* writer state */}
            <g className="tr" opacity={step >= 2 ? 1 : 0}>
              <Badge x={319} y={44} label={wCommitted ? "W (txid 30): committed ✓" : "W (txid 30): in progress…"} tone={wCommitted ? "ok" : "warn"} />
            </g>

            {/* readers */}
            <ReaderToken
              x={40}
              y={196}
              label="Reader R · txid 25"
              snapshot="snapshot: committed ≤ txn 10…25"
              show={step >= 1 && step < 6}
              targetX={step >= 3 && step < 6 ? 115 : undefined}
              tone="info"
            />
            <ReaderToken
              x={264}
              y={196}
              label="Reader R2 · txid 35"
              snapshot="snapshot includes txn 30 ✓"
              show={step >= 4}
              targetX={step >= 4 ? 319 : undefined}
              tone="ok"
            />

            {/* GC note */}
            <g className="tr" opacity={gc ? 1 : 0}>
              <Badge x={150} y={285} label="vacuum: v1, v2 reclaimed" tone="ok" />
              <Txt x={290} y={289} size={10.5}>
                no live snapshot can see them anymore
              </Txt>
            </g>

            {/* visibility rule panel */}
            <g className="tr" opacity={step === 3 ? 1 : 0}>
              <rect x={470} y={186} width={236} height={92} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.4} />
              <Txt x={484} y={208} size={10} weight={700} tone="acc" mono>
                VISIBILITY RULE
              </Txt>
              <Txt x={484} y={228} size={10}>
                visible iff created_by committed
              </Txt>
              <Txt x={484} y={244} size={10}>
                before my snapshot, and not
              </Txt>
              <Txt x={484} y={260} size={10}>
                deleted by such a txn
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
