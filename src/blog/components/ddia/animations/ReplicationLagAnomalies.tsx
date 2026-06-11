import { ReactNode, useState } from "react";
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Replication-lag anomalies playground: three tabs, each a small horror story
 * inside the lag window, each ending with its session guarantee.
 */

interface StepDef {
  caption: ReactNode;
  /** state flags consumed by the renderer */
  s: number;
}
interface Scenario {
  id: string;
  tab: string;
  title: string;
  subtitle: string;
  steps: StepDef[];
  render: (s: number) => ReactNode;
}

/* ---------- shared layout helpers ---------- */
function Cluster({ fALabel, fBLabel, fA, fB, leader }: { fALabel?: string; fBLabel?: string; fA: string; fB: string; leader: string }) {
  return (
    <>
      <NodeBox x={290} y={20} w={150} h={50} label="leader" sub={leader} tone="acc" />
      <NodeBox x={120} y={120} w={170} h={50} label={fALabel ?? "follower A · fresh"} sub={fA} tone="default" />
      <NodeBox x={430} y={120} w={170} h={50} label={fBLabel ?? "follower B · lagging"} sub={fB} tone="warn" />
      <Arrow x1={330} y1={70} x2={230} y2={116} tone="ok" show label="replicated" />
      <Arrow x1={390} y1={70} x2={490} y2={116} tone="warn" show dashed label="lag…" />
    </>
  );
}

/* ---------- scenario 1: read-your-writes ---------- */
const ryw: Scenario = {
  id: "ryw",
  tab: "Read your writes",
  title: "Read-your-writes",
  subtitle: "she posted it; the replica hasn't heard",
  steps: [
    {
      s: 0,
      caption: (
        <>
          Mira comments on a photo: <code>&quot;love this!&quot;</code>. The write
          goes to the <strong>leader</strong>, which acks immediately
          (async replication). Reads, for scale, go to followers.
        </>
      ),
    },
    {
      s: 1,
      caption: (
        <>
          The leader has the comment; follower A has applied it; follower B —
          half a second behind — has not. Half a second is an eternity:
          Mira&apos;s page reload is already in flight.
        </>
      ),
    },
    {
      s: 2,
      caption: (
        <>
          The reload&apos;s read is load-balanced to <strong>follower B</strong>.
          No comment. To Mira it looks like the site <em>ate her words</em> —
          worse than slow, it looks broken. Other people not seeing it for a
          second is fine; <em>the author</em> not seeing it is not.
        </>
      ),
    },
    {
      s: 3,
      caption: (
        <>
          The guarantee to buy: <strong>read-your-writes</strong> (read-after-write)
          consistency — <em>this user&apos;s</em> reads reflect <em>this
          user&apos;s</em> writes. Nothing promised about anyone else.
        </>
      ),
    },
    {
      s: 4,
      caption: (
        <>
          Implementations, cheapest first: route reads of <em>things the user
          may have edited</em> (own profile, own comments) to the leader; or
          remember the user&apos;s last-write timestamp and only use replicas
          caught up past it (else wait / go to leader); or sticky-route the user
          to one fresh replica.
        </>
      ),
    },
    {
      s: 5,
      caption: (
        <>
          Plot twist: Mira posted on her phone and checked on her laptop —{" "}
          <strong>cross-device</strong> read-your-writes. Per-device timestamps
          don&apos;t transfer; the tracking must be centralized (server-side
          last-write metadata), and with multi-datacenter routing both devices
          may not even hit the same DC. Session guarantees are per-<em>user</em>,
          not per-connection.
        </>
      ),
    },
  ],
  render: (s) => (
    <>
      <Cluster
        leader={s >= 0 ? 'comment ✓ "love this!"' : ""}
        fA={s >= 1 ? 'has comment ✓' : "…"}
        fB={s >= 1 ? "no comment yet" : "…"}
      />
      <NodeBox x={20} y={224} w={150} h={54} label="Mira" sub={s >= 2 ? "“where's my comment?!”" : "posts a comment"} tone={s >= 2 ? "bad" : "info"} />
      <Arrow x1={170} y1={236} x2={300} y2={70} tone="acc" show={s >= 0} label="write" curve={-30} />
      <Arrow x1={170} y1={252} x2={460} y2={170} tone={s >= 2 ? "bad" : "mut"} show={s >= 2} label="reload → routed to B" curve={20} />
      <Badge x={520} y={224} label="her comment: missing ✗" tone="bad" show={s >= 2 && s < 4} />
      <Badge x={360} y={282} label="fix: route own-content reads to leader / fresh-enough replica" tone="ok" show={s >= 4} />
      <Badge x={560} y={250} label="cross-device: track server-side" tone="info" show={s >= 5} />
    </>
  ),
};

