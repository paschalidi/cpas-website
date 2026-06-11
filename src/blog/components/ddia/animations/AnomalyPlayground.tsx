import { ReactNode, useState } from "react";
import AnimationShell from "./AnimationShell";
import { VizDefs, Txt, Badge, Tone } from "./viz";

/**
 * Race-condition playground: five classic anomalies as two-lane timelines.
 * Each tab is its own step sequence; switching tabs resets the stepper
 * (AnimationShell is keyed by scenario id).
 */

interface Ev {
  label: string;
  tone?: Tone;
}
interface StepDatum {
  caption: ReactNode;
  a?: Ev;
  b?: Ev;
  /** database state lines AFTER this step */
  db: string[];
  badge?: { label: string; tone: Tone };
}
interface Scenario {
  id: string;
  tab: string;
  title: string;
  subtitle: string;
  laneA: string;
  laneB: string;
  steps: StepDatum[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "dirty-read",
    tab: "Dirty read",
    title: "Dirty read",
    subtitle: "isolation: read uncommitted → fix: read committed",
    laneA: "Txn A · auto-mod rule",
    laneB: "Txn B · notifier",
    steps: [
      {
        caption: (
          <>
            A moderation tool runs at <strong>read uncommitted</strong> — the weakest
            isolation. Post #42 is currently visible. Txn A is an auto-moderation rule;
            Txn B sends notification emails.
          </>
        ),
        db: ["post#42: visible"],
      },
      {
        caption: (
          <>
            A begins and flags the post: <code>UPDATE post#42 SET hidden</code>. A has{" "}
            <em>not committed</em> — it&apos;s still deciding whether the rule really
            applies.
          </>
        ),
        a: { label: "write hidden", tone: "acc" },
        db: ["post#42: hidden", "(uncommitted, by A)"],
      },
      {
        caption: (
          <>
            B reads post #42 and sees <code>hidden = true</code> — a value that was
            never committed. That is a <strong>dirty read</strong>: observing another
            transaction&apos;s in-flight write.
          </>
        ),
        b: { label: "read → hidden", tone: "bad" },
        db: ["post#42: hidden", "(uncommitted, by A)"],
      },
      {
        caption: <>Acting on dirty data, B emails the author: &ldquo;your post was removed.&rdquo;</>,
        b: { label: "send email ✉", tone: "warn" },
        db: ["post#42: hidden", "(uncommitted, by A)"],
      },
      {
        caption: (
          <>
            A decides the rule doesn&apos;t apply and <strong>rolls back</strong>. The
            hidden flag never existed, officially — but the email is already in an
            inbox.
          </>
        ),
        a: { label: "ROLLBACK", tone: "bad" },
        db: ["post#42: visible"],
        badge: { label: "DIRTY READ", tone: "bad" },
      },
      {
        caption: (
          <>
            <strong>Fix: read committed.</strong> Readers only ever see committed
            values, so B would have read <code>visible</code>. Nearly every database
            gives you this (or stronger) by default — which is why dirty reads are rare
            in practice but vital to name.
          </>
        ),
        db: ["post#42: visible"],
        badge: { label: "fix: READ COMMITTED", tone: "ok" },
      },
    ],
  },
  {
    id: "read-skew",
    tab: "Read skew",
    title: "Read skew (non-repeatable read)",
    subtitle: "isolation: read committed → fix: snapshot isolation",
    laneA: "Txn A · transfer",
    laneB: "Txn B · dashboard",
    steps: [
      {
        caption: (
          <>
            A finance dashboard (B) sums two ledgers that should always total 1000.
            Isolation is <strong>read committed</strong> — every individual read sees
            only committed data. Watch it still go wrong.
          </>
        ),
        db: ["ledger X: 500", "ledger Y: 500"],
      },
      {
        caption: <>B reads ledger X and gets 500. So far so good.</>,
        b: { label: "read X → 500", tone: "info" },
        db: ["ledger X: 500", "ledger Y: 500"],
      },
      {
        caption: (
          <>
            Meanwhile transfer A moves 100 from X to Y and <strong>commits</strong>.
            Both of A&apos;s writes are perfectly valid, committed data.
          </>
        ),
        a: { label: "X−100, Y+100 ✓", tone: "acc" },
        db: ["ledger X: 400", "ledger Y: 600"],
      },
      {
        caption: (
          <>
            B now reads ledger Y and gets <strong>600</strong> — the post-transfer
            value. Each read was individually legal; together they straddle A&apos;s
            commit.
          </>
        ),
        b: { label: "read Y → 600", tone: "bad" },
        db: ["ledger X: 400", "ledger Y: 600"],
      },
      {
        caption: (
          <>
            B reports a total of <strong>1100</strong>. Money appeared from nowhere —
            an inconsistent snapshot across reads, a.k.a. <strong>read skew</strong>.
            Fatal for backups and analytics, which read everything over a long window.
          </>
        ),
        b: { label: "sum = 1100 ?!", tone: "bad" },
        db: ["ledger X: 400", "ledger Y: 600"],
        badge: { label: "READ SKEW", tone: "bad" },
      },
      {
        caption: (
          <>
            <strong>Fix: snapshot isolation.</strong> The transaction reads everything
            as of one frozen point in time — B would see X=500, Y=500 regardless of
            A&apos;s concurrent commit. Implemented with MVCC, next animation.
          </>
        ),
        db: ["ledger X: 400", "ledger Y: 600"],
        badge: { label: "fix: SNAPSHOT", tone: "ok" },
      },
    ],
  },
  {
    id: "lost-update",
    tab: "Lost update",
    title: "Lost update",
    subtitle: "read–modify–write race → fix: atomic ops / locks / CAS",
    laneA: "Txn A · mod Maya",
    laneB: "Txn B · mod Ben",
    steps: [
      {
        caption: (
          <>
            A post&apos;s <code>report_count</code> is 5. Two moderators file reports at
            the same moment. Each does the innocent pattern:{" "}
            <em>read the counter, add one, write it back.</em>
          </>
        ),
        db: ["report_count: 5"],
      },
      {
        caption: <>A reads the counter: 5.</>,
        a: { label: "read → 5", tone: "info" },
        db: ["report_count: 5"],
      },
      {
        caption: <>B also reads the counter: 5. Both now hold the same stale value in app memory.</>,
        b: { label: "read → 5", tone: "info" },
        db: ["report_count: 5"],
      },
      {
        caption: <>A writes 5+1 = 6 and commits.</>,
        a: { label: "write 6 ✓", tone: "acc" },
        db: ["report_count: 6"],
      },
      {
        caption: (
          <>
            B writes <em>its</em> 5+1 = 6 and commits — silently clobbering A. Two
            reports, counter went up by one. A <strong>lost update</strong>: the
            classic read-modify-write race.
          </>
        ),
        b: { label: "write 6 ✗", tone: "bad" },
        db: ["report_count: 6  (should be 7)"],
        badge: { label: "LOST UPDATE", tone: "bad" },
      },
      {
        caption: (
          <>
            <strong>Fixes,</strong> in order of preference: an atomic operation{" "}
            (<code>UPDATE … SET c = c + 1</code> — the DB does the read-modify-write
            under its own lock); explicit locking (<code>SELECT … FOR UPDATE</code>);
            or compare-and-set (<code>WHERE c = 5</code>, retry on 0 rows). Engine
            nuance: under snapshot isolation, PostgreSQL repeatable-read{" "}
            <em>detects</em> this and aborts one txn; MySQL InnoDB repeatable-read does
            not — know your engine.
          </>
        ),
        db: ["report_count: 7 ✓"],
        badge: { label: "fix: ATOMIC UPDATE", tone: "ok" },
      },
    ],
  },
  {
    id: "write-skew",
    tab: "Write skew",
    title: "Write skew",
    subtitle: "isolation: snapshot → fix: serializable",
    laneA: "Txn A · Maya",
    laneB: "Txn B · Ben",
    steps: [
      {
        caption: (
          <>
            Rule: <em>at least one moderator must stay assigned to the abuse queue.</em>{" "}
            Maya and Ben are both on duty, both exhausted, both click &ldquo;leave
            queue&rdquo; at 23:59. Isolation: <strong>snapshot</strong> — the level
            that fixed read skew.
          </>
        ),
        db: ["on duty: Maya, Ben"],
      },
      {
        caption: <>A checks the rule: count of on-duty mods = 2. Safe for Maya to leave. ✓</>,
        a: { label: "count → 2 ✓", tone: "info" },
        db: ["on duty: Maya, Ben"],
      },
      {
        caption: (
          <>
            B&apos;s snapshot says the same thing: count = 2, safe for Ben to leave. ✓
            Both decisions are valid <em>against their snapshots</em>.
          </>
        ),
        b: { label: "count → 2 ✓", tone: "info" },
        db: ["on duty: Maya, Ben"],
      },
      {
        caption: <>A updates Maya&apos;s row to off-duty and commits.</>,
        a: { label: "Maya off ✓", tone: "acc" },
        db: ["on duty: Ben"],
      },
      {
        caption: (
          <>
            B updates <em>Ben&apos;s</em> row and commits. Different rows — so
            first-committer-wins lost-update detection sees <em>no conflict</em>. The
            queue is now unstaffed. That&apos;s <strong>write skew</strong>: two txns
            read the same data, then each invalidated the other&apos;s premise by
            writing <em>different</em> rows.
          </>
        ),
        b: { label: "Ben off ✓", tone: "bad" },
        db: ["on duty: — (rule broken!)"],
        badge: { label: "WRITE SKEW", tone: "bad" },
      },
      {
        caption: (
          <>
            <strong>Fixes:</strong> true serializable isolation (SSI detects the
            read-write conflict and aborts one txn with a serialization error — the app
            retries), or <em>materialize the conflict</em>: make both txns write a
            common row, e.g. <code>SELECT … FOR UPDATE</code> on the queue row itself,
            so they serialize on a lock.
          </>
        ),
        db: ["on duty: Ben ✓"],
        badge: { label: "fix: SERIALIZABLE", tone: "ok" },
      },
    ],
  },
  {
    id: "phantom",
    tab: "Phantom",
    title: "Phantoms",
    subtitle: "writes that change a search result → fix: constraint / predicate locks",
    laneA: "Txn A · signup",
    laneB: "Txn B · signup",
    steps: [
      {
        caption: (
          <>
            Two people race to claim the username <code>nova</code>. Each transaction
            first checks availability, then inserts. The check is a query over rows
            that <em>don&apos;t exist yet</em> — remember that.
          </>
        ),
        db: ["usernames: ada, zoe"],
      },
      {
        caption: (
          <>
            A: <code>SELECT … WHERE name=&apos;nova&apos;</code> → no rows. Free! ✓
          </>
        ),
        a: { label: "check: free ✓", tone: "info" },
        db: ["usernames: ada, zoe"],
      },
      {
        caption: (
          <>
            B runs the same check: no rows, free ✓. There was <em>no row to lock</em> —
            you can&apos;t attach a lock to something that doesn&apos;t exist.
          </>
        ),
        b: { label: "check: free ✓", tone: "info" },
        db: ["usernames: ada, zoe"],
      },
      {
        caption: <>A inserts &apos;nova&apos; and commits.</>,
        a: { label: "INSERT nova ✓", tone: "acc" },
        db: ["usernames: ada, zoe, nova"],
      },
      {
        caption: (
          <>
            B inserts &apos;nova&apos; too. A&apos;s write changed the result of
            B&apos;s earlier search — a <strong>phantom</strong>. Plain row locks
            can&apos;t prevent it, because the conflict is over a <em>predicate</em>{" "}
            (&ldquo;rows where name=nova&rdquo;), not a row.
          </>
        ),
        b: { label: "INSERT nova ✗", tone: "bad" },
        db: ["usernames: …nova, nova ✗✗"],
        badge: { label: "PHANTOM", tone: "bad" },
      },
      {
        caption: (
          <>
            <strong>Fixes:</strong> a <code>UNIQUE</code> constraint materializes the
            conflict — the second insert fails hard, the app shows &ldquo;name
            taken&rdquo;. Or serializable isolation, where the engine locks the{" "}
            <em>predicate</em> (or an index range covering it — next-key locks), so
            B&apos;s insert waits or aborts.
          </>
        ),
        db: ["usernames: ada, zoe, nova ✓"],
        badge: { label: "fix: UNIQUE / SERIALIZABLE", tone: "ok" },
      },
    ],
  },
];

