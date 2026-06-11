import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Quorum explorer: Dynamo-style leaderless replication with n=3, w=2, r=2 —
 * why w + r > n works, how stale replicas get healed, and the fine print
 * (concurrent writes, partial failures, sloppy quorums).
 */

const steps = [
  {
    caption: (
      <>
        <strong>Leaderless</strong> replication deletes the leader: the client
        (or a coordinator) sends every write to <em>all n replicas</em> and
        counts acks; reads ask several replicas and keep the newest version.
        Configuration: <code>n = 3</code> copies, write quorum{" "}
        <code>w = 2</code>, read quorum <code>r = 2</code>. The magic
        inequality: <code>w + r {">"} n</code>.
      </>
    ),
  },
  {
    caption: (
      <>
        A write: playlist title → <code>&quot;Sunset Mix&quot;</code>, version 2.
        Replicas A and B ack; replica C is down for a reboot. Two acks ≥ w, so
        the client is told <strong>success</strong> — no failover, no leader
        election, no waiting for C. Tolerating node outages <em>without
        drama</em> is the whole sales pitch.
      </>
    ),
  },
  {
    caption: (
      <>
        C reboots and rejoins — still holding <strong>version 1</strong>. Nothing
        pushes it the missed write (there&apos;s no leader with a log to replay).
        The cluster is now visibly inconsistent: A=v2, B=v2, C=v1. Leaderless
        systems treat this as <em>normal weather</em>, not an incident.
      </>
    ),
  },
  {
    caption: (
      <>
        A read asks r = 2 replicas — say B and C. It gets <code>v2</code> from B
        and <code>v1</code> from C; version numbers settle it: <strong>v2
        wins</strong>. This is why <code>w + r {">"} n</code>: any 2 writers and
        any 2 readers out of 3 must share at least one node, so every read
        quorum <em>contains</em> at least one fresh copy. The overlap is the
        guarantee.
      </>
    ),
  },
  {
    caption: (
      <>
        Healing, two ways. <strong>Read repair</strong>: having just caught C
        being stale, the reader writes v2 back to it — hot keys self-heal.{" "}
        <strong>Anti-entropy</strong>: a background process diffs replicas
        (Merkle trees make the diff cheap) and syncs cold keys that no one
        reads. Without anti-entropy, rarely-read data can stay stale until it
        matters.
      </>
    ),
  },
  {
    caption: (
      <>
        Fine print #1 — <strong>concurrent writes</strong>: two clients writing
        the same key at once hit replicas in different orders; version{" "}
        <em>numbers</em> alone can&apos;t order them. You&apos;re back to chapter
        animation 3&apos;s menu: LWW (lossy) or version vectors + siblings
        (honest). Fine print #2 — a write that reaches only 1 of 2 needed acks{" "}
        <strong>fails without rollback</strong>: the value squats on that
        replica and may win future reads. &ldquo;Failed&rdquo; ≠
        &ldquo;didn&apos;t happen&rdquo;.
      </>
    ),
  },
  {
    caption: (
      <>
        Fine print #3 — <strong>sloppy quorums</strong>: during a partition, the
        home replicas may be unreachable, so the system accepts writes on{" "}
        <em>substitute</em> nodes (with a <strong>hinted handoff</strong>: &ldquo;deliver
        to C when it&apos;s back&rdquo;). Availability is rescued — but w acks no
        longer guarantee overlap with the <em>home</em> set, so reads can miss
        the write until hints land. Durable-ish, consistent-later.
      </>
    ),
  },
  {
    caption: (
      <>
        The honest summary: quorums buy <strong>durability and
        write-availability without failover</strong>, and tunable dials —{" "}
        <code>w=n, r=1</code> for read-heavy data, <code>w=1</code> when losing a
        race is fine. They do <em>not</em> buy linearizability even with{" "}
        <code>w + r {">"} n</code> (chapter 9 shows the interleavings), and
        staleness has no hard bound you can monitor — there&apos;s no
        replication-lag metric because there&apos;s no log to lag behind.
      </>
    ),
  },
];