/* ---------- scenario 2: monotonic reads ---------- */
const mono: Scenario = {
  id: "mono",
  tab: "Monotonic reads",
  title: "Monotonic reads",
  subtitle: "refresh, and travel back in time",
  steps: [
    {
      s: 0,
      caption: (
        <>
          A live match page. The leader has the score at <strong>1–0</strong>;
          follower A has it; follower B is seconds behind on <strong>0–0</strong>.
          Leo refreshes compulsively, and each refresh is load-balanced
          independently.
        </>
      ),
    },
    {
      s: 1,
      caption: (
        <>
          Refresh #1 lands on follower A: <strong>1–0</strong>. Goal! Leo
          celebrates.
        </>
      ),
    },
    {
      s: 2,
      caption: (
        <>
          Refresh #2 lands on follower B: <strong>0–0</strong>. The goal…
          un-happened? Reading from a <em>more lagged</em> replica after a less
          lagged one moves the user <strong>backwards in time</strong> — more
          disorienting than consistent staleness.
        </>
      ),
    },
    {
      s: 3,
      caption: (
        <>
          The guarantee: <strong>monotonic reads</strong> — a user&apos;s
          successive reads never observe an older state than one they&apos;ve
          already seen. Weaker than strong consistency, stronger than eventual:
          time may pause, never rewind.
        </>
      ),
    },
    {
      s: 4,
      caption: (
        <>
          Standard implementation: make each user&apos;s reads <em>sticky</em> —
          route by <code>hash(user_id)</code> to the same replica, so they ride
          one timeline. (If that replica dies, the failover replica must be at
          least as fresh, or the guarantee needs read-timestamps.) One line of
          routing config; a whole class of support tickets gone.
        </>
      ),
    },
  ],
  render: (s) => (
    <>
      <Cluster leader="score: 1–0" fA="score: 1–0" fB="score: 0–0 (lagging)" />
      <NodeBox x={20} y={224} w={150} h={54} label="Leo" sub={s >= 2 ? "“the goal vanished?!”" : s >= 1 ? "sees 1–0, celebrates" : "refreshing…"} tone={s >= 2 ? "bad" : "info"} />
      <Arrow x1={170} y1={236} x2={200} y2={174} tone="info" show={s >= 1} label="read #1 → A: 1–0" />
      <Arrow x1={170} y1={256} x2={460} y2={174} tone={s >= 2 ? "bad" : "mut"} show={s >= 2} label="read #2 → B: 0–0 ?!" curve={24} />
      <Badge x={520} y={224} label="time went backwards ✗" tone="bad" show={s >= 2 && s < 4} />
      <Badge x={360} y={282} label="fix: sticky routing — hash(user) → one replica, one timeline" tone="ok" show={s >= 4} />
    </>
  ),
};

