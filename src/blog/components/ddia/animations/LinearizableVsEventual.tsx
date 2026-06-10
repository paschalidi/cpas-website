
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Linearizability vs eventual consistency: a score update read by two fans,
 * one of whom sees the past after the other saw the present.
 */

const steps = [
  {
    caption: (
      <>
        A match-score service: one leader, two read replicas (async replication).
        Current score everywhere: <strong>0–0</strong>. Two fans, Ana and Raj,
        refresh obsessively. The question this animation answers: what does
        &ldquo;the&rdquo; current value even mean?
      </>
    ),
  },
  {
    caption: (
      <>
        Goal! The scorekeeper writes <strong>1–0</strong> to the leader. The write
        completes (leader has it); replication to followers is in flight —
        follower 1 has applied it, follower 2 hasn&apos;t yet.
      </>
    ),
  },
  {
    caption: (
      <>
        Ana&apos;s read lands on follower 1: <strong>1–0</strong>. She yells the
        news to Raj across the room.
      </>
    ),
  },
  {
    caption: (
      <>
        Raj refreshes — his read lands on lagging follower 2:{" "}
        <strong>0–0</strong>. He saw the <em>past</em> after Ana saw the present.
        Each replica is internally consistent; the <em>system</em> just showed two
        people two different nows. That&apos;s the violation linearizability
        forbids.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Linearizability,</strong> stated plainly: the system behaves as if
        there were one copy of the data, and every operation takes effect atomically
        at some instant between its start and finish. Concretely:{" "}
        <em>once any read returns the new value, every later read must too</em> —
        no flickering back to the past.
      </>
    ),
  },
  {
    caption: (
      <>
        Same moment, linearizable system: after Ana&apos;s read returned 1–0,
        Raj&apos;s later read <em>must</em> return 1–0 — served by the leader,
        by a quorum that overlaps the write, or by a follower only after it&apos;s
        provably caught up. The single-copy illusion is restored.
      </>
    ),
  },
  {
    caption: (
      <>
        The price tag: those reads now coordinate (leader round-trip or quorum),
        adding latency and — during a partition — forcing a choice: the minority
        side must refuse reads (consistency) or serve stale ones (availability).
        That fork is the kernel of CAP. Eventual consistency is what you get when
        you choose the second branch and let replicas converge later.
      </>
    ),
  },
  {
    caption: (
      <>
        Where it actually matters: uniqueness (usernames, seat 14B), locks and
        leader election, account balances, cross-channel handoffs (&ldquo;email
        says shipped; app must agree&rdquo;). Where it usually doesn&apos;t:
        feeds, counters, analytics. Default question in design interviews:{" "}
        <em>which operations need the single-copy illusion?</em> — almost never
        &ldquo;the whole system&rdquo;.
      </>
    ),
  },
];

export default function LinearizableVsEventual() {
  return (
    <AnimationShell
      title="Linearizable vs eventually consistent reads"
      subtitle="two fans, one goal, two nows"
      steps={steps}
    >
      {(step) => {
        const wrote = step >= 1;
        const linear = step >= 5;
        const f2val = linear ? "1–0" : wrote && step < 7 ? "0–0 (lagging)" : wrote ? "1–0 (caught up)" : "0–0";

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Linearizability diagram">
            <VizDefs />

            <Txt x={24} y={26} size={12} weight={700} tone="ink">
              {linear ? "B · linearizable reads (single-copy illusion)" : "A · async replicas, naive reads"}
            </Txt>

            {/* writer */}
            <NodeBox x={28} y={56} w={140} h={50} label="scorekeeper" sub={wrote ? "wrote 1–0 ✓" : "…"} tone={wrote ? "acc" : "default"} />

            {/* leader + followers */}
            <NodeBox x={290} y={48} w={150} h={52} label="leader" sub={wrote ? "1–0" : "0–0"} tone={wrote ? "ok" : "default"} />
            <NodeBox x={290} y={128} w={150} h={52} label="follower 1" sub={wrote ? "1–0" : "0–0"} tone={wrote ? "ok" : "default"} />
            <NodeBox x={290} y={208} w={150} h={52} label="follower 2" sub={f2val} tone={linear ? "ok" : wrote ? "warn" : "default"} />

            <Arrow x1={168} y1={80} x2={284} y2={74} tone="acc" show={wrote} label="write 1–0" />
            <Arrow x1={365} y1={100} x2={365} y2={124} tone="ok" show={wrote} />
            <Arrow x1={388} y1={100} x2={388} y2={204} tone="warn" show={wrote && !linear} dashed label="lagging…" curve={-30} />
            <Arrow x1={388} y1={100} x2={388} y2={204} tone="ok" show={linear} label="confirmed" curve={-30} />

            {/* readers */}
            <NodeBox x={560} y={120} w={132} h={50} label="Ana" sub={step >= 2 ? "read: 1–0" : "…"} tone={step >= 2 ? "ok" : "mut"} />
            <NodeBox x={560} y={206} w={132} h={50} label="Raj" sub={step >= 3 ? (linear ? "read: 1–0 ✓" : "read: 0–0 ?!") : "…"} tone={step >= 3 ? (linear ? "ok" : "bad") : "mut"} />

            <Arrow x1={560} y1={142} x2={444} y2={150} tone="info" show={step >= 2} label="t₁" />
            <Arrow
              x1={560}
              y1={228}
              x2={444}
              y2={linear ? 96 : 232}
              tone={linear ? "info" : "bad"}
              show={step >= 3}
              label={linear ? "t₂ → leader/quorum" : "t₂ (after t₁!)"}
            />

            <Badge x={620} y={286} label="t₂ saw the past ✗" tone="bad" show={step >= 3 && !linear} />
            <Badge x={620} y={286} label="t₂ ≥ t₁ guaranteed ✓" tone="ok" show={step >= 6} />

            {/* definition panel */}
            <g className="tr" opacity={step === 4 ? 1 : 0}>
              <rect x={28} y={130} width={232} height={130} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.4} />
              <Txt x={44} y={154} size={10} weight={700} mono tone="acc">
                LINEARIZABLE =
              </Txt>
              <Txt x={44} y={176} size={10.5} tone="ink">
                acts like ONE copy;
              </Txt>
              <Txt x={44} y={194} size={10.5} tone="ink">
                each op atomic at a point
              </Txt>
              <Txt x={44} y={212} size={10.5} tone="ink">
                between call and return;
              </Txt>
              <Txt x={44} y={230} size={10.5} tone="ink">
                reads never go backwards
              </Txt>
            </g>

            {/* cost note */}
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <Txt x={28} y={292} size={10.5} tone="warn" weight={600}>
                cost: coordination latency · partition ⇒ choose: refuse (CP) or go stale (AP)
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
