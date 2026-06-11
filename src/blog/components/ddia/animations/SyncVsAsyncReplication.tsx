import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Leader-based replication: one sync follower, one async follower, one
 * leader crash — and the question "what does 'committed' actually mean?"
 */

const steps = [
  {
    caption: (
      <>
        Why replicate at all: survive node failures, serve reads near users, and
        scale read throughput. The standard shape: clients send <em>all writes
        to one leader</em>; the leader appends to its log and streams that log to
        followers. The only real design question: does the leader <strong>wait</strong>{" "}
        for followers before telling the client &ldquo;done&rdquo;?
      </>
    ),
  },
  {
    caption: (
      <>
        A write arrives: <code>rename playlist 12 → &quot;Late Drive&quot;</code>.
        The leader applies it as log entry #42 and ships it to both followers.
        Follower 1 is configured <strong>synchronous</strong>, follower 2{" "}
        <strong>asynchronous</strong>. Watch the acks.
      </>
    ),
  },
  {
    caption: (
      <>
        The leader waits for follower 1&apos;s ack, <em>then</em> confirms to the
        client. Guarantee bought: the write now exists on two nodes — leader loss
        costs nothing. Price paid: write latency includes the follower&apos;s
        round-trip, and if follower 1 dies, <strong>writes block</strong>. That
        block is why &ldquo;all followers sync&rdquo; is impractical — the
        standard compromise is <em>semi-synchronous</em>: exactly one sync
        follower, promoted-from if needed, swapped if it slows.
      </>
    ),
  },
  {
    caption: (
      <>
        Follower 2 gets the same entry on no particular schedule — the leader
        never waited for it. The gap between leader and an async follower is{" "}
        <strong>replication lag</strong>: usually milliseconds, but unbounded
        under load, network trouble, or recovery. Every &ldquo;weird read&rdquo;
        in the next animation lives inside this gap.
      </>
    ),
  },
  {
    caption: (
      <>
        Now the crash. The leader dies mid-flight. Failover: detect (timeout —
        chapter 8&apos;s ambiguity applies), then promote the{" "}
        <strong>most up-to-date follower</strong>. Follower 1 was synchronous —
        it has entry #42 and everything before it. Promote it:{" "}
        <strong>zero acknowledged writes lost</strong>.
      </>
    ),
  },
  {
    caption: (
      <>
        Alternate universe: only async followers existed, and follower 2 was two
        entries behind at the crash. Promote it anyway (it&apos;s all you have):
        entries #41–42 — <em>writes the clients were told succeeded</em> — are
        gone. Worse, if anything external saw them (an email sent, a cache
        warmed, an ID handed out), the world now disagrees with the database.
      </>
    ),
  },
  {
    caption: (
      <>
        Failover&apos;s other hazards, while we&apos;re here: the old leader
        comes back believing it still leads → <strong>split brain</strong>, two
        nodes accepting writes (the cure is epochs/fencing — chapters 8–9);
        timeouts tuned too aggressively cause failovers <em>under load spikes</em>,
        which add load. Many teams run failover semi-manually for exactly these
        reasons.
      </>
    ),
  },
  {
    caption: (
      <>
        Takeaways: sync-vs-async is per-follower, and &ldquo;committed&rdquo; is
        a <em>definition you choose</em> — acknowledged where? One more lever:
        what flows down the wire. Statement shipping is fragile
        (<code>NOW()</code>, <code>RANDOM()</code> diverge); physical WAL bytes
        couple versions tightly; <strong>logical (row-level) replication</strong>{" "}
        decouples them — which is what lets you upgrade a replica first and is
        the foundation of change-data-capture in chapter 11.
      </>
    ),
  },
];

