import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Raft, the whole arc: heartbeats → leader crash → randomized timeout →
 * election (term 2) → replication & commit → stale leader rejoins,
 * is fenced by the term number, and has its log repaired.
 */

const steps = [
  {
    caption: (
      <>
        <strong>Raft in one sitting.</strong> Three nodes replicate a log; one is
        leader, the others followers. Every message carries a <strong>term</strong>{" "}
        — a logical era counter. We start in term 1: n1 leads, and slot 1 of every
        log holds a committed entry <code>a=1</code>.
      </>
    ),
  },
  {
    caption: (
      <>
        A leader&apos;s heartbeat resets each follower&apos;s{" "}
        <strong>election timer</strong> — a <em>randomized</em> timeout. While
        heartbeats flow, nobody dreams of an election. Note: n1 has also just
        appended <code>b=2</code> locally, <em>not yet replicated</em>. Remember
        it.
      </>
    ),
  },
  {
    caption: (
      <>
        n1 <strong>crashes</strong> (or is partitioned — from the outside, chapter
        8 taught us, you can&apos;t tell). Heartbeats stop; timers tick down. The
        unreplicated <code>b=2</code> is trapped on the dead node.
      </>
    ),
  },
  {
    caption: (
      <>
        n2&apos;s timer fires first — randomization makes simultaneous candidacies
        unlikely. n2 increments the term to <strong>2</strong>, becomes a{" "}
        <strong>candidate</strong>, votes for itself, and requests votes. Rules: one
        vote per node per term, and only for a candidate whose log is{" "}
        <em>at least as up-to-date</em> as the voter&apos;s.
      </>
    ),
  },
  {
    caption: (
      <>
        n3 grants its vote → 2 of 3, a <strong>majority</strong>. n2 is leader of
        term 2. Two leaders in one term are impossible (each node spends its single
        vote once), and the up-to-date-log rule guarantees the winner already holds
        every <em>committed</em> entry.
      </>
    ),
  },
  {
    caption: (
      <>
        A client writes <code>x=7</code>. The new leader appends it to its own log
        — <strong>uncommitted</strong> (dashed). Appending is cheap; committing
        requires proof.
      </>
    ),
  },
  {
    caption: (
      <>
        n2 replicates with <strong>AppendEntries</strong>. Each append carries the
        leader&apos;s term plus the index &amp; term of the <em>preceding</em>{" "}
        entry, so a follower accepts only if its log matches up to that point — the
        consistency check that keeps logs identical.
      </>
    ),
  },
  {
    caption: (
      <>
        n3 acks → the entry is on a majority (n2, n3) → the leader marks it{" "}
        <strong>committed</strong>, applies it, and answers the client. Subtle rule
        interviewers love: a leader only counts replication of entries{" "}
        <em>from its own current term</em> toward commitment — preventing a famous
        edge case where an old-term entry gets &ldquo;committed&rdquo; and later
        overwritten.
      </>
    ),
  },
  {
    caption: (
      <>
        n1 reboots, still believing it leads term 1. Its first message is met with
        &ldquo;term 1 &lt; term 2&rdquo; → n1 <strong>steps down</strong> to
        follower. The AppendEntries consistency check then finds its stray{" "}
        <code>b=2</code> conflicts with the leader&apos;s log: truncated,
        overwritten with <code>x=7</code>. The leader&apos;s log is the truth;
        uncommitted entries were never promised to anyone.
      </>
    ),
  },
  {
    caption: (
      <>
        Why this is safe: <strong>terms</strong> fence stale leaders (chapter
        8&apos;s fencing tokens, institutionalized), <strong>majorities</strong>{" "}
        can&apos;t be won twice in one term, <strong>randomized timeouts</strong>{" "}
        break ties. The price: every commit is a majority round-trip, and losing a
        majority means unavailability for writes. This — not 2PC — is
        fault-tolerant consensus.
      </>
    ),
  },
];

type SlotState = "committed" | "pending" | "conflict" | "empty";

function LogSlot({ x, y, label, state }: { x: number; y: number; label: string; state: SlotState }) {
  if (state === "empty")
    return <rect x={x} y={y} width={56} height={22} rx={5} fill="none" stroke="var(--line)" strokeDasharray="3 4" />;
  const stroke = state === "committed" ? "var(--ok)" : state === "conflict" ? "var(--bad)" : "var(--accent)";
  return (
    <g className="tr">
      <rect
        x={x}
        y={y}
        width={56}
        height={22}
        rx={5}
        fill="var(--bg)"
        stroke={stroke}
        strokeWidth={1.4}
        strokeDasharray={state === "pending" ? "4 3" : undefined}
        className="tr"
      />
      <text
        x={x + 28}
        y={y + 11}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={state === "conflict" ? "var(--bad)" : "var(--ink)"}
        className="tr"
      >
        {label}
      </text>
      {state === "conflict" ? <line x1={x + 4} y1={y + 11} x2={x + 52} y2={y + 11} stroke="var(--bad)" strokeWidth={1.4} /> : null}
    </g>
  );
}

function NodeLog({
  x,
  y,
  slots,
}: {
  x: number;
  y: number;
  slots: { label: string; state: SlotState }[];
}) {
  return (
    <g>
      {slots.map((s, i) => (
        <LogSlot key={i} x={x + i * 62} y={y} label={s.label} state={s.state} />
      ))}
    </g>
  );
}

