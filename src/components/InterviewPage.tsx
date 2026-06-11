import React, { useState, useEffect, useCallback, useMemo } from "react";
import DDIAThemeProvider from "../blog/components/ddia/DDIAThemeProvider";

/* ─── Data ─── */

interface Flashcard {
  id: number;
  section: string;
  sectionShort: string;
  question: string;
  answer: string;
}

const flashcards: Flashcard[] = [
  { id: 1, section: "Foundations & storage engines", sectionShort: "A",
    question: "Why do we report p95/p99 latency instead of the average?",
    answer: "Averages hide the tail, and the tail is what users hit: one page fans out to many backend calls, so the slowest dependency dominates (tail latency amplification). SLOs therefore target percentiles; optimizing the mean can leave p99 untouched or worse." },
  { id: 2, section: "Foundations & storage engines", sectionShort: "A",
    question: "Design question: push vs pull for a social feed (the fan-out problem)?",
    answer: "Push (fan-out on write): precompute each follower's timeline — cheap reads, expensive writes, catastrophic for celebrity accounts. Pull (fan-out on read): compute at read time — cheap writes, expensive hot reads. Staff answer: hybrid — push for normal users, pull-and-merge for high-follower accounts." },
  { id: 3, section: "Foundations & storage engines", sectionShort: "A",
    question: "B-tree vs LSM-tree: core trade-off?",
    answer: "B-trees update pages in place: strong read performance, predictable latency, one copy of each key. LSM-trees buffer writes and flush sorted immutable segments, merged by compaction: higher write throughput (sequential I/O), better compression — but compaction competes with live traffic (read/write tail spikes) and needs tuning." },
  { id: 4, section: "Foundations & storage engines", sectionShort: "A",
    question: "What is write amplification and why does a staff engineer care?",
    answer: "One logical write becoming multiple physical writes (page rewrites, LSM compaction rewriting data repeatedly). It burns I/O bandwidth and SSD endurance, and it's often the hidden ceiling on sustained write throughput — the reason \"just add writes\" stops scaling before CPU does." },
  { id: 5, section: "Foundations & storage engines", sectionShort: "A",
    question: "Every index you add does what to your write path?",
    answer: "Slows it: each write must now update every index, and in LSM/B-tree terms that's extra structures to maintain (often with their own amplification). Indexes are a read-optimization purchased with write cost and storage — choose them from query patterns, prune them like dependencies." },
  { id: 6, section: "Foundations & storage engines", sectionShort: "A",
    question: "Normalize or denormalize at scale?",
    answer: "Normalize to keep each fact in one place (cheap, safe updates); denormalize for read locality at scale — then accept the real cost: duplicated facts must be kept in sync, which turns into a derived-data pipeline problem (caches, materialized views, CDC), not a schema problem." },
  { id: 7, section: "Foundations & storage engines", sectionShort: "A",
    question: "\"Schemaless\" databases — what actually happened to the schema?",
    answer: "It moved, unenforced, into every reader: schema-on-read. Validation now happens implicitly at consumption time, failures shift from write-time errors to runtime surprises in consumers. Useful for heterogeneous/evolving data; dishonest as \"no schema.\"" },

  { id: 8, section: "Encoding & schema evolution", sectionShort: "B",
    question: "Define backward and forward compatibility, and why rolling upgrades need both.",
    answer: "Backward: new code reads old data. Forward: old code reads new data. During a rolling deploy both versions run simultaneously, each reading the other's output — through DB rows, RPC responses, queued messages. Data also outlives code by years, so backward compatibility is forever." },
  { id: 9, section: "Encoding & schema evolution", sectionShort: "B",
    question: "How does an old Protobuf reader survive a field it has never seen?",
    answer: "The field tag encodes a wire type, which tells the parser how many bytes to skip — unknown fields are mechanically skippable (and should be preserved on rewrite, not dropped). That skip rule is forward compatibility in tagged formats." },
  { id: 10, section: "Encoding & schema evolution", sectionShort: "B",
    question: "Why is reusing a retired Protobuf field number catastrophic?",
    answer: "Old bytes still exist (DB rows, queues, backups) with the old meaning at that tag; new code parses them under the new type — silent misinterpretation, no error. Hence reserved: make the compiler ban reuse forever." },
  { id: 11, section: "Encoding & schema evolution", sectionShort: "B",
    question: "Why do APIs ship 64-bit IDs as strings in JSON?",
    answer: "JSON numbers map to IEEE-754 doubles in JavaScript; integers are exact only to 2^53 − 1. Snowflake-style IDs exceed that and come back silently off by a few after a JS round-trip — so the convention is IDs as strings." },
  { id: 12, section: "Encoding & schema evolution", sectionShort: "B",
    question: "What does a schema registry actually enforce, and when?",
    answer: "Each message carries a small schema ID; consumers fetch-and-cache the writer's schema and resolve it against their own. Crucially the registry is a gatekeeper: configured with a compatibility mode, it rejects an incompatible schema at publish time — turning a 3 a.m. consumer crash into a failed CI step." },

  { id: 13, section: "Replication", sectionShort: "C",
    question: "What is semi-synchronous replication and why is it the standard compromise?",
    answer: "Exactly one follower is synchronous (the leader waits for its ack); the rest are async. You get a guaranteed second copy of every acknowledged write without paying every follower's latency — and without \"any follower down blocks all writes.\"" },
  { id: 14, section: "Replication", sectionShort: "C",
    question: "What can be lost in an async-replication failover, and why doesn't the database notice?",
    answer: "Writes the old leader acknowledged but hadn't shipped. The promoted follower simply never saw them; common practice discards them. Worst part: the outside world may have acted on them (emails sent, IDs issued), so external systems now disagree with the database." },
  { id: 15, section: "Replication", sectionShort: "C",
    question: "What is split brain and how do you prevent it?",
    answer: "Two nodes believing they're leader, both accepting writes — typically after a partition or botched failover. Prevention: epochs/generation numbers plus fencing (storage rejects writes from older epochs), quorum-based election, and sometimes forcibly killing the old leader." },
  { id: 16, section: "Replication", sectionShort: "C",
    question: "Why is the failover timeout a trap in both directions?",
    answer: "Too short: a load spike or GC pause looks like death → spurious failover → recovery load on an already-stressed system (and possible lost writes). Too long: real outages last minutes. There's no correct value, only a tuned trade-off — which is why many teams keep humans in the failover loop." },
  { id: 17, section: "Replication", sectionShort: "C",
    question: "A user posts a comment, reloads, and it's gone. Name the anomaly and two fixes.",
    answer: "Read-your-writes violation (read hit a lagging replica). Fixes: route reads of user-modifiable data to the leader; or track the user's last-write position and only serve from replicas caught up past it; or sticky-route the session to a fresh replica." },
  { id: 18, section: "Replication", sectionShort: "C",
    question: "Why does read-your-writes get harder across devices, and what's the fix?",
    answer: "Phone writes, laptop reads — client-side timestamps and sticky sessions don't transfer between devices. The tracking must be centralized server-side (per-user last-write position), and multi-DC routing must send both devices somewhere that can honor it." },
  { id: 19, section: "Replication", sectionShort: "C",
    question: "Score shows 1–0, refresh shows 0–0. Anomaly and fix?",
    answer: "Monotonic reads violation — successive reads hit replicas with different lag, so time ran backwards. Fix: pin each user to one replica (hash(user_id) routing) so they ride a single timeline." },
  { id: 20, section: "Replication", sectionShort: "C",
    question: "Chat shows the answer before the question. Anomaly and fix?",
    answer: "Consistent-prefix violation: causally related writes went to different partitions replicating at different speeds. Fix: write causally related events to the same partition (one conversation → one shard), or carry explicit causal dependencies." },
  { id: 21, section: "Replication", sectionShort: "C",
    question: "When is multi-leader replication actually justified?",
    answer: "When writes must succeed locally despite WAN distance or disconnection: multi-region write latency/availability, offline-first clients (the device is a leader), collaborative editing. The purchase price is a convergence story for concurrent writes." },
  { id: 22, section: "Replication", sectionShort: "C",
    question: "Two datacenters concurrently rename the same record. Walk the three resolution options.",
    answer: "LWW — converges by discarding one acknowledged write, silently, using clocks that skew. Siblings + version vectors — detect concurrency, keep both, application merges (lossless, laborious). Conflict avoidance — route each record's writes to one home leader (most real deployments). Whatever you pick must be deterministic and identical at every replica." },
  { id: 23, section: "Replication", sectionShort: "C",
    question: "Why is last-write-wins dangerous beyond \"you lose a write\"?",
    answer: "The loss is silent (no error, no log of the discarded value) and \"last\" is decided by timestamps from skewed clocks — the surviving write may actually be the older one. Acceptable for caches; negligent for data you promised to keep." },
  { id: 24, section: "Replication", sectionShort: "C",
    question: "What question do version vectors answer that timestamps can't?",
    answer: "Whether two writes are causally ordered or concurrent. One counter per writer: if vector A dominates B in every slot, B happened-before A (safe overwrite); if each wins somewhere, they're concurrent → keep siblings. Causality becomes computable instead of guessed." },
  { id: 25, section: "Replication", sectionShort: "C",
    question: "What does w + r > n actually guarantee — and not?",
    answer: "Guarantee: every read quorum overlaps every successful write quorum, so a read sees at least one up-to-date copy of fully-acknowledged writes. Not guaranteed: linearizability (concurrent/partial writes interleave badly) and bounded staleness. Quorums give overlap, not ordering." },
  { id: 26, section: "Replication", sectionShort: "C",
    question: "What is a sloppy quorum with hinted handoff, and what does it cost?",
    answer: "During a partition, writes land on substitute nodes outside the key's home set, with a hint to deliver later. You keep write availability; you lose the overlap guarantee — reads against the home set can miss the write until handoff completes." },
  { id: 27, section: "Replication", sectionShort: "C",
    question: "Read repair vs anti-entropy — why do you need both?",
    answer: "Read repair heals stale replicas as a side effect of reads — but only for keys that get read. Anti-entropy background-diffs replicas (Merkle trees) to heal cold keys. Without it, \"node was down an hour\" becomes \"rarely-read keys wrong for months.\"" },
  { id: 28, section: "Replication", sectionShort: "C",
    question: "Replication lag jumps from 50 ms to 4 minutes. What breaks first, and what do you do?",
    answer: "First: read-your-writes (fresh actions vanish), then monotonic reads, then any business logic that read replicas assuming freshness. Actions: shift critical reads to the leader, eject replicas beyond a max-lag threshold from the read pool, shed non-essential reads, then find the cause (long transaction, migration, under-provisioned follower)." },

  { id: 29, section: "Partitioning (sharding)", sectionShort: "D",
    question: "Key-range vs hash partitioning: the core trade?",
    answer: "Range keeps sort order → efficient range scans and locality, but sequential keys (timestamps) hammer one partition. Hash spreads load evenly but destroys ordering → range queries become scatter-gather. Common hybrid: hash a coarse key, range-sort within (e.g. (user_id, timestamp))." },
  { id: 30, section: "Partitioning (sharding)", sectionShort: "D",
    question: "Why is hash(key) mod N a rebalancing disaster, and what's used instead?",
    answer: "Changing N remaps almost every key → a full-cluster data migration per scale event. Instead: many fixed partitions assigned to nodes (move whole partitions), or consistent hashing — both move only ~1/N of data per node change." },
  { id: 31, section: "Partitioning (sharding)", sectionShort: "D",
    question: "One celebrity key melts a partition. Mitigations?",
    answer: "Salt the hot key (append a random suffix to spread writes; reads scatter-gather the suffixes), special-case known hot entities onto dedicated capacity, and cache aggressively in front. Note the cost you accepted: per-key ordering and cheap reads for that key." },
  { id: 32, section: "Partitioning (sharding)", sectionShort: "D",
    question: "Local vs global secondary indexes?",
    answer: "Local (document-partitioned): each partition indexes its own data — writes touch one partition, reads scatter-gather all of them. Global (term-partitioned): the index itself is partitioned by indexed value — reads hit one partition, writes fan out (usually async, so the index lags). Write-heavy → local; read-heavy lookups → global." },
  { id: 33, section: "Partitioning (sharding)", sectionShort: "D",
    question: "How does a request find the right partition? Three options.",
    answer: "(1) Routing tier (proxy consulting a metadata service like ZooKeeper), (2) partition-aware clients holding the assignment map, (3) ask any node, which forwards. All reduce to: someone must hold the partition-assignment truth and learn about rebalances." },
  { id: 34, section: "Partitioning (sharding)", sectionShort: "D",
    question: "What makes a good partition key?",
    answer: "Even load distribution, matches the dominant access pattern so most queries are single-partition, and groups data that needs ordering/transactions together (conversation_id, not message_id). The classic failure: choosing time, getting one white-hot \"today\" partition." },
  { id: 35, section: "Partitioning (sharding)", sectionShort: "D",
    question: "Why is automatic rebalancing dangerous during incidents?",
    answer: "A failure-detector blip during overload can trigger mass partition movement — which consumes I/O and network precisely when the cluster has none to spare, amplifying the outage (cascading failure). Mature systems gate rebalancing behind rate limits or a human." },

  { id: 36, section: "Transactions", sectionShort: "E",
    question: "What does the A in ACID actually mean (common trap)?",
    answer: "Abortability, not concurrency: a transaction's writes either all commit or all roll back on failure — you can safely retry. Concurrent-execution guarantees are isolation's job. Conflating them is a classic screen-out question." },
  { id: 37, section: "Transactions", sectionShort: "E",
    question: "What does read committed prevent, and what does it still allow?",
    answer: "Prevents dirty reads (seeing uncommitted data) and dirty writes (overwriting uncommitted data). Still allows read skew, lost updates, write skew, phantoms — i.e. most of the interesting bugs." },
  { id: 38, section: "Transactions", sectionShort: "E",
    question: "What is read skew, and which mechanism fixes it?",
    answer: "A transaction reads multiple rows while another commits in between, observing a state that never existed (backup reads $500 + $500 as $500 + $400). Fixed by snapshot isolation: read from a consistent snapshot of committed-as-of-start." },
  { id: 39, section: "Transactions", sectionShort: "E",
    question: "MVCC in two sentences.",
    answer: "Writers create new row versions tagged with transaction IDs instead of overwriting; readers see the versions committed as of their snapshot. Result: readers never block writers and writers never block readers — the engine garbage-collects old versions later." },
  { id: 40, section: "Transactions", sectionShort: "E",
    question: "Four ways to prevent lost updates.",
    answer: "Atomic operations (UPDATE … SET x = x + 1), explicit locking (SELECT … FOR UPDATE), compare-and-set (update only if value unchanged — beware snapshot semantics), or automatic detection (snapshot-isolation engines abort the loser; retry)." },
  { id: 41, section: "Transactions", sectionShort: "E",
    question: "Define write skew with the canonical shape, and the fix.",
    answer: "Two transactions read an overlapping invariant, then write disjoint rows, each individually fine, jointly violating it (both on-call doctors book off; both rooms booked). Snapshot isolation allows it. Fix: true serializability (SSI/2PL), or materialize the conflict into a lockable row." },
  { id: 42, section: "Transactions", sectionShort: "E",
    question: "What's a phantom, and why can't row locks stop it?",
    answer: "A write changes the result of another transaction's search condition by inserting a row that didn't exist when it ran — there was nothing to lock. Needs predicate/next-key (gap) locks or SSI's read-tracking." },
  { id: 43, section: "Transactions", sectionShort: "E",
    question: "2PL vs serializable snapshot isolation (SSI)?",
    answer: "2PL: pessimistic — block on conflict; pays in latency, lock contention, deadlocks; throughput collapses under contention. SSI: optimistic — run on snapshots, detect dangerous patterns at commit, abort and retry the loser; pays in retry work under high contention. Low contention → SSI shines; hot-row workloads → neither is free, redesign the conflict." },
  { id: 44, section: "Transactions", sectionShort: "E",
    question: "Why is two-phase commit (2PC) avoided at scale?",
    answer: "The coordinator is a blocking single point: participants that voted \"yes\" hold locks in doubt until it recovers — stalls propagate. Plus latency (multiple round trips + fsyncs) and operational fragility. Preferred: per-partition serialization, idempotent retries, outbox/CDC — or consensus-based commit where truly needed." },
  { id: 45, section: "Transactions", sectionShort: "E",
    question: "When do you actually pay for serializable isolation?",
    answer: "When invariants span rows/objects that concurrent transactions read-then-write disjointly: double-booking, balance floors, uniqueness-under-race, quota enforcement. Most read-heavy paths live happily on snapshot isolation — staff answer names which transactions need it, not \"turn it on globally.\"" },

  { id: 46, section: "Distributed systems trouble", sectionShort: "F",
    question: "Why are timeouts the only failure detector — and what can't they tell you?",
    answer: "Asynchronous networks have no upper bound on delay, so the only signal is silence-for-too-long. A timeout cannot distinguish dead node / slow node / dead network / slow network — and crucially, whether the request was processed before the silence." },
  { id: 47, section: "Distributed systems trouble", sectionShort: "F",
    question: "Why does \"retry on timeout\" require idempotency?",
    answer: "A lost response is indistinguishable from a lost request: the operation may have succeeded. Retrying may execute it twice. Safe retries require the operation to be idempotent — typically via a client-minted idempotency key the server deduplicates on." },
  { id: 48, section: "Distributed systems trouble", sectionShort: "F",
    question: "How does clock skew turn last-write-wins into data loss?",
    answer: "LWW orders by timestamp; nodes' clocks differ by NTP error (millis to — during faults — much more). A \"later\" write stamped by a slow clock loses to an \"earlier\" one, silently. Lesson: never use time-of-day clocks to order events across nodes; use logical ordering (sequence numbers, vectors)." },
  { id: 49, section: "Distributed systems trouble", sectionShort: "F",
    question: "Time-of-day vs monotonic clocks — when must you use which?",
    answer: "Time-of-day clocks can jump (NTP step, leap seconds) — never use them to measure durations or order events. Monotonic clocks only move forward — correct for timeouts/elapsed time, meaningless across machines." },
  { id: 50, section: "Distributed systems trouble", sectionShort: "F",
    question: "What is a process pause, and why does it break lease-based code?",
    answer: "GC stop-the-world, VM migration, page faults, CPU steal — the thread freezes for seconds between two instructions. Code that checked \"lease still valid\" resumes after expiry and writes anyway, as a zombie leader. Checking the clock more often cannot fix it; the pause hits between check and write." },
  { id: 51, section: "Distributed systems trouble", sectionShort: "F",
    question: "Explain fencing tokens.",
    answer: "The lock/lease service issues a monotonically increasing token with each grant; the protected resource rejects writes carrying a lower token than it has seen. A paused zombie's stale token is refused — correctness moves from \"client behaves\" to \"storage enforces.\"" },
  { id: 52, section: "Distributed systems trouble", sectionShort: "F",
    question: "\"Exactly-once delivery\" — possible? What's the achievable version?",
    answer: "Delivery: no — duplicates are physics (retries over lossy links). Achievable: effectively-once processing/effects — duplicates exist in transit and are neutralized at boundaries via idempotent application, sequence numbers, and transactional sinks." },
  { id: 53, section: "Distributed systems trouble", sectionShort: "F",
    question: "Crash-stop vs Byzantine faults — what do most systems assume and why?",
    answer: "Crash-stop/crash-recovery: nodes fail by stopping, never by lying. Byzantine: arbitrary/malicious behavior — tolerating it costs 3f+1 replicas and heavy protocols. Inside one org's perimeter you assume non-Byzantine and spend the budget on checksums, auth, and input validation instead." },
  { id: 54, section: "Distributed systems trouble", sectionShort: "F",
    question: "Why must any node-level \"I'm the only writer\" belief be enforced elsewhere?",
    answer: "Because the node can be paused, partitioned, or de-elected without knowing it — local belief is always potentially stale. Authority must be validated where the data lives: epochs/fencing at storage, quorum checks at write time." },

  { id: 55, section: "Consistency & consensus", sectionShort: "G",
    question: "Linearizability in one sentence, and its price.",
    answer: "The system behaves as if there's one copy and every operation takes effect atomically at some instant between its start and finish (reads after a completed write see it). Price: coordination on every operation — latency, throughput, and unavailability during partitions." },
  { id: 56, section: "Consistency & consensus", sectionShort: "G",
    question: "State CAP precisely — and its main criticism.",
    answer: "When a network partition occurs, choose: stay consistent (linearizable) and refuse some requests, or stay available and serve possibly-stale data. No partition → no forced choice. Criticism: it's a narrow theorem (one consistency level, one fault type) and ignores the normal-operation latency cost of consistency — which dominates real design." },
  { id: 57, section: "Consistency & consensus", sectionShort: "G",
    question: "Linearizability vs serializability?",
    answer: "Orthogonal: serializability = transactions behave as if executed in some serial order (isolation, multi-object) — that order may disagree with real time. Linearizability = real-time recency on single objects. Both together = strict serializability." },
  { id: 58, section: "Consistency & consensus", sectionShort: "G",
    question: "Why is total order broadcast equivalent to consensus?",
    answer: "Agreeing on the next entry of a shared log, repeatedly, is consensus — and a consensus protocol run repeatedly yields an ordered log. That's why \"replicated log\" (Raft) and \"consensus\" are the same machinery; apply the log deterministically and you get state machine replication." },
  { id: 59, section: "Consistency & consensus", sectionShort: "G",
    question: "Where does consensus actually run in a typical stack?",
    answer: "Leader election and log ordering inside replicated systems (Raft in etcd, Kafka's controller/metadata, consensus in cloud DBs), cluster membership/config (ZooKeeper/etcd), distributed locks with fencing, and atomic-commit coordination. Almost everything else rides on top of those few points." },
  { id: 60, section: "Consistency & consensus", sectionShort: "G",
    question: "Why do consensus protocols need quorums and epochs?",
    answer: "Epochs break ties across time: a new leader has a higher epoch and proposals from stale leaders are rejected. Quorums make epochs discoverable: any two majorities overlap, so a new epoch's quorum always contains someone who can veto the old leader. Together they prevent two leaders deciding simultaneously." },
  { id: 61, section: "Consistency & consensus", sectionShort: "G",
    question: "What do ZooKeeper/etcd actually give an application developer?",
    answer: "Outsourced consensus as primitives: linearizable compare-and-set, ephemeral nodes (session-bound — auto-cleanup on death, the basis of leases), watches/notifications, total ordering of updates — enough to build leader election, locks with fencing, service discovery, and config without writing Paxos." },
  { id: 62, section: "Consistency & consensus", sectionShort: "G",
    question: "Why not make the whole system linearizable and be done?",
    answer: "Every operation would pay cross-node coordination: tail latency multiplies, throughput caps at consensus speed, and partitions make the system unavailable. Staff move: confine linearizability to the few operations whose invariants need it (uniqueness, leases, ledger writes) and let everything else be eventually consistent on purpose." },
  { id: 63, section: "Consistency & consensus", sectionShort: "G",
    question: "How do you get a linearizable read from a Raft-style leader — and the trap?",
    answer: "The leader must confirm it's still leader before answering: read-index / lease reads (check quorum or hold a clock-bounded lease) — otherwise a deposed leader serves stale reads during a partition. The trap is exactly the naive version: \"read from the leader\" without the liveness check." },

  { id: 64, section: "Batch processing", sectionShort: "H",
    question: "Why do batch frameworks insist on immutable inputs and deterministic tasks?",
    answer: "So any failed task can be re-run anywhere with identical results — fault tolerance by recomputation instead of by protocol. Bonus: human fault tolerance — buggy job? Fix code, re-run on the same input, old outputs were never destroyed." },
  { id: 65, section: "Batch processing", sectionShort: "H",
    question: "Reduce-side vs map-side join?",
    answer: "Reduce-side: general — shuffle both datasets by join key so matching records meet at a reducer; pays a full sort/shuffle. Map-side: skip the shuffle when you can — broadcast a small table to every mapper, or exploit both inputs being pre-partitioned/sorted on the key." },
  { id: 66, section: "Batch processing", sectionShort: "H",
    question: "One key has 100x the records and stalls the whole join. Options?",
    answer: "Detect via sampling, then: salt/split the hot key across reducers and merge after, broadcast-join the small side so the skewed key never shuffles, or special-case hot keys into a separate path. The principle: skew is a data property; the fix is in the plan, not more workers." },

  { id: 67, section: "Stream processing", sectionShort: "I",
    question: "Log vs queue: what's the decision rule?",
    answer: "Does history have value (replay, new consumers, audit) and does per-key ordering matter? → log (retained, offset-based, fan-out to many groups). Independent expensive tasks needing per-message ack/retry and fair dispatch? → queue (delete-on-ack). Using a log as a job queue buys head-of-line blocking within partitions." },
  { id: 68, section: "Stream processing", sectionShort: "I",
    question: "How do consumer groups, offsets, and lag relate?",
    answer: "A group divides partitions (not messages) among members — one reader per partition keeps order. Progress = one offset per partition; commit it and crash-recovery is \"resume from offset.\" Lag (head minus committed offset) is the staleness metric you alert on." },
  { id: 69, section: "Stream processing", sectionShort: "I",
    question: "Why are dual writes (app writes DB + search + cache) broken?",
    answer: "No shared order: concurrent updates can apply in different orders at each system → permanent silent divergence. No atomicity: crash between writes leaves systems disagreeing. There's no error, no detection — the failure mode is quiet drift." },
  { id: 70, section: "Stream processing", sectionShort: "I",
    question: "How does change data capture (CDC) fix what dual writes break?",
    answer: "One system (the DB) is sole writer-of-record; a connector tails its replication log and publishes every committed change, in commit order, to a durable log (partitioned by key). All other systems consume the same sequence in the same order → convergence; recovery = resume at offset; new consumer = snapshot + replay (or compacted topic)." },
  { id: 71, section: "Stream processing", sectionShort: "I",
    question: "Explain the transactional outbox pattern and the problem it solves.",
    answer: "\"Update the row and publish the event, atomically\" — without 2PC. Write the business row and an event row into an outbox table in one local ACID transaction; a relay publishes the outbox to the stream. Atomicity borrowed from the only cheap place it exists: a single database." },
  { id: 72, section: "Stream processing", sectionShort: "I",
    question: "Event sourcing: when is it the right call, and the honest costs?",
    answer: "Right when history is the product: audit-heavy domains, replay/debugging, many evolving read models from one truth. Costs: event schemas become a versioned public API, current-state queries need maintained projections, replays grow (snapshot mitigation), and corrections must be compensating events, never edits." },
  { id: 73, section: "Stream processing", sectionShort: "I",
    question: "Event time vs processing time — and what is a watermark?",
    answer: "Event time = when it happened; processing time = when you handled it. Windowing by processing time records your pipeline's hiccups as user behavior. Event-time windows need a watermark — a flowing, heuristic claim \"all events ≤ T have arrived\" — to know when to close; stragglers after it get a policy: drop, update (re-emit corrected), or sideline." },
  { id: 74, section: "Stream processing", sectionShort: "I",
    question: "What does Kafka-style \"exactly-once\" cover, and where does it stop?",
    answer: "Idempotent producer (per-partition sequence numbers dedupe broker-side retries) + transactions (output messages and consumer offsets commit atomically; read-committed consumers skip aborts) = effectively-once within a consume-process-produce loop. It stops at external sinks — DB writes, emails, HTTP calls need their own idempotency." },
  { id: 75, section: "Stream processing", sectionShort: "I",
    question: "A consumer is permanently slower than its producer. What happens?",
    answer: "On a log: lag grows until retention truncates unread data — the broker is fine, your data isn't. Respond: scale consumers (bounded by partition count → may need repartitioning), make processing cheaper/batched, shed or sample, and alert on lag-vs-retention headroom, not just lag." },

  { id: 76, section: "Architecture & correctness", sectionShort: "J",
    question: "\"Unbundling the database\" — the pitch and the invoice.",
    answer: "Pitch: run specialized systems (OLTP, search, cache, warehouse) as the components of one logical database, glued by an ordered change log playing the WAL's role — views are derived, rebuildable by replay, failures isolated. Invoice: views lag (no cross-view read-your-writes), no cross-view transactions, the log is now tier-zero infrastructure, and event schemas are a public API with evolution duties." },
  { id: 77, section: "Architecture & correctness", sectionShort: "J",
    question: "Lambda vs kappa — and the invariant beneath both.",
    answer: "Lambda: batch layer (periodic full recompute, correct) + speed layer (streaming tail, fresh), merged at query — same logic written twice, drifting. Kappa: one replayable log; new logic = new job replaying from offset 0 in parallel, then atomic view switch. Invariant either way: immutable raw input + rebuildable views = the freedom to be wrong and recover." },
  { id: 78, section: "Architecture & correctness", sectionShort: "J",
    question: "Your broker is exactly-once, your DB is ACID — explain how a user still gets double-charged, and the fix.",
    answer: "The duplicate is born above every layer: client retries after a lost response → two legitimate requests; TCP deduped only within each connection; the broker deduped only its own resends of each message. End-to-end argument: correctness functions must live at the endpoints — the client mints an operation ID at intent time, every hop carries it, and the final write enforces it (op_id UNIQUE, insert-or-return-original). The request ID is the truth; everything below is transport." },
];

