import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Process pauses + fencing tokens: a lease holder GC-pauses past its lease
 * expiry, a new holder takes over, the zombie wakes and writes — first shown
 * corrupting storage, then blocked by a fencing token check.
 */

const steps = [
  {
    caption: (
      <>
        Worker A holds a <strong>lease</strong> (a lock with an expiry) on
        &ldquo;export job 9&rdquo;, granted by a lock service. Leases expire so a
        crashed holder can&apos;t block everyone forever. A is mid-job, about to
        write its result to storage.
      </>
    ),
  },
  {
    caption: (
      <>
        A&apos;s JVM hits a stop-the-world <strong>GC pause</strong>. Every thread
        freezes — including the one that renews the lease. Pauses of seconds (even
        minutes) happen: GC, VM migration, paging, a laptop lid closing. Code
        cannot assume time didn&apos;t pass between two of its own lines.
      </>
    ),
  },
  {
    caption: (
      <>
        While A is frozen its lease <strong>expires</strong>. The lock service —
        correctly! — grants the lease to worker B. From the outside, A looks dead;
        there is no way to distinguish &ldquo;dead&rdquo; from &ldquo;paused&rdquo;
        from the outside.
      </>
    ),
  },
  {
    caption: (
      <>
        B starts processing job 9 and writes to storage. All perfectly correct so
        far — B is the legitimate holder.
      </>
    ),
  },
  {
    caption: (
      <>
        A&apos;s GC ends. A has <em>no idea</em> it was frozen — its next
        instruction is the storage write, and A still believes it holds the lease.
        The zombie writes. Storage now has interleaved writes from two
        &ldquo;exclusive&rdquo; holders: <strong>corruption</strong>.
      </>
    ),
  },
  {
    caption: (
      <>
        Replay with <strong>fencing tokens</strong>: the lock service hands out a
        number that <em>increases with every grant</em>. A&apos;s lease came with
        token <strong>33</strong>; B&apos;s with <strong>34</strong>. Writers must
        include their token; storage remembers the highest it has seen.
      </>
    ),
  },
  {
    caption: (
      <>
        B writes with token 34 → storage accepts and records{" "}
        <code>max_token = 34</code>.
      </>
    ),
  },
  {
    caption: (
      <>
        Zombie A wakes and writes with token <strong>33</strong>. Storage checks:
        33 &lt; 34 → <strong>reject</strong>. The stale holder is fenced off — not
        by being told (it can&apos;t be told in time), but by making its writes
        powerless.
      </>
    ),
  },
  {
    caption: (
      <>
        The deep point: the client can&apos;t be trusted to know its own status, so
        the <em>resource</em> enforces ordering. ZooKeeper&apos;s zxid or a
        database&apos;s conditional write (<code>WHERE token ≥ :mine</code> fails)
        serve as the token check. Any lock without fencing is a polite suggestion.
      </>
    ),
  },
];

export default function FencingTokens() {
  return (
    <AnimationShell
      title="Process pauses and fencing tokens"
      subtitle="leases expire; zombies write; tokens fence"
      steps={steps}
    >
      {(step) => {
        const fenced = step >= 5; // second act
        const paused = step >= 1 && step <= 3;
        const zombieWrite = step === 4;
        const aTone = paused ? "warn" : zombieWrite ? "bad" : "default";
        const storageLines =
          step < 3
            ? ["job9: …in progress (A)"]
            : step === 3
              ? ["job9: B's output ✓"]
              : step === 4
                ? ["job9: B's ✓ + A's stale ✗✗"]
                : step === 5
                  ? ["job9: —", "max_token: —"]
                  : step === 6
                    ? ["job9: B's output ✓", "max_token: 34"]
                    : ["job9: B's output ✓", "max_token: 34", "A's write (33): REJECTED"];

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Fencing tokens diagram">
            <VizDefs />

            <Txt x={24} y={26} size={12} weight={700} tone="ink">
              {fenced ? "B · same story, with fencing tokens" : "A · lease without fencing"}
            </Txt>

            {/* lock service */}
            <NodeBox x={290} y={44} w={150} h={54} label="lock service" sub={fenced ? "grants lease + token" : "grants 10s leases"} tone="info" />

            {/* workers */}
            <NodeBox
              x={36}
              y={140}
              w={170}
              h={62}
              label="worker A"
              sub={
                fenced
                  ? step === 5
                    ? "lease + token 33"
                    : step === 6
                      ? "⏸ frozen past expiry"
                      : "woke; writes with token 33"
                  : step === 0
                    ? "holds lease ✓"
                    : paused
                      ? "⏸ GC pause (frozen)"
                      : "woke; thinks it holds lease"
              }
              tone={fenced ? (step >= 7 ? "warn" : "mut") : (aTone as "warn" | "bad" | "default")}
            />
            <NodeBox
              x={514}
              y={140}
              w={170}
              h={62}
              label="worker B"
              sub={
                (fenced ? step >= 5 : step >= 2)
                  ? fenced
                    ? "lease + token 34"
                    : "granted lease ✓"
                  : "waiting…"
              }
              tone={(fenced ? step >= 5 : step >= 2) ? "ok" : "mut"}
            />

            {/* lease grants */}
            <Arrow x1={300} y1={98} x2={150} y2={138} tone="acc" show={step === 0 || step === 5} label={fenced ? "lease · token 33" : "lease (10s)"} />
            <Arrow x1={430} y1={98} x2={580} y2={138} tone="ok" show={fenced ? step >= 5 : step >= 2} label={fenced ? "lease · token 34" : "lease re-granted"} />

            {/* lease expiry note */}
            <g className="tr" opacity={step === 2 ? 1 : 0}>
              <Badge x={150} y={110} label="lease EXPIRED while frozen" tone="warn" />
            </g>

            {/* storage */}
            <g>
              <rect x={250} y={216} width={230} height={84} rx={10} fill="var(--bg)" stroke={step === 4 ? "var(--bad)" : "var(--line-strong)"} strokeWidth={step === 4 ? 1.8 : 1.2} className="tr" />
              <Txt x={266} y={238} size={10} weight={700} mono tone="acc">
                STORAGE {fenced ? "· checks token ≥ max" : ""}
              </Txt>
              {storageLines.map((l, i) => (
                <Txt key={`${step}-${i}`} x={266} y={258 + i * 15} size={10} mono tone={l.includes("✗") ? "bad" : l.includes("REJECT") ? "ok" : "ink"}>
                  {l}
                </Txt>
              ))}
            </g>

            {/* writes */}
            <Arrow x1={206} y1={196} x2={268} y2={216} tone={fenced ? "bad" : zombieWrite ? "bad" : "acc"} show={fenced ? step >= 7 : zombieWrite} label={fenced ? "write · token 33" : "zombie write!"} />
            <Arrow x1={514} y1={196} x2={452} y2={216} tone="ok" show={fenced ? step >= 6 : step >= 3} label={fenced ? "write · token 34" : "write ✓"} />

            <Badge x={360} y={130} label="CORRUPTION" tone="bad" show={step === 4} />
            <Badge x={170} y={252} label="33 < 34 → REJECTED ✓" tone="ok" show={step >= 7} />
          </svg>
        );
      }}
    </AnimationShell>
  );
}