export default function QuorumExplorer() {
  return (
    <AnimationShell
      title="Quorum explorer: w + r > n, and its fine print"
      subtitle="n = 3 replicas · write quorum 2 · read quorum 2"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const wrote = step >= 1;
        const cBack = step >= 2;
        const reading = step === 3;
        const repaired = step >= 4;
        const sloppy = step === 6;

        const cVal = repaired ? 'v2 "Sunset Mix"' : cBack ? 'v1 "Mix #7" (stale)' : wrote ? "down…" : 'v1 "Mix #7"';
        const cTone = repaired ? "ok" : cBack ? "warn" : wrote ? "bad" : "default";

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Quorum read/write diagram">
            <VizDefs />

            <NodeBox x={16} y={126} w={140} h={58} label="client" sub={reading ? "read → newest wins" : wrote ? "write acked (2/3) ✓" : ""} tone={wrote ? "ok" : "default"} />

            {/* replicas */}
            <NodeBox x={300} y={28} w={200} h={54} label="replica A" sub={wrote ? 'v2 "Sunset Mix" ✓' : 'v1 "Mix #7"'} tone={wrote ? "ok" : "default"} />
            <NodeBox x={300} y={126} w={200} h={54} label="replica B" sub={wrote ? 'v2 "Sunset Mix" ✓' : 'v1 "Mix #7"'} tone={wrote ? "ok" : "default"} />
            <NodeBox x={300} y={224} w={200} h={54} label="replica C" sub={cVal} tone={cTone} fillTone={wrote && !cBack ? "bad" : undefined} />

            {/* write arrows */}
            <Arrow x1={156} y1={140} x2={296} y2={58} tone="acc" show={wrote && step === 1} label="write v2" />
            <Arrow x1={156} y1={152} x2={296} y2={152} tone="acc" show={wrote && step === 1} label="write v2" />
            <Arrow x1={156} y1={166} x2={296} y2={246} tone="bad" show={wrote && step === 1} dashed label="write v2 ✗ (down)" />

            {/* read arrows */}
            <Arrow x1={156} y1={148} x2={296} y2={146} tone="info" show={reading} label="read → v2" />
            <Arrow x1={156} y1={164} x2={296} y2={242} tone="info" show={reading} label="read → v1 (stale)" labelDy={12} />
            <Badge x={600} y={150} label="versions compared: v2 wins ✓" tone="ok" show={reading} />

            {/* overlap note */}
            <g className="tr" opacity={reading ? 1 : 0}>
              <rect x={530} y={196} width={178} height={62} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={544} y={216} size={9.5} mono weight={700} tone="acc">WHY IT WORKS</Txt>
              <Txt x={544} y={234} size={10}>any 2 writers ∩ any 2</Txt>
              <Txt x={544} y={248} size={10}>readers ≠ ∅ when 2+2{">"}3</Txt>
            </g>

            {/* read repair */}
            <Arrow x1={170} y1={170} x2={296} y2={250} tone="ok" show={step === 4} label="read repair: v2 → C" />
            <Badge x={600} y={262} label="anti-entropy diffs cold keys in background" tone="info" show={step === 4} />

            {/* fine print panels */}
            <g className="tr" opacity={step === 5 ? 1 : 0}>
              <rect x={530} y={28} width={178} height={150} rx={10} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
              <Txt x={544} y={48} size={9.5} mono weight={700} tone="warn">FINE PRINT</Txt>
              <Txt x={544} y={68} size={10}>concurrent writes:</Txt>
              <Txt x={544} y={82} size={10}>numbers can&apos;t order →</Txt>
              <Txt x={544} y={96} size={10}>version vectors / LWW</Txt>
              <Txt x={544} y={118} size={10}>failed write (1 ack):</Txt>
              <Txt x={544} y={132} size={10}>no rollback — value</Txt>
              <Txt x={544} y={146} size={10}>lingers, may win reads</Txt>
            </g>

            {/* sloppy quorum */}
            <g className="tr" opacity={sloppy ? 1 : 0}>
              <NodeBox x={540} y={224} w={164} h={54} label="substitute node S" sub="hint: “for C, when back”" tone="warn" />
              <Arrow x1={156} y1={170} x2={536} y2={246} tone="warn" show={sloppy} dashed label="partition! write lands on S" curve={30} />
              <Badge x={360} y={108} label="w acks ✓ — but not the home set: reads may miss it until handoff" tone="warn" />
            </g>

            {/* summary */}
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <rect x={530} y={28} width={178} height={150} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={544} y={48} size={9.5} mono weight={700} tone="acc">THE DIALS</Txt>
              <Txt x={544} y={68} size={10}>w=n, r=1 → fast reads,</Txt>
              <Txt x={544} y={82} size={10}>writes need all nodes</Txt>
              <Txt x={544} y={100} size={10}>w=1 → fastest writes,</Txt>
              <Txt x={544} y={114} size={10}>weakest durability</Txt>
              <Txt x={544} y={136} size={10} tone="bad">never linearizable</Txt>
              <Txt x={544} y={150} size={10} tone="bad">(ch 9) · lag unmeasured</Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