/* ─── Section metadata ─── */
const SECTIONS = [
  { id: "A", label: "Foundations", full: "Foundations & storage engines", count: 7 },
  { id: "B", label: "Encoding", full: "Encoding & schema evolution", count: 5 },
  { id: "C", label: "Replication", full: "Replication", count: 16 },
  { id: "D", label: "Partitioning", full: "Partitioning (sharding)", count: 7 },
  { id: "E", label: "Transactions", full: "Transactions", count: 10 },
  { id: "F", label: "Distributed", full: "Distributed systems trouble", count: 9 },
  { id: "G", label: "Consistency", full: "Consistency & consensus", count: 9 },
  { id: "H", label: "Batch", full: "Batch processing", count: 3 },
  { id: "I", label: "Stream", full: "Stream processing", count: 9 },
  { id: "J", label: "Architecture", full: "Architecture & correctness", count: 3 },
];

/* ─── Utilities ─── */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function InterviewPage() {
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(SECTIONS.map(s => s.id)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [progress, setProgress] = useState<Record<string, 'correct' | 'wrong' | undefined>>({});

  /* Filtered + optionally shuffled deck */
  const deck = useMemo(() => {
    const filtered = flashcards.filter(c => selectedSections.has(c.sectionShort));
    if (shuffled) return shuffleArray(filtered);
    return filtered;
  }, [selectedSections, shuffled]);

  const card = deck[index];
  const total = deck.length;

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setFlipped(false);
  }, [total]);

  const toggleSection = useCallback((id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      setIndex(0);
      setFlipped(false);
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffled(prev => !prev);
    setIndex(0);
    setFlipped(false);
  }, []);

  const mark = useCallback((id: number, grade: 'correct' | 'wrong') => {
    setProgress(prev => ({ ...prev, [id]: prev[id] === grade ? undefined : grade }));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo(index - 1);
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo(index + 1);
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, goTo]);

  /* Stats */
  const correctCount = Object.values(progress).filter(v => v === 'correct').length;
  const wrongCount = Object.values(progress).filter(v => v === 'wrong').length;
  const gradedCount = correctCount + wrongCount;

  if (!card) {
    return (
      <DDIAThemeProvider>
        <div className="min-h-screen flex items-center justify-center text-[#f2fafc]">
          <p className="text-lg">Select at least one section to begin.</p>
        </div>
      </DDIAThemeProvider>
    );
  }

  return (
    <DDIAThemeProvider>
      <div className="min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
        {/* ═══════ Header ═══════ */}
        <div className="w-full max-w-4xl mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#f2fafc] bg-gradient-to-r from-[#f2fafc] to-[#f2fafc]/60 bg-clip-text text-transparent">
                DDIA Interview Deck
              </h1>
              <p className="text-sm text-[#8aa6b0] mt-2 font-mono">
                {total} cards active &middot; {gradedCount} graded
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShuffle}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  shuffled
                    ? "bg-[#f3c6ad]/10 border-[#f3c6ad] text-[#f3c6ad]"
                    : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
                }`}
              >
                {shuffled ? "Unshuffle" : "Shuffle"}
              </button>
              <div className="flex items-center gap-2 text-sm font-mono text-[#8aa6b0]">
                <span className="text-[#34d399]">{correctCount}</span>
                <span>/</span>
                <span className="text-[#f87171]">{wrongCount}</span>
                <span>/</span>
                <span>{total - gradedCount}</span>
              </div>
            </div>
          </div>

          {/* ═══════ Section Filters ═══════ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {SECTIONS.map(section => {
              const active = selectedSections.has(section.id);
              return (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "bg-[#0c1a10] border-[#2a4651] text-[#f2fafc]"
                      : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651]"
                  }`}
                >
                  <span className="font-mono text-xs mr-1.5 opacity-60">{section.id}</span>
                  {section.label}
                  <span className="font-mono text-xs ml-1.5 opacity-60">{section.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ Progress Bar ═══════ */}
        <div className="w-full max-w-4xl mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-1.5 bg-[#1c2f37] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f3c6ad] rounded-full transition-all duration-300"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono text-[#8aa6b0] min-w-[3rem] text-right">
              {index + 1}/{total}
            </span>
          </div>
        </div>

        {/* ═══════ Card ═══════ */}
        <div className="w-full max-w-4xl mb-8">
          <div
            className="cursor-pointer"
            onClick={() => setFlipped(f => !f)}
            style={{ perspective: "1200px" }}
          >
            <div
              className="relative transition-transform duration-500 ease-out"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "400px",
              }}
            >
              {/* Front — Question */}
              <div
                className="absolute inset-0 bg-[#0a0f0c] border border-[#1c2f37] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.55)] p-8 md:p-10 flex flex-col"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono text-[#8aa6b0] bg-[#0c1a10] px-3 py-1 rounded-md border border-[#1c2f37]">
                    Q{card.id}
                  </span>
                  <span className="text-xs font-mono text-[#8aa6b0] uppercase tracking-[0.12em]">
                    {card.section}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xl md:text-2xl leading-relaxed text-[#f2fafc] font-medium text-center max-w-3xl">
                    {card.question}
                  </p>
                </div>
                <div className="text-center text-sm text-[#8aa6b0] mt-6 font-mono">
                  Click or press Space to reveal
                </div>
              </div>

              {/* Back — Answer */}
              <div
                className="absolute inset-0 bg-[#0c1a10] border border-[#2a4651] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.55)] p-8 md:p-10 flex flex-col"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono text-[#f3c6ad] bg-[#2a4651] px-3 py-1 rounded-md border border-[#2a4651]">
                    A{card.id}
                  </span>
                  <span className="text-xs font-mono text-[#8aa6b0] uppercase tracking-[0.12em]">
                    {card.section}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-lg md:text-xl leading-relaxed text-[#f2fafc] text-center max-w-3xl">
                    {card.answer}
                  </p>
                </div>
                <div className="text-center text-sm text-[#8aa6b0] mt-6 font-mono">
                  Click or press Space to flip back
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ Controls ═══════ */}
        <div className="w-full max-w-4xl">
          {/* Self-grading */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={(e) => { e.stopPropagation(); mark(card.id, 'correct'); }}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                progress[card.id] === 'correct'
                  ? "bg-[#34d399]/10 border-[#34d399] text-[#34d399]"
                  : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
              }`}
            >
              ✓ Got it
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); mark(card.id, 'wrong'); }}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                progress[card.id] === 'wrong'
                  ? "bg-[#f87171]/10 border-[#f87171] text-[#f87171]"
                  : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc]"
              }`}
            >
              ✗ Missed
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#1c2f37] bg-[#0a0f0c] text-[#f2fafc] hover:bg-[#1c2f37] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>

            <button
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#1c2f37] bg-[#0a0f0c] text-[#f2fafc] hover:bg-[#1c2f37] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Keyboard hints */}
          <div className="mt-8 text-center text-xs text-[#8aa6b0] font-mono space-x-4">
            <span>← → navigate</span>
            <span>Space flip</span>
            <span>1-9 grade</span>
          </div>
        </div>
      </div>
    </DDIAThemeProvider>
  );
}