function ScenarioSvg({ sc, step }: { sc: Scenario; step: number }) {
  const colX = (si: number) => 158 + si * 94;
  const db = sc.steps[step].db;
  const badge = sc.steps[step].badge;

  return (
    <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label={`${sc.title} timeline`}>
      <VizDefs />

      {/* lane rails */}
      <Txt x={16} y={58} size={11} weight={700} tone="ink">
        {sc.laneA}
      </Txt>
      <line x1={16} y1={84} x2={704} y2={84} stroke="var(--line-strong)" />
      <Txt x={16} y={128} size={11} weight={700} tone="ink">
        {sc.laneB}
      </Txt>
      <line x1={16} y1={154} x2={704} y2={154} stroke="var(--line-strong)" />

      {/* time arrow */}
      <Txt x={704} y={24} size={10} anchor="end">
        time →
      </Txt>

      {/* events as pills on the rails */}
      {sc.steps.map((s, si) => {
        const show = si <= step;
        const current = si === step;
        return (
          <g key={si}>
            {s.a ? (
              <g className="tr" opacity={show ? 1 : 0}>
                <EventPill x={colX(si)} y={84} ev={s.a} current={current} />
              </g>
            ) : null}
            {s.b ? (
              <g className="tr" opacity={show ? 1 : 0}>
                <EventPill x={colX(si)} y={154} ev={s.b} current={current} />
              </g>
            ) : null}
          </g>
        );
      })}

      {/* DB state panel */}
      <g>
        <rect x={16} y={192} width={330} height={92} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
        <Txt x={32} y={214} size={10} weight={700} tone="acc" mono>
          DATABASE (committed state)
        </Txt>
        {db.map((line, i) => (
          <Txt key={`${step}-${i}`} x={32} y={238 + i * 20} size={12} tone="ink" mono>
            {line}
          </Txt>
        ))}
      </g>

      {/* verdict badge */}
      {badge ? <Badge x={520} y={236} label={badge.label} tone={badge.tone} show /> : null}
    </svg>
  );
}

