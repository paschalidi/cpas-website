import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Multi-leader replication: why you'd accept writes in two places, the
 * conflict that inevitably follows, and the three honest ways out.
 */

const steps = [
  {
    caption: (
      <>
        Sometimes one leader isn&apos;t enough: a <strong>datacenter per
        continent</strong> (writes should be fast locally, not cross an ocean),{" "}
        <strong>offline-capable apps</strong> (your phone&apos;s calendar is a
        leader that syncs later), and <strong>collaborative editors</strong>{" "}
        (every cursor is a writer). Multi-leader: each leader accepts writes and
        replicates asynchronously to the others.
      </>
    ),
  },
  {
    caption: (
      <>
        The price appears immediately. A company wiki page is renamed in two
        places <em>at the same moment</em>: the EU datacenter accepts{" "}
        <code>&quot;Roadmap 2027&quot;</code>, the US datacenter accepts{" "}
        <code>&quot;Plan 2027&quot;</code>. Both writes <strong>succeed
        locally</strong> — each user saw their rename work.
      </>
    ),
  },
  {
    caption: (
      <>
        Async replication exchanges the writes. Each DC now receives a rename
        that conflicts with the one it already applied. With a single leader,
        one write would have queued behind the other; here there was no shared
        queue. There is no &ldquo;later&rdquo; to appeal to — only{" "}
        <strong>concurrent</strong> (chapter 8: no global clock will save you).
      </>
    ),
  },
  {
    caption: (
      <>
        Way out #1 — <strong>last write wins (LWW)</strong>: attach timestamps,
        keep the higher one, everywhere. Both DCs converge on (say){" "}
        <code>&quot;Plan 2027&quot;</code>… and the EU user&apos;s rename is{" "}
        <em>silently discarded</em> — an acknowledged write, gone, no error.
        Plus the timestamps come from clocks that skew (chapter 8), so
        &ldquo;last&rdquo; may not even be last. LWW is convergence by
        amnesia: acceptable for caches, dangerous for data you promised to
        keep.
      </>
    ),
  },
  {
    caption: (
      <>
        Way out #2 — <strong>keep both, merge explicitly</strong>: detect the
        concurrency (version vectors — one version counter per leader), store
        the conflicting values as <em>siblings</em>, and surface them to
        application code or the user to merge. Honest, lossless, and laborious —
        someone must write the merge logic, and &ldquo;just keep both&rdquo;
        leaks complexity to every reader.
      </>
    ),
  },
  {
    caption: (
      <>
        Way out #3 — <strong>don&apos;t have the conflict</strong>: route all
        writes for a given record to one <em>home</em> leader (this page&apos;s
        home is EU; this user&apos;s home is their nearest DC). Each record is
        effectively single-leader; conflicts only resurface when a home moves
        (failover, user travels). Most multi-leader deployments lean on this
        hard.
      </>
    ),
  },
  {
    caption: (
      <>
        The non-negotiable: whatever you choose must make all replicas{" "}
        <strong>converge to the same value</strong> — resolution can run on
        write or be deferred to read, but it must be deterministic everywhere.
        Topology footnote: leaders exchange writes all-to-all, in a ring, or via
        a star; sparse topologies add hops (more lag, ordering puzzles) and
        single points of failure. The dream of merges that are{" "}
        <em>automatically</em> safe — CRDTs — waits in chapter 12.
      </>
    ),
  },
];

