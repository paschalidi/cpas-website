
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Two roads to serializability on the same workload:
 *   T1: read X, then write Y     T2: read Y, then write X
 * Pessimistic (strict 2PL) blocks and deadlocks; optimistic (SSI) runs free
 * and aborts at commit. Left/right halves; the inactive half is dimmed.
 */

const steps = [
  {
    caption: (
      <>
        Same workload, two engines. <strong>T1</strong> reads X then writes Y;{" "}
        <strong>T2</strong> reads Y then writes X. Run concurrently and unchecked,
        these can interleave into a result no serial order could produce. Two
        strategies promise to stop that: lock everything (2PL) or check at the end
        (SSI).
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Two-phase locking,</strong> step 1: reads take <em>shared</em> locks.
        T1 locks S(X), T2 locks S(Y). Many readers can share a lock; writers need an
        exclusive one. Locks are held until commit (&ldquo;strict&rdquo; 2PL) — that
        holding-until-the-end is what makes it two-phase.
      </>
    ),
  },
  {
    caption: (
      <>
        T1 now wants to write Y → needs X(Y), but T2 holds S(Y).{" "}
        <strong>T1 blocks.</strong> Under 2PL, readers block writers and writers block
        readers — this is the price of pessimism.
      </>
    ),
  },
  {
    caption: (
      <>
        T2 wants to write X → needs X(X), but T1 holds S(X). Now each waits for the
        other: <strong>deadlock</strong>. The lock manager&apos;s cycle detector picks a
        victim…
      </>
    ),
  },
  {
    caption: (
      <>
        T2 is aborted and will retry; its locks release; T1&apos;s write proceeds and
        commits. Correctness achieved — with blocking, queueing behind locks, deadlock
        machinery, and fragile latency (one slow lock-holder stalls a convoy).
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Serializable snapshot isolation,</strong> same workload. Both
        transactions read from their MVCC snapshots <em>without taking any blocking
        locks</em> — full speed, no waiting. The engine just records what each txn
        read (PostgreSQL&apos;s SIREAD locks: bookkeeping, not blocking).
      </>
    ),
  },
  {
    caption: (
      <>
        Both write and try to commit. The detector now sees each txn wrote data the
        other <em>read</em> — two read→write dependencies forming a cycle, the
        &ldquo;dangerous structure.&rdquo; A serial order would have let one txn see
        the other&apos;s write; neither did. Premises went stale.
      </>
    ),
  },
  {
    caption: (
      <>
        One transaction commits; the other is aborted with a{" "}
        <em>serialization error</em> and retried by the application. The optimist&apos;s
        bargain: zero blocking when conflicts are rare, wasted work via aborts when
        they&apos;re common. Hence the rule of thumb — SSI for read-heavy/low-conflict,
        2PL-style locking thrives only when you must never retry.
      </>
    ),
  },
];

function Half({
  x0,
  title,
  active,
  children,
}: {
  x0: number;
  title: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <g className="tr" opacity={active ? 1 : 0.28}>
      <Txt x={x0} y={26} size={12} weight={700} tone={active ? "ink" : "mut"}>
        {title}
      </Txt>
      {children}
    </g>
  );
}

