import React from "react";
import DDIAThemeProvider from '../../components/ddia/DDIAThemeProvider';
import {
  H2,
  H3,
  Callout,
  InTheWild,
  KeyTakeaways,
  CheatTable,
  InterviewQA,
  Misconceptions,
} from "../../components/ddia/blocks";
import CodeBlock from "../../components/ddia/CodeBlock";
import SyncVsAsyncReplication from "../../components/ddia/animations/SyncVsAsyncReplication";
import ReplicationLagAnomalies from "../../components/ddia/animations/ReplicationLagAnomalies";
import MultiLeaderConflicts from "../../components/ddia/animations/MultiLeaderConflicts";
import QuorumExplorer from "../../components/ddia/animations/QuorumExplorer";

export default function ReplicationArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          Replication sounds like a checkbox — &ldquo;keep copies on several
          machines&rdquo; — and would be one if data never changed. It changes.
          From that single fact this chapter unfolds three architectures
          (single-leader, multi-leader, leaderless), one ever-present gap
          (replication lag), and the most interview-dense material in the book:
          every &ldquo;design X&rdquo; question eventually asks where writes go
          and what readers see in the meantime.
        </p>

        <H2 id="leaders-followers">Leaders and followers</H2>
        <p>
          The default architecture, and the one inside Postgres, MySQL, MongoDB,
          and Kafka&apos;s partitions alike: route <em>every write</em> through one
          node (the <strong>leader</strong>), which appends it to a replication log
          and streams that log to <strong>followers</strong>. Reads can go
          anywhere; writes have exactly one door. A single door means no write
          conflicts — the leader serializes everything — which is precisely the
          property the other two architectures will give up.
        </p>
        <p>
          The load-bearing decision is hidden in the word &ldquo;streams&rdquo;:
          does the leader <em>wait</em> for followers before acknowledging?
        </p>

        <SyncVsAsyncReplication />

        <H3>Mechanics worth knowing cold</H3>
        <p>
          <strong>Adding a follower</strong> needs no downtime: snapshot the
          leader, copy it, then replay the log from the snapshot&apos;s position
          until caught up — the same catch-up loop a crashed follower runs on
          recovery. <strong>Failover</strong> is the fraught one: detect leader
          death (a timeout — chapter 8 says you can&apos;t be sure), choose the
          most up-to-date follower, repoint clients, and ensure the old leader,
          if it returns, demotes itself rather than dueling its successor.
        </p>
        <Callout type="pitfall">
          <p>
            With async replication, a promoted follower may lack writes the old
            leader acknowledged. Discarding them is the usual remedy, and it is
            quietly radical: <em>durability was promised and then revoked</em>. If
            external systems consumed those writes — an ID allocator, an email
            sender, another database — they now disagree with you, and no amount
            of database-internal recovery fixes a customer who received two
            shipping confirmations with different addresses.
          </p>
        </Callout>

        <InTheWild
          title="Streaming replication, the production version"
          sources={[
            {
              label: "PostgreSQL docs: warm standby / streaming replication",
              href: "https://www.postgresql.org/docs/current/warm-standby.html",
            },
          ]}
        >
          <p>
            PostgreSQL&apos;s replication docs read like this section with knobs:
            standbys tail the WAL, <code>synchronous_commit</code> chooses how many
            standbys must confirm before a commit returns (none, one, a quorum —
            the sync/async dial, per-transaction!), and operators are warned about
            exactly the failover trade-offs animated above. The
            &ldquo;semi-synchronous&rdquo; compromise isn&apos;t textbook
            abstraction; it&apos;s a config line.
          </p>
        </InTheWild>

        <H2 id="replication-lag">Living with replication lag</H2>
        <p>
          Async followers trail the leader by <em>some</em> amount — milliseconds
          on a calm Tuesday, minutes during a backfill. The system is{" "}
          <strong>eventually consistent</strong>: stop writing and replicas
          converge; keep writing and there is always a window where different
          nodes answer differently. &ldquo;Eventually&rdquo; carries no deadline.
          Whether that&apos;s fine depends entirely on <em>which reads</em> fall
          into the window — so the useful skill is recognizing the three classic
          anomalies and their per-anomaly fixes, known as session guarantees:
        </p>

        <ReplicationLagAnomalies />

        <Callout type="insight">
          <p>
            Notice the shape of all three fixes: none of them makes replication
            faster. They <em>route reads</em> so that each user&apos;s personal
            timeline stays coherent, while the system as a whole remains happily
            inconsistent. Session guarantees are cheap because they promise things
            per-user, not globally — and that&apos;s usually all a product needs.
            When it isn&apos;t, you&apos;re shopping for transactions or
            linearizability (chapters 7 and 9), and the bill goes up accordingly.
          </p>
        </Callout>

        <InTheWild
          title="Where the vocabulary comes from"
          sources={[
            {
              label: "Werner Vogels — Eventually Consistent (All Things Distributed)",
              href: "https://www.allthingsdistributed.com/2008/12/eventually_consistent.html",
            },
          ]}
        >
          <p>
            Amazon&apos;s CTO wrote the essay that mainstreamed this section&apos;s
            terms — eventual consistency, read-your-writes, monotonic reads,
            session guarantees — while explaining why Amazon&apos;s infrastructure
            embraced weaker consistency for availability at scale. Worth reading as
            a primary source: it frames these not as defects but as <em>explicit,
            purchasable</em> consistency levels, which is exactly how interviews
            want you to discuss them.
          </p>
        </InTheWild>

        <H2 id="multi-leader">Multi-leader replication</H2>
        <p>
          Single-leader has a tax: every write, worldwide, crosses the network to
          wherever the leader lives. Multi-leader refunds that tax — each
          datacenter (or device, or editor) accepts writes locally and replicates
          asynchronously to its peers — and replaces it with a harder currency:{" "}
          <strong>write conflicts</strong>.
        </p>

        <MultiLeaderConflicts />

        <CodeBlock
          title="version vectors in 12 lines (the “detect concurrency” primitive)"
          lang="text"
          code={`# one counter per leader; a write increments its own slot
v_eu = {EU: 4, US: 7}        # version after EU's rename
v_us = {EU: 3, US: 8}        # version after US's rename

dominates(a, b) = every slot of a >= matching slot of b

if dominates(v_eu, v_us): v_us is older   -> overwrite is safe
if dominates(v_us, v_eu): v_eu is older   -> overwrite is safe
else: CONCURRENT                          -> neither happened-before
      # {EU:4,US:7} vs {EU:3,US:8}: each wins one slot -> concurrent
      # keep both as siblings; merged write carries {EU:4, US:8}`}
        />

        <InTheWild
          title="Multi-leader at streaming scale"
          sources={[
            {
              label: "Netflix Tech Blog — Active-Active for Multi-Regional Resiliency",
              href: "https://medium.com/netflix-techblog/active-active-for-multi-regional-resiliency-c47719f6685b",
            },
          ]}
        >
          <p>
            Netflix&apos;s 2013 active-active write-up is the canonical
            field report: serve users from multiple AWS regions, replicate data
            between them asynchronously, and survive a whole-region outage by
            shifting traffic. Note what makes it tractable — user-centric data
            routed by user (conflict <em>avoidance</em>, way out #3), tolerance for
            eventual consistency in the domain, and heavy investment in the
            routing layer. Multi-leader works best where conflicts are designed
            out, not merged.
          </p>
        </InTheWild>

        <H2 id="leaderless">Leaderless replication and quorums</H2>
        <p>
          The third architecture deletes the leader entirely: any replica accepts
          writes, clients talk to several at once, and consistency is a counting
          argument — <code>w</code> write acks, <code>r</code> read responses,
          overlap guaranteed when <code>w + r &gt; n</code>. No failover exists
          because there&apos;s nothing to fail over.
        </p>

        <QuorumExplorer />

        <Callout type="interview">
          <p>
            The quorum inequality is the most-quoted and most-overclaimed formula
            in system design. Safe claims: a read quorum intersects every
            successful write quorum, so reads see at least one up-to-date copy{" "}
            <em>of fully-acknowledged writes</em>. Unsafe claims: linearizability
            (false — concurrent operations interleave badly even with overlap;
            chapter 9 has the counterexample) and bounded staleness (false —
            sloppy quorums, partial writes, and concurrent updates all leak
            staleness past the math). Say &ldquo;quorums give overlap, not
            ordering&rdquo; and interviewers relax.
          </p>
        </Callout>

        <InTheWild
          title="The paper that started it"
          sources={[
            {
              label: "Amazon Dynamo paper (SOSP 2007)",
              href: "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf",
            },
          ]}
        >
          <p>
            Dynamo — built for Amazon&apos;s shopping carts — assembled this whole
            section&apos;s toolkit in one system: leaderless quorum reads/writes,
            vector clocks with application-side merge (famously, merging cart
            siblings by union, which resurrects deleted items rather than lose
            added ones), hinted handoff with sloppy quorums, and Merkle-tree
            anti-entropy. Cassandra and Riak descend directly from it. The paper
            is also refreshingly explicit that these choices trade consistency for
            availability on purpose.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Three architectures by &ldquo;who accepts writes&rdquo;: one node
              (single-leader — conflicts impossible, failover required), several
              designated nodes (multi-leader — local writes, conflicts inevitable),
              any node (leaderless — no failover, consistency by quorum
              arithmetic).
            </>,
            <>
              Sync vs async is the durability/latency dial; semi-synchronous (one
              sync follower) is the standard compromise, and async failover can
              revoke acknowledged writes.
            </>,
            <>
              Replication lag produces three nameable anomalies — vanished own
              writes, time-travel on refresh, effect-before-cause — fixed by
              session guarantees (read-your-writes, monotonic reads, consistent
              prefix) that route reads rather than speed replication.
            </>,
            <>
              Multi-leader conflict handling is a three-way choice: LWW
              (convergent, lossy, clock-dependent), siblings + version vectors
              (lossless, app merges), or conflict avoidance via per-record home
              leaders.
            </>,
            <>
              <code>w + r &gt; n</code> guarantees read/write overlap — not
              linearizability, not bounded staleness; read repair and anti-entropy
              do the healing, and sloppy quorums trade the overlap away for
              availability.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · the three replication architectures"
          head={["", "Single-leader", "Multi-leader", "Leaderless"]}
          rows={[
            ["Writes go to", "the leader", "any designated leader (e.g. per DC)", "any w of n replicas"],
            ["Write conflicts", "impossible (serialized)", "the central problem", "on concurrent writes (version vectors)"],
            ["On node failure", "failover (promote follower)", "other leaders carry on", "quorum absorbs it; no failover"],
            ["Consistency story", "strong on leader; lag on followers", "eventual + merge policy", "quorum overlap; eventual"],
            ["Canonical systems", "Postgres, MySQL, MongoDB", "multi-region DBs, calendar sync, CouchDB", "Dynamo, Cassandra, Riak"],
            ["Best when", "default; correctness first", "multi-region writes, offline devices", "write availability, no-failover ops"],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · session guarantees against lag"
          head={["Guarantee", "Violation story", "Standard fix"]}
          rows={[
            [
              "Read-your-writes",
              "User posts a comment, reloads, comment is gone (read hit a lagging replica)",
              "Route reads of own-edited data to leader; or track user's last-write time and require caught-up replicas",
            ],
            [
              "Monotonic reads",
              "Refresh shows score 1–0, next refresh shows 0–0 (second read hit a more-lagged replica)",
              "Sticky routing: hash(user) → same replica, one timeline per user",
            ],
            [
              "Consistent prefix",
              "Observer sees the answer before the question (partitions replicate at different speeds)",
              "Causally related writes → same partition; or explicit causal dependencies",
            ],
          ]}
          footnote="All three are per-user/per-session promises — far cheaper than global consistency, and usually sufficient."
        />

        <InterviewQA
          items={[
            {
              q: "Walk me through failover in single-leader replication and where it goes wrong.",
              a: (
                <p>
                  Detect (heartbeat timeout — inherently a guess), elect the most
                  up-to-date follower, repoint writes, recover the old leader as a
                  follower. Failure modes: with async replication the new leader
                  may lack acknowledged writes (discard them → broken external
                  expectations); the old leader may return still believing it
                  leads → split brain, needing fencing/epochs; and timeouts tuned
                  too tight trigger failovers during load spikes, adding load
                  precisely when there&apos;s least to spare. This is why mature
                  ops teams often keep a human in the failover loop.
                </p>
              ),
            },
            {
              q: "Design read-your-writes for a user who posts on mobile and immediately checks on desktop.",
              a: (
                <p>
                  Per-connection tricks (sticky sessions, client-remembered
                  timestamps) fail across devices, so centralize: on each write,
                  record the user&apos;s last-write position (log sequence number)
                  server-side; on each read, pick a replica whose applied position
                  ≥ that, else wait briefly or fall through to the leader.
                  Scope it to data the user can edit — their comments, their
                  profile — and let everything else ride ordinary replicas.
                  Multi-DC wrinkle: route the user&apos;s session to one DC, or
                  replicate the last-write metadata faster than the data.
                </p>
              ),
            },
            {
              q: "Why does w + r > n not give you linearizability?",
              a: (
                <p>
                  Overlap guarantees a read quorum <em>contains</em> a fresh copy;
                  it doesn&apos;t make operations atomic points in time. During a
                  write that has reached some replicas, two readers can both
                  satisfy r yet one sees the new value and a <em>later</em> read
                  sees the old (different overlap nodes answered) — a
                  non-linearizable history. Partial write failures and sloppy
                  quorums widen the cracks. Getting linearizability out of quorums
                  requires extra machinery (read repair before returning, or
                  consensus), at which point you&apos;ve rebuilt chapter 9.
                </p>
              ),
            },
            {
              q: "When would you actually choose multi-leader, and what's your conflict plan?",
              a: (
                <p>
                  Choose it when writes must succeed locally despite WAN
                  partitions: multi-region products, offline-first apps,
                  collaborative editing. Conflict plan, in order of preference:
                  avoid (home each record/user to one leader — most deployments),
                  merge automatically where the data type allows (counters, sets,
                  CRDT-shaped state), keep siblings + explicit merge where loss is
                  unacceptable, LWW only for data you&apos;re comfortable
                  overwriting silently. Saying &ldquo;LWW everywhere&rdquo; without
                  the caveat is the classic red flag.
                </p>
              ),
            },
            {
              q: "Explain read repair and anti-entropy. Why do you need both?",
              a: (
                <p>
                  Read repair: a quorum read that observes stale replicas writes
                  the newest value back — free healing, but only for keys that get
                  read. Anti-entropy: a background process compares replicas
                  (Merkle trees keep comparison sublinear) and syncs differences —
                  covers cold keys, costs background I/O. Read repair alone leaves
                  rarely-read data stale indefinitely, which converts &ldquo;node
                  was down an hour&rdquo; into &ldquo;some keys are wrong for
                  months&rdquo;; anti-entropy alone heals too slowly for hot keys.
                </p>
              ),
            },
            {
              q: "Your monitoring shows replication lag spiking to minutes. What breaks first, and what do you do?",
              a: (
                <p>
                  First casualties: read-your-writes (users&apos; fresh actions
                  vanish on reload), then monotonic reads as load balancing
                  spreads across unevenly-lagged replicas, then any
                  business logic that read from replicas assuming freshness
                  (fraud checks, inventory displays). Mitigations in order:
                  shift critical-path reads to the leader (capacity allowing),
                  enforce a max-lag threshold that ejects replicas from the read
                  pool, shed non-essential read load, and find the cause —
                  typically a long transaction, a schema migration, or an
                  under-provisioned follower.
                </p>
              ),
            },
            {
              q: "Why are version vectors needed in leaderless systems — don't version numbers suffice?",
              a: (
                <p>
                  A single number encodes one timeline; leaderless writes have no
                  single timeline. Two clients can both read version 5 and both
                  write &ldquo;version 6&rdquo; via different replica subsets —
                  numerically identical, causally concurrent, and one will silently
                  eat the other if compared by number. A vector (a counter per
                  writer/replica) makes causality computable: one vector dominating
                  another means safe overwrite; mutual non-domination means
                  concurrent → keep siblings. It&apos;s the data structure that
                  turns &ldquo;newer&rdquo; from a guess into a proof.
                </p>
              ),
            },
            {
              q: "Pick w and r for (a) a read-heavy product catalog, (b) a write-heavy event firehose, (c) a billing ledger.",
              a: (
                <p>
                  (a) Catalog, n=3: w=3, r=1 — every write lands everywhere, reads
                  are single-replica fast; write availability suffers, acceptable
                  for infrequent updates. (b) Firehose: w=1, r=1 (or async
                  fan-out) — maximize ingest, accept that a crashed node loses its
                  unreplicated tail; suitable only because individual events are
                  low-value. (c) Ledger: quorums are the wrong tool — money wants
                  serialized writes, transactions, and an auditable order:
                  single-leader with synchronous replication (or consensus), and
                  say so rather than tuning w/r.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "Replication means my data is backed up.",
              reality: (
                <>
                  Replication copies <em>everything</em>, including the{" "}
                  <code>DROP TABLE</code> you ran at 4:58pm — followers apply it
                  within seconds. Backups protect against bad writes and operator
                  error via point-in-time history; replication protects against
                  node loss and serves reads. You need both, and they fail
                  differently.
                </>
              ),
            },
            {
              myth: "Quorum reads/writes give strong consistency.",
              reality: (
                <>
                  They give read/write <em>overlap</em>. Linearizability fails
                  under concurrent and partially-failed writes; staleness bounds
                  fail under sloppy quorums and unread keys. Quorums are a
                  durability-and-availability tool with helpful — not strong —
                  consistency.
                </>
              ),
            },
            {
              myth: "Multi-leader is just single-leader with extra availability.",
              reality: (
                <>
                  It changes the data model: concurrent writes to the same record
                  become <em>legal</em>, so every write path needs a convergence
                  story (avoid / merge / LWW). Bolting multi-leader onto an app
                  that assumed serialized writes produces silent data loss, not
                  extra nines.
                </>
              ),
            },
            {
              myth: "Replication lag is a few milliseconds; I can ignore it.",
              reality: (
                <>
                  The median is milliseconds; the tail is unbounded — migrations,
                  bulk loads, network partitions, and follower recovery stretch it
                  to minutes or hours. Correctness designed for the median fails
                  exactly when the system is already having a bad day. Design for
                  the window&apos;s existence, monitor its size.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