/* ---------- scenario 3: consistent prefix ---------- */
const prefix: Scenario = {
  id: "prefix",
  tab: "Consistent prefix",
  title: "Consistent prefix reads",
  subtitle: "the answer arrives before the question",
  steps: [
    {
      s: 0,
      caption: (
        <>
          A team chat, sharded: Priya&apos;s messages live on partition 1,
          Sam&apos;s on partition 2 — each with its own leader and its own
          replication lag. An observer, Kim, reads via replicas of both.
        </>
      ),
    },
    {
      s: 1,
      caption: (
        <>
          Priya asks: <code>&quot;Is the demo still at 5?&quot;</code> — written
          to partition 1. Sam, who saw it instantly, replies:{" "}
          <code>&quot;Yes — room 4.&quot;</code> — written to partition 2. Cause,
          then effect.
        </>
      ),
    },
    {
      s: 2,
      caption: (
        <>
          Partition 2&apos;s replica (Sam&apos;s reply) syncs to Kim&apos;s region{" "}
          <em>fast</em>; partition 1&apos;s (the question) is lagging. Kim&apos;s
          screen shows the <strong>answer with no question</strong>. Sam appears
          to be announcing room numbers to no one.
        </>
      ),
    },
    {
      s: 3,
      caption: (
        <>
          This violates <strong>consistent prefix reads</strong>: if writes
          happen in some order, readers should see them in that order. With one
          partition, the log&apos;s order protects you automatically; sharding
          removes the shared log, and with it the free ordering. It&apos;s a{" "}
          <em>causality</em> violation — effect visible before cause.
        </>
      ),
    },
    {
      s: 4,
      caption: (
        <>
          Fixes: write causally related events to the <strong>same
          partition</strong> (one conversation → one shard — often the right
          modeling anyway); or track causal dependencies explicitly (the reply
          carries &ldquo;depends on msg 17&rdquo;, readers wait for 17). Full
          causal consistency is chapter 9&apos;s territory; the chat-app fix is
          usually the partition key.
        </>
      ),
    },
  ],
  render: (s) => (
    <>
      <NodeBox x={60} y={20} w={210} h={50} label="partition 1 · Priya's msg" sub={s >= 1 ? '"demo at 5?" ✓' : "…"} tone={s >= 1 ? "acc" : "default"} />
      <NodeBox x={450} y={20} w={210} h={50} label="partition 2 · Sam's reply" sub={s >= 1 ? '"yes — room 4" ✓' : "…"} tone={s >= 1 ? "acc" : "default"} />
      <NodeBox x={60} y={130} w={210} h={50} label="p1 replica (Kim's region)" sub={s >= 2 ? "…still lagging…" : "…"} tone={s >= 2 ? "warn" : "default"} />
      <NodeBox x={450} y={130} w={210} h={50} label="p2 replica (Kim's region)" sub={s >= 2 ? '"yes — room 4" ✓' : "…"} tone={s >= 2 ? "ok" : "default"} />
      <Arrow x1={165} y1={70} x2={165} y2={126} tone="warn" show={s >= 2} dashed label="slow" />
      <Arrow x1={555} y1={70} x2={555} y2={126} tone="ok" show={s >= 2} label="fast" />
      <Arrow x1={300} y1={45} x2={446} y2={45} tone="info" show={s >= 1} label="caused →" />
      <NodeBox x={290} y={216} w={150} h={54} label="Kim (observer)" sub={s >= 2 ? "sees reply, no question" : "reading…"} tone={s >= 2 && s < 4 ? "bad" : "info"} />
      <Arrow x1={300} y1={232} x2={230} y2={184} tone="mut" show={s >= 2} dashed />
      <Arrow x1={440} y1={232} x2={510} y2={184} tone="mut" show={s >= 2} />
      <Badge x={360} y={200} label="answer before question ✗" tone="bad" show={s >= 2 && s < 4} />
      <Badge x={360} y={292} label="fix: one conversation → one partition (shared log = free ordering)" tone="ok" show={s >= 4} />
    </>
  ),
};

const SCENARIOS = [ryw, mono, prefix];

export default function ReplicationLagAnomalies() {
  const [tab, setTab] = useState(0);
  const sc = SCENARIOS[tab];

  return (
    <div className="not-prose">
      <div role="tablist" aria-label="Choose a lag anomaly" className="mt-8 flex flex-wrap gap-1.5">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`rounded-t-lg border border-b-0 px-3.5 py-2 font-mono text-[11.5px] tracking-wide transition-colors ${
              i === tab ? "border-line bg-soft font-semibold text-acc" : "border-transparent text-mut hover:text-ink"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div className="-mt-8">
        <AnimationShell key={sc.id} title={sc.title} subtitle={sc.subtitle} steps={sc.steps.map((st) => ({ caption: st.caption }))}>
          {(step) => (
            <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label={`${sc.title} diagram`}>
              <VizDefs />
              {sc.render(step)}
            </svg>
          )}
        </AnimationShell>
      </div>
    </div>
  );
}