export default function SyncVsAsyncReplication() {
  return (
    <AnimationShell
      title="Sync vs async replication"
      subtitle="what does “committed” mean, and who pays for it?"
      steps={steps}
      interval={3300}
    >
      {(step) => {
        const wrote = step >= 1;
        const synced = step >= 2;
        const lagged = step >= 3;
        const crash = step === 4 || step === 5;
        const altWorld = step === 5;

        const leaderLog = wrote ? "…#40 #41 #42" : "…#40 #41";
        const f1Log = synced ? "…#40 #41 #42" : "…#40 #41";
        const f2Log = altWorld ? "…#40" : lagged ? "…#40 #41 #42" : "…#40";

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Sync vs async replication diagram">
            <VizDefs />

            <NodeBox x={16} y={120} w={120} h={54} label="client" sub={synced ? "got OK ✓" : wrote ? "waiting…" : ""} tone={synced ? "ok" : "default"} />

            <NodeBox
              x={250}
              y={114}
              w={170}
              h={66}
              label="leader"
              sub={crash ? "CRASHED" : wrote ? `log: ${leaderLog}` : "accepts all writes"}
              tone={crash ? "bad" : "acc"}
              fillTone={crash ? "bad" : undefined}
            />
            <g className="tr" opacity={crash ? 1 : 0}>
              <Txt x={335} y={108} size={22} weight={800} tone="bad" anchor="middle">✕</Txt>
            </g>

            <NodeBox
              x={530}
              y={36}
              w={176}
              h={62}
              label="follower 1 · SYNC"
              sub={step === 4 ? "promoted → new leader ✓" : `log: ${f1Log}`}
              tone={step === 4 ? "ok" : synced ? "ok" : "default"}
              dim={altWorld}
            />
            <NodeBox
              x={530}
              y={196}
              w={176}
              h={62}
              label="follower 2 · ASYNC"
              sub={altWorld ? "promoted… missing #41 #42 ✗" : `log: ${f2Log}`}
              tone={altWorld ? "bad" : lagged ? "default" : "mut"}
            />

            {/* write + ack */}
            <Arrow x1={136} y1={138} x2={246} y2={138} tone="acc" show={wrote && !crash} label='write "Late Drive"' />
            <Arrow x1={246} y1={158} x2={136} y2={158} tone="ok" show={synced && !crash} label="OK (after sync ack)" />

            {/* replication streams */}
            <Arrow x1={420} y1={128} x2={526} y2={76} tone="acc" show={wrote && !crash} label="#42" />
            <Arrow x1={526} y1={92} x2={420} y2={144} tone="ok" show={synced && !crash} label="ack ✓ (leader waits)" labelDy={12} />
            <Arrow x1={420} y1={166} x2={526} y2={218} tone="warn" show={wrote && !crash} dashed label={lagged ? "#42 (eventually)" : "…lag…"} />

            {/* lag note */}
            <g className="tr" opacity={step === 3 ? 1 : 0}>
              <Badge x={470} y={266} label="replication lag: ms usually, unbounded sometimes" tone="warn" />
            </g>

            {/* crash-era annotations */}
            <Badge x={335} y={236} label="ZERO acknowledged writes lost" tone="ok" show={step === 4} />
            <Badge x={335} y={236} label="acked writes #41–42 LOST" tone="bad" show={altWorld} />
            <g className="tr" opacity={altWorld ? 1 : 0}>
              <Txt x={16} y={290} size={10.5} tone="bad" weight={600}>
                clients were told OK · emails sent, caches warmed, IDs issued — the outside world now remembers writes the DB forgot
              </Txt>
            </g>

            {/* hazards panel */}
            <g className="tr" opacity={step === 6 ? 1 : 0}>
              <rect x={16} y={28} width={420} height={70} rx={10} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
              <Txt x={32} y={48} size={9.5} mono weight={700} tone="warn">FAILOVER HAZARDS</Txt>
              <Txt x={32} y={66} size={10.5}>old leader returns → split brain (fence with epochs)</Txt>
              <Txt x={32} y={84} size={10.5}>aggressive timeouts → failovers during load spikes → more load</Txt>
            </g>

            {/* shipping-format panel */}
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <rect x={16} y={20} width={460} height={84} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={32} y={40} size={9.5} mono weight={700} tone="acc">WHAT FLOWS DOWN THE WIRE</Txt>
              <Txt x={32} y={58} size={10.5}>statements: fragile (NOW(), RANDOM() diverge)</Txt>
              <Txt x={32} y={74} size={10.5}>physical WAL: byte-exact, version-locked</Txt>
              <Txt x={32} y={92} size={10.5} tone="acc">logical rows: version-flexible → zero-downtime upgrades, CDC</Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
