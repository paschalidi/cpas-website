import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Two-phase commit: the happy path, then the coordinator crash that leaves
 * participants in-doubt, holding locks.
 */

const steps = [
  {
    caption: (
      <>
        One logical transaction must commit on <strong>two databases at once</strong>{" "}
        (say: debit in the orders DB, reserve in the inventory DB) — atomically:
        both or neither, even across machines. Enter a <strong>coordinator</strong>{" "}
        running two-phase commit.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Phase 1 — prepare.</strong> The coordinator asks each participant:
        &ldquo;can you commit?&rdquo; Each does <em>all</em> the work — writes the
        transaction to its WAL, acquires/holds locks, checks constraints — so that
        only the final flip remains.
      </>
    ),
  },
  {
    caption: (
      <>
        Each participant votes <strong>YES</strong> — and a yes is a{" "}
        <em>binding promise</em>: &ldquo;I can commit even if I crash right now and
        recover.&rdquo; After voting yes, a participant may no longer abort on its
        own. It has surrendered its autonomy.
      </>
    ),
  },
  {
    caption: (
      <>
        The coordinator writes <strong>COMMIT to its own log</strong> — this disk
        write <em>is</em> the atomic commit point. Whatever happens next, the
        decision exists in exactly one place and is irrevocable.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Phase 2 — commit.</strong> The coordinator tells everyone: commit.
        Participants flip their prepared transactions to committed and release
        locks. If any vote had been NO (or timed out), phase 2 would broadcast
        abort instead. Happy path complete.
      </>
    ),
  },
  {
    caption: (
      <>
        Now the dark timeline. Same setup, both participants have voted{" "}
        <strong>YES</strong>… and the coordinator <strong>crashes</strong> before
        sending the decision.
      </>
    ),
  },
  {
    caption: (
      <>
        The participants are <strong>in doubt</strong>: voted yes, so they
        can&apos;t abort; haven&apos;t heard commit, so they can&apos;t commit.
        They sit holding locks — blocking every other transaction that touches
        those rows. They can&apos;t even safely ask each other (the other may know
        nothing too).
      </>
    ),
  },
  {
    caption: (
      <>
        The only clean exit: the coordinator <em>recovers</em>, reads its log, and
        re-broadcasts the decision. Until then, locks stay held — minutes, hours.
        In practice, stuck in-doubt transactions sometimes end with an admin
        manually committing/aborting (and praying they match the lost decision).
      </>
    ),
  },
  {
    caption: (
      <>
        The verdict on 2PC: it gives real atomic commit across systems, but the
        coordinator is a <strong>single point of blocking</strong> — 2PC is{" "}
        <em>not</em> fault-tolerant consensus. Chapter 9&apos;s punchline: run the{" "}
        <em>decision itself</em> through a replicated consensus log (Raft/Paxos),
        so &ldquo;the coordinator&rdquo; can&apos;t die with the answer. That&apos;s
        the next animation.
      </>
    ),
  },
];