function EventPill({ x, y, ev, current }: { x: number; y: number; ev: Ev; current: boolean }) {
  const tone = ev.tone ?? "default";
  const toneVar: Record<string, string> = {
    default: "var(--ink)",
    acc: "var(--accent)",
    ok: "var(--ok)",
    bad: "var(--bad)",
    info: "var(--info)",
    warn: "var(--warn)",
    mut: "var(--muted)",
  };
  const w = 88;
  return (
    <g transform={`translate(${x - w / 2}, ${y - 12})`}>
      <rect
        width={w}
        height={24}
        rx={12}
        fill={current ? toneVar[tone] : "var(--bg)"}
        stroke={toneVar[tone]}
        strokeWidth={1.4}
        className="tr"
      />
      <text
        x={w / 2}
        y={12}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9.5"
        fontWeight={650}
        fill={current ? "var(--bg)" : "var(--ink)"}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        className="tr"
      >
        {ev.label}
      </text>
    </g>
  );
}

export default function AnomalyPlayground() {
  const [tab, setTab] = useState(0);
  const sc = SCENARIOS[tab];

  return (
    <div className="not-prose">
      <div role="tablist" aria-label="Choose an anomaly" className="mt-8 flex flex-wrap gap-1.5">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`rounded-t-lg border border-b-0 px-3.5 py-2 font-mono text-[11.5px] tracking-wide transition-colors ${
              i === tab
                ? "border-line bg-soft font-semibold text-acc"
                : "border-transparent text-mut hover:text-ink"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div className="-mt-8">
        <AnimationShell key={sc.id} title={sc.title} subtitle={sc.subtitle} steps={sc.steps.map((s) => ({ caption: s.caption }))}>
          {(step) => <ScenarioSvg sc={sc} step={step} />}
        </AnimationShell>
      </div>
    </div>
  );
}