export default function TwoPlVsSsi() {
  return (
    <AnimationShell
      title="Two-phase locking vs serializable snapshot isolation"
      subtitle="pessimist and optimist, same race"
      steps={steps}
    >
      {(step) => {
        const left = step >= 1 && step <= 4;
        const right = step >= 5;
        const l = {
          slocks: step >= 1,
          t1blocked: step >= 2,
          t2blocked: step >= 3,
          deadlock: step === 3,
          resolved: step >= 4,
        };
        const r = {
          reads: step >= 5,
          conflict: step >= 6,
          resolved: step >= 7,
        };

        return (
          <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="2PL vs SSI comparison diagram">
            <VizDefs />
            <line x1={360} y1={12} x2={360} y2={308} stroke="var(--line-strong)" strokeDasharray="2 6" />

            {/* ------------------------------------------------ 2PL (left) */}
            <Half x0={20} title="A · strict two-phase locking (pessimist)" active={step === 0 ? true : left}>
              <NodeBox x={24} y={46} w={130} h={46} label="T1" sub="read X → write Y" tone={l.resolved ? "ok" : l.t1blocked ? "warn" : "default"} />
              <NodeBox x={24} y={210} w={130} h={46} label="T2" sub="read Y → write X" tone={l.resolved ? "bad" : l.t2blocked ? "warn" : "default"} />

              {/* lock table */}
              <rect x={206} y={92} width={128} height={118} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={222} y={114} size={10} weight={700} mono tone="acc">
                LOCK TABLE
              </Txt>
              <Txt x={222} y={138} size={11} mono tone={l.slocks ? "info" : "mut"} show={l.slocks}>
                X: S → T1
              </Txt>
              <Txt x={222} y={158} size={11} mono tone={l.slocks ? "info" : "mut"} show={l.slocks}>
                Y: S → T2
              </Txt>
              <Txt x={222} y={182} size={10.5} mono tone="warn" show={l.t1blocked && !l.resolved}>
                T1 waits X(Y)
              </Txt>
              <Txt x={222} y={200} size={10.5} mono tone="warn" show={l.t2blocked && !l.resolved}>
                T2 waits X(X)
              </Txt>

              {/* wait-for arrows forming the deadlock cycle */}
              <Arrow x1={154} y1={78} x2={206} y2={170} tone="warn" show={l.t1blocked && !l.resolved} label="wait" />
              <Arrow x1={154} y1={224} x2={206} y2={150} tone="warn" show={l.t2blocked && !l.resolved} label="wait" />

              <Badge x={120} y={146} label="DEADLOCK" tone="bad" show={l.deadlock} />
              <Badge x={120} y={146} label="T2 aborted → T1 ✓" tone="ok" show={l.resolved} />
              <Txt x={24} y={296} size={10} show={l.resolved}>
                readers ⇄ writers block · locks till commit · deadlock detector
              </Txt>
            </Half>

            {/* ------------------------------------------------ SSI (right) */}
            <Half x0={382} title="B · serializable snapshot isolation (optimist)" active={step === 0 ? true : right}>
              <NodeBox x={386} y={46} w={130} h={46} label="T1" sub="read X → write Y" tone={r.resolved ? "ok" : "default"} />
              <NodeBox x={386} y={210} w={130} h={46} label="T2" sub="read Y → write X" tone={r.resolved ? "bad" : "default"} />

              {/* snapshot store */}
              <rect x={568} y={92} width={128} height={118} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={584} y={114} size={10} weight={700} mono tone="acc">
                SNAPSHOT + SIREAD
              </Txt>
              <Txt x={584} y={138} size={10.5} mono tone="info" show={r.reads}>
                T1 read {`{X}`}
              </Txt>
              <Txt x={584} y={156} size={10.5} mono tone="info" show={r.reads}>
                T2 read {`{Y}`}
              </Txt>
              <Txt x={584} y={180} size={10.5} mono tone="warn" show={r.conflict}>
                T1 wrote Y ⟂ T2
              </Txt>
              <Txt x={584} y={198} size={10.5} mono tone="warn" show={r.conflict}>
                T2 wrote X ⟂ T1
              </Txt>

              {/* rw-antidependency cycle */}
              <Arrow x1={516} y1={80} x2={516} y2={206} tone="bad" show={r.conflict && !r.resolved} label="rw" curve={-44} />
              <Arrow x1={516} y1={222} x2={516} y2={96} tone="bad" show={r.conflict && !r.resolved} label="rw" curve={-44} />

              <Txt x={386} y={130} size={10.5} tone="ok" show={r.reads && !r.conflict}>
                no locks — both run at full speed
              </Txt>

              <Badge x={482} y={146} label="cycle at commit!" tone="bad" show={r.conflict && !r.resolved} />
              <Badge x={482} y={146} label="T2: serialization error → retry" tone="ok" show={r.resolved} />
              <Txt x={386} y={296} size={10} show={r.resolved}>
                no blocking · conflicts found at commit · pay with aborts
              </Txt>
            </Half>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