export default function TwoPhaseCommitLab() {
  return (
    <AnimationShell
      title="Two-phase commit: happy path & coordinator crash"
      subtitle="a binding promise, then an awkward silence"
      steps={steps}
    >
      {(step) => {
        const dark = step >= 5;
        const prepared = dark ? step >= 5 : step >= 1;
        const voted = dark ? step >= 5 : step >= 2;
        const decided = !dark && step >= 3;
        const committed = !dark && step >= 4;
        const crashed = dark && step >= 5;
        const indoubt = dark && step >= 6;
        const recovered = dark && step >= 7;

        const coordSub = dark
          ? recovered
            ? "recovered: log says COMMIT"
            : "CRASHED ✗"
          : decided
            ? "log: COMMIT ✓ (the commit point)"
            : voted
              ? "all YES — deciding…"
              : "asks: prepare?";

        const partSub = (name: string) =>
          committed || recovered
            ? "committed · locks freed ✓"
            : indoubt
              ? "IN DOUBT · holding locks"
              : voted
                ? "voted YES (binding)"
                : prepared
                  ? "WAL ✓ · locks held"
                  : "idle";

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Two-phase commit diagram">
            <VizDefs />

            <Txt x={24} y={26} size={12} weight={700} tone="ink">
              {dark ? "B · coordinator crashes after the votes" : "A · happy path"}
            </Txt>

            {/* coordinator */}
            <NodeBox
              x={280}
              y={48}
              w={170}
              h={58}
              label="coordinator"
              sub={coordSub}
              tone={crashed && !recovered ? "bad" : decided || recovered ? "ok" : "info"}
              fillTone={crashed && !recovered ? "bad" : undefined}
            />

            {/* coordinator log */}
            <g className="tr" opacity={decided || dark ? 1 : 0}>
              <rect x={488} y={52} width={150} height={50} rx={8} fill="var(--bg)" stroke={decided || recovered ? "var(--ok)" : "var(--line-strong)"} className="tr" />
              <Txt x={502} y={72} size={9.5} mono weight={700} tone="acc">
                COORD LOG (disk)
              </Txt>
              <Txt x={502} y={90} size={10.5} mono tone={decided || recovered ? "ok" : "mut"}>
                {decided || recovered ? "txn 81: COMMIT" : dark ? "decision unknown…" : ""}
              </Txt>
            </g>

            {/* participants */}
            <NodeBox x={70} y={190} w={210} h={62} label="orders DB" sub={partSub("orders")} tone={indoubt && !recovered ? "warn" : committed || recovered ? "ok" : voted ? "acc" : "default"} />
            <NodeBox x={440} y={190} w={210} h={62} label="inventory DB" sub={partSub("inv")} tone={indoubt && !recovered ? "warn" : committed || recovered ? "ok" : voted ? "acc" : "default"} />

            {/* phase 1 arrows */}
            <Arrow x1={320} y1={106} x2={185} y2={186} tone="info" show={prepared && !voted} label="prepare?" />
            <Arrow x1={410} y1={106} x2={535} y2={186} tone="info" show={prepared && !voted} label="prepare?" />
            <Arrow x1={185} y1={186} x2={320} y2={110} tone="acc" show={voted && !decided && !crashed} label="YES" curve={24} />
            <Arrow x1={535} y1={186} x2={410} y2={110} tone="acc" show={voted && !decided && !crashed} label="YES" curve={24} />

            {/* phase 2 arrows */}
            <Arrow x1={320} y1={106} x2={185} y2={186} tone="ok" show={committed || recovered} label="COMMIT" />
            <Arrow x1={410} y1={106} x2={535} y2={186} tone="ok" show={committed || recovered} label="COMMIT" />

            {/* crash X */}
            <g className="tr" opacity={crashed && !recovered ? 1 : 0}>
              <Txt x={365} y={84} size={26} weight={800} tone="bad" anchor="middle">
                ✕
              </Txt>
            </g>

            {/* in-doubt annotations */}
            <g className="tr" opacity={indoubt && !recovered ? 1 : 0}>
              <Badge x={360} y={170} label="IN DOUBT: can't commit, can't abort" tone="warn" />
              <Txt x={86} y={278} size={10.5} tone="bad" weight={600}>
                locks held → other transactions on these rows are blocked, cluster-wide
              </Txt>
            </g>

            {/* binding-promise note */}
            <g className="tr" opacity={!dark && step === 2 ? 1 : 0}>
              <Txt x={86} y={278} size={10.5} tone="acc" weight={600}>
                YES = “I will be able to commit even if I crash now” — WAL first, then vote
              </Txt>
            </g>
            <g className="tr" opacity={!dark && step === 3 ? 1 : 0}>
              <Txt x={86} y={278} size={10.5} tone="ok" weight={600}>
                the single disk write on the coordinator is the entire atomicity of 2PC
              </Txt>
            </g>
            <g className="tr" opacity={recovered ? 1 : 0}>
              <Badge x={360} y={170} label="recovery replays the log → unblock" tone="ok" />
            </g>
            <g className="tr" opacity={step === 8 ? 1 : 0}>
              <Txt x={86} y={278} size={10.5} tone="warn" weight={600}>
                2PC = atomic commit, NOT fault-tolerant consensus — the fix: replicate the decision (Raft)
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
