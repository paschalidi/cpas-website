import React, { useState, useEffect, useCallback } from "react";
import DDIAThemeProvider from "../blog/components/ddia/DDIAThemeProvider";

/* ─── Data ─── */

interface DesignQuestion {
  id: number;
  title: string;
  prompt: string;
  clarify: string;
  envelope: string;
  design: string;
  deepDives: string;
  failureModes: string;
  ifPushed: string;
}

const questions: DesignQuestion[] = [
  {
    id: 1,
    title: "Design the home feed for a social app (200M DAU)",
    prompt: `Users follow each other and post short updates. Design the home timeline: when I open the app, I see recent posts from everyone I follow. 200M DAU. Reads must feel instant.`,
    clarify: `Read:write ratio? (~100:1 — feeds are read-heavy.) Follower distribution? (Power law — median 200, top accounts 50M+.) Freshness requirement? (A few seconds of staleness is fine; your own post must appear immediately.) Ranked or chronological? (Start chronological; ranking is a layer on top.) p99 read? (≤ 200 ms.)`,
    envelope: `200M DAU × 3 posts/day ≈ 7k posts/s average, plan 5× peak ≈ 35k/s. Pure push with median 200 followers ≈ 7M timeline inserts/s at peak — before the celebrity with 50M followers posts and demands 50M inserts for one write. That single number forces the hybrid design. Reads: 200M × 20 opens/day ≈ 45k feed reads/s average, 5× peak ≈ 225k/s — must be served from precomputed data, not fan-out-on-read joins.`,
    design: `write path: user → Post Service → Posts DB (sharded by author). Post-events log (partitioned by author_id) → Fan-out Workers → Timeline Cache (per-user list, capped ~800 ids). Celebrity posts stored, NOT fanned out.

read path: feed read → Feed Service → merge(timeline_cache[user], recent_posts(followed_celebrities)) → hydrate post ids → posts (cache-aside).`,
    deepDives: `Push vs pull vs hybrid: fan-out-on-write precomputes the read (cheap reads, write amplification = follower count); fan-out-on-read is cheap writes, expensive hot reads. Pure push dies on celebrities (50M inserts/post); pure pull dies on read latency. Hybrid: push for accounts under ~50k followers, pull celebrity posts at read time and merge.

Timeline store: per-user list of post IDs (not bodies), capped at ~800 entries. Redis lists give µs reads; at 200M users × 800 × 16 B ≈ 2.5 TB — feasible but expensive, so: Redis for active users, wide-column store as durable tier. The timeline is derived data — rebuildable from posts + the social graph.

Your own post appears instantly: fan-out is async (seconds of lag). Client locally echoes the new post; the feed service inserts the user's own recent posts into their merge — a session guarantee implemented by routing.

Ordering and pagination: chronological per feed via post timestamps is fine — but timestamps across shards skew, so use snowflake-style IDs as cursors and accept approximate cross-author ordering. Cursor pagination (posts older than id X), never offset.`,
    failureModes: `Fan-out consumer lag is the health metric — feed staleness; alert on lag-vs-SLO. Celebrity posting causes a read-side thundering herd on that post's body → cache aggressively at the edge on publish. Hot follower problem (user following 10k celebrities) caps the pull-merge — bound merge inputs, degrade gracefully. If timeline cache cluster dies: serve via pull-model fallback at degraded latency, rebuild lazily.`,
    ifPushed: `Ranking = replace the merge's sort with a scorer over a candidate set (cached timeline + pulled celebrity posts + maybe recommendations) — the storage architecture barely changes, which is why the derived-data framing matters.`,
  },
  {
    id: 2,
    title: "Design payment processing that never double-charges",
    prompt: `E-commerce checkout. Users pay by card via an external payment provider (PSP). Networks are flaky, users double-click, services crash. Design it so a customer is never charged twice — and walk me through the failure cases.`,
    clarify: `Volume? (~1k payments/s peak.) One PSP or many? (One now, abstract for more.) Latency? (Synchronous-feeling checkout, a few seconds OK.) What's worse, a missed charge or a double charge? (Double charge — optimize integrity over completion rate.)`,
    envelope: `Every layer below the user dedupes only its own scope — TCP per connection, the broker per producer session, the DB per transaction. A duplicate born from a user retry after a lost response passes through all of them. So correctness must be end-to-end: an operation identity minted at the moment of intent, enforced at the final write.`,
    design: `client (mints op_id at "Pay" tap; reuses it on every retry) → POST /payments {op_id, cart, amount} → Payment API → payments DB: INSERT payment(op_id UNIQUE, state=CREATED) on conflict → return existing payment's state/result. Same txn: INSERT outbox(event: PaymentRequested). Outbox relay → payments log (keyed by payment id). PSP Worker → PSP charge API (with PSP idempotency key = op_id). Result events → state machine: CREATED → AUTHORIZED → CAPTURED. Webhooks from PSP → dedupe by event id → same state machine. Nightly reconciliation: our ledger vs PSP statement.`,
    deepDives: `Idempotency, end to end: The client generates op_id (UUID) when the user taps Pay and reuses it on every retry. The payments table has op_id UNIQUE; insert-or-return-existing makes our side idempotent. The PSP call carries the same key, making their side idempotent. A lost response anywhere is safe: the retry hits a unique constraint or the PSP's dedupe and returns the original outcome.

Why not a distributed transaction with the PSP? Can't and shouldn't: the PSP is an external system (no shared 2PC), and even internally 2PC's in-doubt state would hold locks hostage. Instead: state machine + outbox. The local DB transaction atomically records the payment and the intent-to-charge (outbox row) — so "saved but never charged" and "charged but never saved" are both impossible.

Timeouts against the PSP are the hard case: A timeout means unknown outcome — the charge may have succeeded. Never blind-retry a different op_id; retry the same idempotency key with backoff + jitter under a retry budget, and if still unknown, park the payment in PENDING_VERIFICATION and let a verifier query the PSP by key.

The ledger is event-sourced: Money state transitions are appended, never updated in place: AUTHORIZED, CAPTURED, REFUND_ISSUED events; current state is a fold. Auditors get history; bugs get replay; corrections are compensating entries, not edits.`,
    failureModes: `Duplicate PSP webhooks (they're at-least-once too) → dedupe table on their event id. Outbox relay down → payments accumulate in CREATED; alert on oldest-unrelayed age. State machine guards illegal transitions (a late AUTHORIZED arriving after FAILED is logged, not applied). Reconciliation job is the integrity audit — any drift between our ledger and the PSP statement pages a human. Monitor: charge success rate, p99 end-to-end, unknown-outcome queue depth, reconciliation diff count (should be ~0).`,
    ifPushed: `What's your exactly-once guarantee, precisely? Effects, not delivery: duplicates exist at every layer and are neutralized — by the unique constraint, the PSP key, and webhook dedupe. The scope of each mechanism is finite and I can name where each one ends.`,
  },
  {
    id: 3,
    title: "Fix the architecture: search index and cache drifting from the database",
    prompt: `Product catalog lives in Postgres. Search is Elasticsearch, hot reads come from Redis. The app updates all three, and they keep disagreeing — wrong prices in search, stale cache. Redesign the sync.`,
    clarify: `The app is doing dual writes, and dual writes fail two ways with no error: (1) race — two concurrent price updates apply in one order in Postgres and the opposite order in Elasticsearch (each system serializes independently) → permanent silent divergence; (2) partial failure — app writes Postgres, crashes before Redis → stale cache until luck evicts it. The fix is topological: one system decides order; everyone else derives.`,
    envelope: `Appoint the database the sole writer-of-record; everything else becomes a derived copy fed from the DB's own ordered history.`,
    design: `app → Postgres (sole writer of record) → logical replication slot → CDC connector (Debezium-style; emits row-change events with the commit LSN, keyed by product_id) → changes log (per-key ordering preserved by partitioning) → Indexer → Elasticsearch (idempotent upsert, version=LSN). Cache filler → Redis (SET with version guard). Future: warehouse loader / anything else: just subscribe. Bootstrap: initial snapshot + log replay. Deletes: tombstone events.`,
    deepDives: `Why CDC beats "publish an event from the app": App-published events are dual writes in a costume (DB write + publish can still diverge). CDC tails the database's own commit log, so the event stream is exactly what committed, in commit order, including writes from migrations, admin tools, and that one cron job nobody remembers.

Idempotent, ordered application: Events are keyed by product_id → one partition → all changes to a product arrive everywhere in the same order. Consumers upsert with the event's log position as a version (if incoming.lsn > stored.lsn), so redeliveries and restarts are no-ops — at-least-once delivery, exactly-once effect.

Bootstrapping a new consumer: Two clean options: snapshot-then-stream (consistent snapshot at LSN X, then replay from X), or maintain a compacted topic (latest event per key) that any new consumer reads from offset 0 to reach current state.

The consistency contract changes: Search and cache now lag by pipeline latency (normally < 1 s). That kills implicit read-your-writes: a seller who edits a price and immediately searches may see the old one. Handle at the product level: the seller's own-listings screen reads Postgres; buyer-facing search tolerates seconds of staleness.`,
    failureModes: `Consumer lag is staleness — export it per consumer, alert against the product SLO and against retention. Replication slot risk: if the connector dies and the slot is forgotten, Postgres retains WAL until the disk fills — monitor slot lag, cap retention, have a slot-rebuild runbook. Elasticsearch mapping change / reindex = the reprocess-and-switch move: build index-v2 from the compacted topic in parallel, flip the alias atomically, keep v1 for rollback. Poison events go to a dead-letter topic with alerting, never block the partition silently.`,
    ifPushed: `Why not just short TTLs on the cache? TTLs bound staleness but don't create ordering — the race still leaves search wrong forever, and a 30 s TTL is both too stale for sellers and a thundering-herd machine on hot keys. TTLs are a backstop, not a sync strategy.`,
  },
  {
    id: 4,
    title: "Design ticket sales for a 50,000-seat arena (no double-selling)",
    prompt: `Concerts go on sale at 10:00:00 and 2M people show up for 50k seats. A seat must never be sold twice. Users pick specific seats. Go.`,
    clarify: `Reserved seating (specific seat) — yes. Hold-then-pay flow? (Yes — industry standard: short hold, then payment.) Acceptable to queue users? (Yes — fairness matters more than instant access.) Oversell tolerance? (Zero for seats; this isn't airline overbooking.)`,
    envelope: `2M arrivals in ~60 s = 33k requests/s spike against 50k sellable units — demand exceeds supply 40×, so the design's first job is shedding and sequencing demand, not raw write throughput. Seat-state writes are small: 50k holds + 50k confirms; the read storm (seat maps) is the volume problem.`,
    design: `2M users → Virtual Waiting Room (queue + token bucket: admit ~2k/s, signed admission tokens; absorbs the spike, adds fairness) → Seat-Map Service (read-optimized view, per-section caches, "mostly accurate" — truth is decided at hold time, not render time) → Hold Service → Seats DB, sharded by (event_id, section). One row per seat: (event, seat) PK, status ∈ {AVAILABLE, HELD(hold_id, expires_at), SOLD}. Hold = conditional update: ... WHERE status='AVAILABLE'. Payment (Q2's machinery: op_id = hold_id, outbox, PSP idempotency key). Confirm = conditional update: WHERE status='HELD' AND hold_id=:h. Expiry sweeper / TTL releases stale holds.`,
    deepDives: `Model the conflict as a row — the write-skew lesson: The naive design ("check seat free, then insert a booking") is check-then-act: under snapshot isolation two buyers both read AVAILABLE and both insert. Fix by materializing the conflict: one row per physical seat exists up front, and acquisition is a single atomic conditional update (UPDATE … SET status='HELD' … WHERE status='AVAILABLE') — the database's row-level atomicity arbitrates; exactly one writer wins.

Holds are leases — so think in lease failure modes: A hold has a TTL (~5 min). Confirmation must be fenced: WHERE hold_id = :mine AND status='HELD' — so a user whose hold expired cannot confirm a seat that was re-held by someone else. The hold_id doubles as the payment op_id, making the whole hold→pay→confirm chain idempotent under retries.

Hot-partition reality: All writes for one event hit one logical dataset at 10:00:00 — shard by (event_id, section) so the on-sale spreads across ~50–100 partitions. The seat map read storm is served from per-section cached views (rebuilt from seat-change events).

Saga, not distributed transaction: Hold → charge → confirm spans seat DB and PSP; no atomic commit exists across them. It's a saga with compensation: payment fails or times out → hold expires/released (compensating action); payment succeeds but confirm crashes → confirm is idempotent and retried by a recovery worker.`,
    failureModes: `Sweeper down → seats stuck in HELD → sellable inventory shrinks: alert on held-seat age histogram. Retry storms at on-sale → admission tokens are the budget; also rate-limit per user. Bots → the waiting room is also the defense point (tokens, captcha, per-account caps). Monitor: hold success rate, hold→confirm conversion, payment unknown-outcome queue, per-shard write latency. Integrity audit: SOLD rows must equal confirmed payments — run the reconciliation.`,
    ifPushed: `General-admission (counted, not seated)? Different shape: a counter, not rows — sharded counters with a small over-allocation buffer, or a single log partition serializing decrements; tiny oversell + apology (refund) may now be acceptable. Same principles, different conflict materialization.`,
  },
  {
    id: 5,
    title: "Take our SaaS active-active across US and EU",
    prompt: `B2B project-management SaaS, currently single-region (US). We need an EU region: EU customers want low latency and data residency, and leadership wants to survive a full region outage. Design it.`,
    clarify: `Can a tenant's data live in one designated region? (Yes — and residency requires it for EU tenants.) Cross-region teams reading each other's projects? (Yes, must work.) RPO/RTO for region loss? (Minutes of data loss tolerable for DR? Push: acked writes should survive — let's design for RPO≈0 on acknowledged writes within the home region, small RPO across regions, RTO < 15 min.)`,
    envelope: `"Active-active" does not have to mean "multi-leader on the same data." The cheapest conflict is the one that never happens — so the backbone is conflict avoidance: every tenant has a home region, and both regions are simultaneously active for their own tenants. True multi-leader is confined to the few features that genuinely need it.`,
    design: `Global routing layer (anycast/GeoDNS + tenant→home map from a consensus-backed control plane; map changes are fenced) → US region (leader DB for US tenants, sync follower in another AZ, async cross-region replica of EU data for reads + DR) / EU region (leader DB for EU tenants, same pattern). Caches/search: derived via CDC, per region. Writes: always routed to the tenant's home region. Reads: local replica OK, with session guarantees for the writer.`,
    deepDives: `Replication posture = the durability/latency dial, set per scope: Within a region: semi-synchronous (one sync follower in another AZ) — acked writes survive node loss with near-zero latency tax; RPO≈0 for node/AZ failure. Across regions: asynchronous — physics makes sync intercontinental writes a 100+ ms tax per write. I say the consequence: region-loss failover can lose the last seconds of acked writes (cross-region RPO > 0), and we choose that knowingly, monitor the replication lag as "current RPO."

Failover without split brain: Region failover = re-homing tenants, which is exactly the two-leaders risk. The tenant→home map lives in a small consensus-backed control plane (its quorum spans 3 regions, so it survives one); re-homing bumps a per-tenant epoch, and databases reject writes carrying a stale epoch — fencing at the data layer.

Cross-region reads with sane semantics: An EU user reading a US-homed project reads the local async replica — fast, seconds-stale. Session guarantees where staleness is visible: after writing (comment on the US project — write routed to US), the user's next reads of that object go to the home region or wait for the replica to pass their write's LSN, tracked server-side per user.

Where true multi-leader is allowed: Presence, typing indicators, and collaborative-cursor state: per-region writes with CRDT-style merge. Everything with invariants (billing, permissions, project structure) stays single-home.`,
    failureModes: `Monitor cross-region lag as RPO and publish it. Residency: EU tenants' backups, CDC topics, and derived stores must also stay EU — data flows are tagged by tenant home. Brownout (region degraded, not dead) is nastier than clean death: health checks per dependency, partial re-homing of only the affected tenants. Game-day the failover quarterly; an untested failover is fiction.`,
    ifPushed: `Why not Spanner-style synchronous global consistency? You can buy external consistency with consensus-per-write and clock infrastructure — at write latencies bounded by inter-region RTTs and a much bigger bill. For a project tool whose invariants are per-tenant, homing gives the same practical correctness for a fraction of the cost.`,
  },
  {
    id: 6,
    title: "Design a billing-grade ad-click analytics pipeline",
    prompt: `We sell ads. Every click must be counted per campaign per minute: dashboards for advertisers should be seconds-fresh, and month-end invoices are generated from the same counts. Mobile SDKs send events. Sometimes we fix counting logic and need to recompute history. Design it.`,
    clarify: `Volume? (~500k events/s peak.) Invoice tolerance for error? (Effectively zero — money.) Dashboard tolerance? (Approximate is fine, freshness matters.) How late can events legitimately arrive? (Mobile offline — minutes commonly, hours in the tail.)`,
    envelope: `A phone in a tunnel emits a click at 10:02 that arrives at 10:07. If we count by processing time, the 10:07 minute shows a phantom spike and 10:02 undercounts — the dashboard would be recording our pipeline's moods, and the invoice would bill the wrong minute. Event time with explicit lateness handling is non-negotiable for billing.`,
    design: `SDKs → Collectors (assign server receive-ts too; client event-ts kept) → clicks log (keyed by campaign_id; long retention + tiered storage — the raw immutable record everything is derived from) → Stream processor (event-time tumbling 1-min windows per campaign; watermark = observed event-time progress − allowed lateness; late events after watermark → corrections + late-output stream; state checkpointed; output transactional with input offsets) → dashboards store (fast OLAP; accepts updates; freshness > precision) / billing counts table: UPSERT keyed (campaign, minute, revision) — idempotent sink, corrections re-emit. Monthly: invoice job reads billing counts. Nightly: reconciliation — raw-log totals vs sum(billing counts). Logic v2: new job replays log from 0 → counts_v2 → compare → atomic switch.`,
    deepDives: `Two consumers, two policies — timeliness vs integrity made concrete: The dashboard wants timeliness: emit early, drop very-late stragglers, never block on completeness. Billing wants integrity: counts must converge to exactly the raw truth — so late events update: the processor re-emits a corrected (campaign, minute) with a revision number, and the sink upserts. Same stream, two sinks, two lateness policies.

Exactly-once, with its scope named: Within the stream system: transactional output + offset commit. At the boundary: the billing sink is idempotent by key (campaign, minute, revision) — duplicates collapse on upsert.

Watermarks are a calibrated bet — instrument the bet: Allowed lateness starts where the measured arrival-delay distribution says (e.g., p99.9 of event-ts→arrival), and we monitor late-after-watermark volume per source; if an SDK version starts buffering longer, the watermark policy is a config change, not a redesign.

Reprocessing = the kappa move: Counting logic changes (new fraud filter): keep the raw log; launch the v2 job from offset 0 against a parallel counts_v2; backfill at disk speed while v1 keeps serving; diff v1 vs v2 (the diff is itself the impact analysis for finance); switch readers atomically; keep v1 for rollback.

Trust, but verify: Money pipelines get audited by construction: nightly job recounts from the raw log (cheap batch) and compares to the serving counts. Drift > ε pages someone.`,
    failureModes: `Consumer lag = dashboard staleness and shrinking replay headroom — alert on lag-vs-retention. Hot campaign (a viral ad) skews one partition: key by campaign but pre-aggregate per task before the keyed stage (combiner pattern), or salt the few whales. Duplicate clicks from SDK retries: SDK attaches a client event-id; processor dedupes within a window — duplicates beyond it are caught by reconciliation. Schema evolution of the event: registry-enforced compatibility.`,
    ifPushed: ``,
  },
  {
    id: 7,
    title: "Design a distributed job scheduler (\"cron as a service\")",
    prompt: `Teams register jobs: "run this webhook/task at 02:00 daily." Tens of thousands of jobs, a fleet of workers. A job must not run concurrently twice — last week two workers both ran the billing job. And the scheduler itself can't be a single point of failure. Design it.`,
    clarify: `Missed-run vs double-run, which is worse? (Double — but jobs should eventually run.) Job duration? (Seconds to hours.) Exactly-once required? (Push on this: I'll deliver at-least-once triggering with non-concurrent execution, and make true effect-exactly-once the job owner's contract via idempotency — and I'll say why.)`,
    envelope: `"Exactly one worker runs the job" cannot be guaranteed by the worker's own belief — a GC pause or partition makes any "I hold the lock" check stale between checking and acting. So: leases for efficiency (usually one runner), fencing for safety (a zombie's effects are rejected), idempotency for the effects themselves.`,
    design: `Control plane: job definitions DB + coordination service (etcd/ZK-style, consensus-backed). Scheduler (HA: leader-elected via the coordination service; standby followers; schedules from the LEADER's clock only) → enqueue due runs: run_id = (job_id, scheduled_ts) ← idempotency key. Runs log/queue → Workers: claim run with a LEASE from coordination service → receive (lease, FENCING TOKEN = monotonically increasing) → heartbeat lease while running; renew or die → all effects carry the token: results store rejects writes with token < max seen; webhook targets receive token; idempotency by run_id. Run state machine: SCHEDULED → CLAIMED → RUNNING → SUCCEEDED/FAILED. Reaper: expired-lease runs → re-enqueued (at-least-once).`,
    deepDives: `Walk the zombie, then kill it: Worker A claims the 02:00 billing run, gets lease + token 41, starts, then GC-pauses for 90 s. Lease expires; the reaper re-enqueues; Worker B claims with token 42 and runs. A wakes and writes its results — rejected, because the results store has seen 42. Re-checking the lease before writing would not have saved A: the pause can land between check and write. Safety lives at the resource, not in the client's self-image.

Why at-least-once + idempotent, not at-most-once? At-most-once means a crash after claim, before effect, silently skips the 02:00 billing run — the failure mode the team would discover at month-end. Re-running a well-keyed idempotent job is cheap; a silently missed run is not.

Scheduler HA without double-firing: Leader election via the coordination service; only the leader enqueues; enqueue is idempotent on (job_id, scheduled_ts) so a leadership handover that overlaps a tick can't create two runs. Time comes from the leader's clock (NTP-monitored); durations and timeouts use monotonic clocks.

Misfire policy is product, not plumbing: If the system was down across a job's time: run-once-late, run-all-missed, or skip — per-job configuration, because "what does 02:00 mean if we were down until 04:00" has no universal answer.`,
    failureModes: `Coordination service is the heart — it's small, consensus-backed, and the only thing that must be strongly consistent; everything else degrades gracefully. Monitor: schedule delay p99 (due-time → start), lease-expiry rate (zombie indicator: GC tuning or lease too short), re-run rate, queue depth. Thundering herd at 00:00 (everyone schedules midnight): jitter the dispatch within a tolerance window. Pathological job (runs 9 h, hammers a DB): per-job timeouts, resource quotas, and concurrency caps are part of the job spec.`,
    ifPushed: `Why not just SELECT … FOR UPDATE a row in Postgres as the lock? Fine for advisory mutual exclusion among well-behaved processes in one DB — but the lock dies with the transaction/connection (so long jobs hold transactions open), and it gives no fencing for effects outside that database. Single-DB world: acceptable. Fleet with external effects: leases + tokens.`,
  },
  {
    id: 8,
    title: "Design a collaborative, offline-capable notes app (local-first)",
    prompt: `Think Notion-lite: rich-text notes, folders, sharing. Requirements: edits feel instant (no spinner per keystroke), full offline editing on mobile that syncs later, and real-time collaboration when two people edit the same note. Design the data layer.`,
    clarify: `Offline editing means every device is a leader — this is multi-leader replication whether we like it or not, so the design question is the convergence story, not whether conflicts exist. Last-write-wins is disqualified immediately: two people editing one note concurrently is the normal case, and LWW silently destroys one side's work.`,
    envelope: `The central choice — OT vs CRDT: Operational Transformation (Google-Docs lineage): clients send operations; a central server transforms and orders them. Mature for text, smaller metadata — but the server is mandatory in the hot path (offline = long divergence the transform must untangle; no P2P), and correctness of transform functions is notoriously subtle. CRDTs: data types whose merges are commutative — replicas apply each other's ops in any order and mathematically must converge; offline and peer-to-peer are native. Costs: per-character metadata and tombstone growth (modern implementations compress this well), and "convergent" ≠ "always what the user meant." Choice: CRDT (a sequence CRDT for text, maps/sets for note properties), because offline-first is a headline requirement and OT's server-in-the-loop fights it.`,
    design: `Device: local store (full replica of user's notes). Edits → applied locally instantly → appended as CRDT ops. When online: Sync service: per-note op log (durable, ordered arrival; order does NOT decide correctness — CRDT merge does; log = delivery + replay). Fan out new ops to connected replicas (WebSocket push). Periodic snapshot + compaction of op history per note. Presence/cursors: ephemeral channel (not persisted). Server-side authority (NOT CRDTs): permissions/ACLs, share links, billing, note-moves across shared folders → linearizable service + coordination.`,
    deepDives: `Convergence by construction: Two phones edit offline for a day; on reconnect each pulls the other's ops and merges — same final note on both, guaranteed by the data type, no conflict-resolution code in the app and no "pick a version" dialogs for text. The op log's job is therefore delivery, durability, and bootstrap (new device = latest snapshot + tail of ops), not ordering-for-correctness — which is what makes the server boring and replaceable.

Where CRDTs stop: Invariants don't merge: "only editors can write," unique workspace slugs, seat counts. Those are server-side, linearizable decisions — a permission revocation is enforced at the sync service, with the honest caveat that an offline device edits locally until it reconnects and gets rejected; we surface that in UX rather than pretend otherwise.

Growth management: Text CRDTs accrue tombstones and ids; per-note snapshots (materialized state at version v) + pruned op history keep sync payloads and memory sane. New-device sync = snapshot + ops since — the state-is-a-fold-of-the-changelog identity, applied per note.`,
    failureModes: `Sync service is stateless-ish over the op store → scale horizontally; partition op storage by note_id. Hot note (200 cursors in the all-hands doc): per-note fan-out is the bottleneck — batch op broadcast, and presence goes best-effort first. Corrupt/malicious ops: validate against schema; versioned op format (chapter-5 evolution rules — old clients linger for years on mobile). Metrics: sync convergence lag (op created → applied on peers), snapshot compaction backlog, op-log size per note distribution.`,
    ifPushed: `Why not just lock the note while someone edits? Locks serialize humans: they punish the collaboration case the product is selling, do nothing for offline (the lock can't be acquired), and create stale-lock-holder problems (now you need leases and fencing for a text editor). Merging is the product requirement, so pick a representation that merges.`,
  },
  {
    id: 9,
    title: "Design workspace chat (Slack-scale)",
    prompt: `Channels and DMs for companies. Channels can have 100k members. Messages must appear in a consistent order for everyone, mobile clients go offline constantly, and history is searchable. Design messaging.`,
    clarify: `Ordering scope — global or per-channel? (Per-channel is what users perceive; cross-channel ordering is not a real requirement — cheap to confirm, huge to win.) Delivery guarantee? (No lost messages; duplicates must be invisible.) Read receipts/typing? (Yes, but clearly lower tier.)`,
    envelope: `10M concurrent users, ~50k messages/s peak; big channels are read/fan-out heavy, writes per channel are human-bounded (even a frantic channel is tens of msgs/s) — so per-channel ordering through a single partition is comfortably feasible; fan-out and sync are the scaling problems, not write throughput.`,
    design: `send → Chat API → channel log, partitioned by channel_id. Partition assigns per-channel monotonic seq → THE order (msg also gets a globally-unique id for dedupe). Persist: hot tier (recent, in log/cache); history tier: wide-column, key (channel_id, bucket), clustered by seq [bounded partitions]. Fan-out: connection gateways push to online members' sockets; offline → push notification (best-effort poke, not delivery). Client sync = consumer offsets: per channel, client stores last_seq; reconnect → "give me channel X after seq N" → exact, resumable catch-up. Derived: search indexer + unread counters + receipts — all consume the log.`,
    deepDives: `Order is decided once, by the partition: All sends for a channel go through one partition whose append order IS the channel's order; the assigned per-channel seq is dense and monotonic. Everyone — every device, the history store, the search indexer — applies messages in seq order, so all members see the identical sequence. Timestamps are display metadata only — clocks don't order anything.

Client sync is the consumer-offset pattern: Each client persists last_seq per channel; reconnection is a range read seq > N — exact resume after offline, no missed messages, no full refetch. Delivery is at-least-once (gateway retries, reconnect overlaps) with dedupe by (channel, seq) client-side — duplicates become invisible. Send-side, the client mints a temp id + idempotency key, echoes the message locally (instant UX = read-your-writes by local echo), and reconciles when the server-assigned seq returns.

The 100k-member channel: Naive push = 100k socket writes per message × every message. Reality: only a fraction are connected — gateways hold member→connection maps; fan-out goes to connected sockets per gateway (one log consumer per gateway, filtered locally, not 100k individual subscriptions), offline members get a notification poke and sync on open (pull).

History partitioning: (channel_id) alone = unbounded partitions for old big channels; key by (channel_id, time_bucket) clustered by seq — bounded partitions, recent buckets hot, old buckets cold/compressed, and retention/export per bucket. Search and unread counts are derived consumers of the same log.`,
    failureModes: `Gateway crash → clients reconnect anywhere and resume by offsets (stateless-enough gateways). Partition leader failover → brief send-unavailability for that channel; seq assignment continuity guaranteed by the log's replication. Monitor: send→deliver p99 (online members), catch-up latency, indexer/counter lag, per-gateway connection balance. Push notifications are best-effort by design — never the delivery mechanism of record, only the doorbell.`,
    ifPushed: `Make DMs E2E-encrypted: Then the server can't index or render — search moves client-side, sync becomes ciphertext blobs + metadata, multi-device needs key distribution (per-device keys, sender-keys for groups), and server-side features (previews, search) are explicitly traded away. Say the trade; don't hand-wave it.`,
  },
  {
    id: 10,
    title: "Multi-tenant SaaS data platform with real tenant deletion",
    prompt: `B2B analytics SaaS: 10,000 tenants, 20 of them are whales (1000× a small tenant). One Postgres is dying. Requirements: isolate noisy neighbors, let big tenants grow, give our analysts a cross-tenant warehouse, and — contractually — "delete all of tenant X's data within 30 days," provably. Design the data layer.`,
    clarify: `Tenant data ever shared/joined between tenants in-product? (No — strict isolation; only our internal analytics crosses tenants.) Compliance deletion includes backups and derived stores? (Yes — that word "provably" is the hard requirement; design around it from the start.)`,
    envelope: `Control plane (consensus-backed): tenant → placement map, epochs, keys. Pooled shards: thousands of small tenants, rows tagged tenant_id, placement by hash(tenant_id); per-tenant quotas/rate limits. Dedicated shards: each whale gets its own shard(s) (promotion path: pooled → dedicated). Every shard → CDC → per-tenant-keyed change topics → warehouse loader + tenant-scoped derived views. Encryption: per-tenant data keys (envelope encryption, KMS-held) — applied in app/storage layer AND to warehouse + backups. Deletion: tombstone/disable → propagate deletion events → crypto-shred key → verify by audit job → certificate of deletion.`,
    design: `Control plane (consensus-backed): tenant → placement map, epochs, keys. Pooled shards: thousands of small tenants, rows tagged tenant_id, placement by hash(tenant_id); per-tenant quotas/rate limits. Dedicated shards: each whale gets its own shard(s). Every shard → CDC → per-tenant-keyed change topics → warehouse loader + tenant-scoped derived views. Encryption: per-tenant data keys (envelope encryption, KMS-held) — applied in app/storage layer AND to warehouse + backups. Deletion: tombstone/disable → propagate deletion events → crypto-shred key → verify by audit job → certificate of deletion.`,
    deepDives: `Tenant as the unit of sharding — hybrid, not dogma: Tenant-per-shard for everyone = 10k shards of overhead and terrible packing for tiny tenants; fully pooled = whales starve neighbors and per-tenant operations (move, restore, delete) become row-level surgery. Hybrid: pooled shards for the long tail (tenant_id leads every key/index; per-tenant quotas and statement timeouts contain noisy neighbors), dedicated shards for whales — which also makes their backup/restore/migration a shard operation. The tenant is the partition key AND the isolation, billing, and compliance boundary — one concept doing four jobs is the design's spine.

Whale promotion = online re-homing: A pooled tenant grows: snapshot its rows to a new dedicated shard, tail CDC from the snapshot's position to catch up, then fence and flip — bump the tenant's epoch in the placement map, old shard rejects stale-epoch writes, route to the new shard, verify, then purge from the pooled shard. It's the add-a-follower dance plus fencing, applied per tenant.

Cross-tenant analytics without cross-tenant leakage: Product never joins across tenants; the warehouse does, fed by CDC (no dual writes — the shards' logs are the only export path). Every event carries tenant_id; warehouse tables are partitioned by it, which makes both per-tenant cost attribution and per-tenant deletion in the warehouse a partition-level operation.

Deletion you can prove — design backwards from the auditor: Three layers, because each alone fails somewhere: (1) Propagation — a tenant-deletion event flows the same CDC paths as data; every derived store consumes it and drops the tenant's partitions/keys. (2) Crypto-shredding for the unreachable — backups, old log segments, archives can't be rewritten on demand; but everything was encrypted under the tenant's data key, so destroying that key in KMS renders all of it unreadable simultaneously, everywhere, within key-cache TTLs. (3) Verification — an audit job replays/queries every store and the warehouse for the tenant_id and produces the deletion report; "provably" means the audit is the deliverable.`,
    failureModes: `KMS is now tier-zero: cache data keys with short TTLs (availability) but short enough that shredding is timely (the TTL is your deletion latency tail). Placement-map outage: data plane keeps serving with cached routes; control-plane changes pause. Pooled-shard hot tenant alarms (per-tenant QPS/storage) trigger the promotion runbook before neighbors notice. Monitor: per-tenant p99 on pooled shards (isolation truth), CDC lag (warehouse staleness + deletion-propagation latency), deletion-audit failures (page immediately — compliance clock is ticking).`,
    ifPushed: `Schema migrations across 10k tenants? Expand-and-contract with both-direction compatibility (chapter-5 rules at fleet scale): add nullable/defaulted columns, deploy code reading both, backfill via the CDC/batch path, contract later; dedicated whales migrate on their own windows. Never a big-bang ALTER across the fleet.`,
  },
];