export default function MultiLeaderConflicts() {
  return (
    <AnimationShell
      title="Multi-leader writes and the conflict problem"
      subtitle="two leaders, one record, no shared queue"
      steps={steps}
      interval={3400}
    >
      {(step) => {
        const wrote = step >= 1;
        const exchanged = step >= 2;
        const lww = step === 3;
        const siblings = step === 4;
        const homed = step === 5;

        const euVal = lww ? '"Plan 2027"' : siblings ? "{Roadmap, Plan}" : homed ? '"Roadmap 2027" (home)' : wrote ? '"Roadmap 2027"' : '"Roadmap"';
        const usVal = lww ? '"Plan 2027"' : siblings ? "{Roadmap, Plan}" : homed ? "→ forwards to EU" : wrote ? '"Plan 2027"' : '"Roadmap"';

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Multi-leader conflict diagram">
            <VizDefs />

            {/* DCs */}
            <rect x={16} y={26} width={300} height={150} rx={12} fill="none" stroke="var(--line-strong)" strokeDasharray="4 4" />
            <Txt x={32} y={46} size={9.5} mono weight={700} tone="mut">EU DATACENTER</Txt>
            <rect x={404} y={26} width={300} height={150} rx={12} fill="none" stroke="var(--line-strong)" strokeDasharray="4 4" />
            <Txt x={420} y={46} size={9.5} mono weight={700} tone="mut">US DATACENTER</Txt>

            <NodeBox x={60} y={70} w={212} h={62} label="leader · EU" sub={`page title: ${euVal}`} tone={exchanged && !lww && !siblings && !homed ? "bad" : "acc"} />
            <NodeBox x={448} y={70} w={212} h={62} label="leader · US" sub={`page title: ${usVal}`} tone={exchanged && !lww && !siblings && !homed ? "bad" : "acc"} />

            {/* local writers */}
            <NodeBox x={60} y={210} w={150} h={48} label="EU user" sub={wrote ? 'rename ✓ "Roadmap 2027"' : ""} tone="info" dim={!wrote} />
            <NodeBox x={510} y={210} w={150} h={48} label="US user" sub={wrote ? 'rename ✓ "Plan 2027"' : ""} tone="info" dim={!wrote} />
            <Arrow x1={135} y1={210} x2={150} y2={134} tone="acc" show={wrote && !homed} label="local write" />
            <Arrow x1={585} y1={210} x2={570} y2={134} tone="acc" show={wrote && !homed} label="local write" />
            <Arrow x1={585} y1={210} x2={285} y2={120} tone="acc" show={homed} label="routed to record's home" curve={-40} />

            {/* exchange */}
            <Arrow x1={272} y1={88} x2={448} y2={88} tone={exchanged && step === 2 ? "bad" : "warn"} show={exchanged && !homed} dashed label="async: Roadmap →" />
            <Arrow x1={448} y1={114} x2={272} y2={114} tone={exchanged && step === 2 ? "bad" : "warn"} show={exchanged && !homed} dashed label="← async: Plan" labelDy={12} />

            <Badge x={360} y={56} label="CONFLICT: concurrent renames, no shared queue" tone="bad" show={step === 2} />

            {/* options annotations */}
            <g className="tr" opacity={lww ? 1 : 0}>
              <rect x={16} y={262} width={688} height={40} rx={10} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
              <Txt x={32} y={286} size={10.5}>
                LWW: max(timestamp) wins everywhere → converged, but EU&apos;s acknowledged write silently destroyed — and ch8 says the clocks lie
              </Txt>
              <Badge x={360} y={196} label='EU rename: discarded, no error' tone="bad" />
            </g>
            <g className="tr" opacity={siblings ? 1 : 0}>
              <rect x={16} y={262} width={688} height={40} rx={10} fill="var(--bg)" stroke="var(--info)" strokeWidth={1.3} />
              <Txt x={32} y={286} size={10.5}>
                version vectors detect concurrency → keep both as siblings → app/user merges (lossless; merge code is now your job)
              </Txt>
              <Badge x={360} y={196} label="siblings stored, merge deferred to app" tone="info" />
            </g>
            <g className="tr" opacity={homed ? 1 : 0}>
              <rect x={16} y={262} width={688} height={40} rx={10} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.3} />
              <Txt x={32} y={286} size={10.5}>
                conflict avoidance: every record has one home leader → per-record single-leader → conflicts only on re-homing (failover, travel)
              </Txt>
              <Badge x={360} y={196} label="no concurrent writers per record" tone="ok" />
            </g>
            <g className="tr" opacity={step === 6 ? 1 : 0}>
              <rect x={16} y={208} width={688} height={94} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={32} y={230} size={9.5} mono weight={700} tone="acc">THE CONVERGENCE CONTRACT</Txt>
              <Txt x={32} y={250} size={10.5}>
                resolution may run on write or on read — but it must be deterministic and identical at every replica
              </Txt>
              <Txt x={32} y={268} size={10.5}>
                topologies: all-to-all (fast, ordering puzzles) · ring / star (fewer links, more hops, SPOF on the hub)
              </Txt>
              <Txt x={32} y={288} size={10.5} tone="acc">
                ch12 teaser: CRDTs — data types whose merges are automatic and always safe
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