export default function RaftLab() {
  return (
    <AnimationShell
      title="Raft: leader election & log replication"
      subtitle="terms, votes, majorities — fencing tokens institutionalized"
      steps={steps}
      interval={3200}
    >
      {(step) => {
        const crashed = step >= 2 && step < 8;
        const candidate = step === 3;
        const leader2 = step >= 4;
        const term = step >= 3 ? 2 : 1;

        const n1Sub = crashed
          ? "CRASHED"
          : step < 2
            ? "leader · term 1"
            : step === 8
              ? "rejoined → steps down"
              : "follower · term 2";
        const n2Sub = leader2 ? "LEADER · term 2" : candidate ? "candidate · term 2" : "follower";
        const n3Sub = step >= 4 ? "follower · term 2" : step === 3 ? "voting…" : "follower";

        // logs
        const n1Slots: { label: string; state: SlotState }[] = [
          { label: "t1 a=1", state: "committed" },
          step >= 8
            ? { label: "t2 x=7", state: "committed" }
            : step >= 1
              ? { label: "t1 b=2", state: step >= 2 ? "conflict" : "pending" }
              : { label: "", state: "empty" },
        ];
        const n2Slots: { label: string; state: SlotState }[] = [
          { label: "t1 a=1", state: "committed" },
          step >= 5 ? { label: "t2 x=7", state: step >= 7 ? "committed" : "pending" } : { label: "", state: "empty" },
        ];
        const n3Slots: { label: string; state: SlotState }[] = [
          { label: "t1 a=1", state: "committed" },
          step >= 6 ? { label: "t2 x=7", state: step >= 7 ? "committed" : "pending" } : { label: "", state: "empty" },
        ];

        return (
          <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="Raft election and replication diagram">
            <VizDefs />

            {/* term indicator */}
            <g>
              <rect x={618} y={16} width={86} height={26} rx={13} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={661} y={29} size={11} mono weight={700} anchor="middle" tone={term === 2 ? "acc" : "mut"}>
                term {term}
              </Txt>
            </g>

            {/* client */}
            <NodeBox x={24} y={28} w={104} h={42} label="client" sub={step === 5 ? "write x=7" : step === 7 ? "OK ✓" : ""} tone={step === 5 || step === 7 ? "info" : "mut"} />

            {/* nodes (triangle) */}
            <NodeBox x={285} y={36} w={150} h={50} label="n1" sub={n1Sub} tone={crashed ? "bad" : step >= 8 ? "warn" : step < 2 ? "ok" : "default"} fillTone={crashed ? "bad" : undefined} />
            <NodeBox x={80} y={170} w={150} h={50} label="n2" sub={n2Sub} tone={leader2 ? "ok" : candidate ? "acc" : "default"} />
            <NodeBox x={490} y={170} w={150} h={50} label="n3" sub={n3Sub} tone="default" />

            {/* crash mark */}
            <g className="tr" opacity={crashed ? 1 : 0}>
              <Txt x={360} y={70} size={24} weight={800} tone="bad" anchor="middle">
                ✕
              </Txt>
            </g>

            {/* logs */}
            <Txt x={450} y={50} size={9} mono tone="mut">
              log
            </Txt>
            <NodeLog x={450} y={56} slots={n1Slots} />
            <Txt x={84} y={246} size={9} mono tone="mut">
              log
            </Txt>
            <NodeLog x={84} y={252} slots={n2Slots} />
            <Txt x={494} y={246} size={9} mono tone="mut">
              log
            </Txt>
            <NodeLog x={494} y={252} slots={n3Slots} />

            {/* heartbeats term 1 */}
            <Arrow x1={320} y1={86} x2={190} y2={166} tone="ok" show={step === 1} label="heartbeat" />
            <Arrow x1={400} y1={86} x2={530} y2={166} tone="ok" show={step === 1} label="heartbeat" />

            {/* election */}
            <Arrow x1={190} y1={166} x2={320} y2={90} tone="mut" dashed show={candidate} label="vote? (no reply)" />
            <Arrow x1={230} y1={188} x2={486} y2={188} tone="acc" show={candidate} label="vote me · term 2" />
            <Arrow x1={486} y1={206} x2={230} y2={206} tone="ok" show={step === 4} label="granted ✓" />
            <Badge x={360} y={148} label="majority 2/3 → leader of term 2" tone="ok" show={step === 4} />

            {/* client write */}
            <Arrow x1={100} y1={70} x2={140} y2={166} tone="info" show={step === 5} label="x=7" />
            <Arrow x1={140} y1={166} x2={100} y2={70} tone="info" show={step === 7} label="OK" curve={-30} />

            {/* replication */}
            <Arrow x1={230} y1={188} x2={486} y2={188} tone="acc" show={step === 6} label="AppendEntries · term 2 · prev(1,t1)" />
            <Arrow x1={486} y1={206} x2={230} y2={206} tone="ok" show={step === 7} label="ack" />
            <Badge x={360} y={148} label="on majority → COMMITTED" tone="ok" show={step === 7} />

            {/* rejoin + fencing */}
            <Arrow x1={230} y1={170} x2={300} y2={88} tone="acc" show={step === 8} label="append · term 2" />
            <Badge x={360} y={120} label="term 1 < 2 → step down + log repair" tone="warn" show={step === 8} />

            {/* takeaway */}
            <g className="tr" opacity={step === 9 ? 1 : 0}>
              <Txt x={84} y={302} size={10.5} tone="acc" weight={600}>
                safety = terms (fencing) + single vote per term + majority overlap · cost = quorum RTT per commit
              </Txt>
            </g>
            <g className="tr" opacity={step === 2 ? 1 : 0}>
              <Txt x={84} y={302} size={10.5} tone="warn" weight={600}>
                election timers (randomized 150–300ms) now counting down on n2, n3…
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