/* ─── Component ─── */

export default function DesignInterviewsPage() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isAnimating, setIsAnimating] = useState(false);

  const q = questions[index];
  const total = questions.length;

  const goTo = useCallback(
    (i: number) => {
      if (i === index || i < 0 || i >= total) return;
      setDirection(i > index ? "right" : "left");
      setIsAnimating(true);
      setTimeout(() => {
        setIndex(i);
        setIsAnimating(false);
      }, 200);
    },
    [index, total]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, goTo, total]);

  /* Scroll to top when question changes */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [index]);

  const prevEnabled = index > 0;
  const nextEnabled = index < total - 1;

  return (
    <DDIAThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "#020A05" }}>
        {/* ═══════ Header / Navigation Bar ═══════ */}
        <div className="sticky top-0 z-50 border-b border-[#F8F7F4]/10 backdrop-blur-md" style={{ background: "rgba(2, 10, 5, 0.85)" }}>
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            {/* Question title + number */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs text-[#F3C6AD] tracking-wider shrink-0">
                {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </span>
              <h1 className="text-base md:text-lg font-medium text-[#F8F7F4] truncate">
                {q.title}
              </h1>
            </div>

            {/* Nav arrows */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => goTo(index - 1)}
                disabled={!prevEnabled}
                className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F8F7F4]/10"
                aria-label="Previous question"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#F8F7F4]">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={!nextEnabled}
                className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F8F7F4]/10"
                aria-label="Next question"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#F8F7F4]">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-[#F8F7F4]/10">
            <div
              className="h-full bg-[#F3C6AD] transition-all duration-300 ease-out"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* ═══════ Main Content ═══════ */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
          <div
            className={`transition-all duration-200 ease-out ${
              isAnimating
                ? direction === "right"
                  ? "opacity-0 translate-x-4"
                  : "opacity-0 -translate-x-4"
                : "opacity-100 translate-x-0"
            }`}
          >
            {/* Prompt */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  Interviewer
                </span>
              </div>
              <div className="bg-[#0C2A17]/60 border border-[#F8F7F4]/10 rounded-xl p-5 md:p-6">
                <p className="text-lg md:text-xl leading-relaxed text-[#F8F7F4]">
                  {q.prompt}
                </p>
              </div>
            </section>

            {/* Clarify */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  Clarify
                </span>
              </div>
              <div className="text-[#F8F7F4] text-base md:text-lg leading-relaxed whitespace-pre-line">
                {q.clarify}
              </div>
            </section>

            {/* Envelope */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  Envelope
                </span>
              </div>
              <div className="text-[#F8F7F4] text-base md:text-lg leading-relaxed whitespace-pre-line">
                {q.envelope}
              </div>
            </section>

            {/* High-level Design */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  High-level Design
                </span>
              </div>
              <div className="bg-[#0C2A17]/40 border border-[#F8F7F4]/5 rounded-xl p-5 md:p-6 overflow-x-auto">
                <pre className="text-sm md:text-base font-mono text-[#F8F7F4] leading-relaxed whitespace-pre">
                  {q.design}
                </pre>
              </div>
            </section>

            {/* Deep Dives */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  Deep Dives
                </span>
              </div>
              <div className="text-[#F8F7F4] text-base md:text-lg leading-relaxed whitespace-pre-line">
                {q.deepDives}
              </div>
            </section>

            {/* Failure Modes */}
            <section className="mb-10">
              <div className="mb-3">
                <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                  Failure Modes & Operations
                </span>
              </div>
              <div className="text-[#F8F7F4] text-base md:text-lg leading-relaxed whitespace-pre-line">
                {q.failureModes}
              </div>
            </section>

            {/* If Pushed */}
            {q.ifPushed && (
              <section className="mb-10">
                <div className="mb-3">
                  <span className="text-[0.65rem] font-mono uppercase tracking-[0.14em] text-[#F3C6AD]">
                    If Pushed
                  </span>
                </div>
                <div className="text-[#F8F7F4] text-base md:text-lg leading-relaxed whitespace-pre-line">
                  {q.ifPushed}
                </div>
              </section>
            )}

            {/* Question Navigator Dots */}
            <div className="flex items-center justify-center gap-2 py-8">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    i === index
                      ? "bg-[#F3C6AD] w-6"
                      : "bg-[#F8F7F4]/20 hover:bg-[#F8F7F4]/40"
                  }`}
                  aria-label={`Go to question ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </main>

        {/* ═══════ Footer Navigation ═══════ */}
        <div className="border-t border-[#F8F7F4]/10">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => goTo(index - 1)}
              disabled={!prevEnabled}
              className="flex items-center gap-2 text-sm text-[#F8F7F4]/60 hover:text-[#F8F7F4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            <span className="text-xs font-mono text-[#F8F7F4]/40">
              Use arrow keys to navigate
            </span>

            <button
              onClick={() => goTo(index + 1)}
              disabled={!nextEnabled}
              className="flex items-center gap-2 text-sm text-[#F8F7F4]/60 hover:text-[#F8F7F4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </DDIAThemeProvider>
  );
}
