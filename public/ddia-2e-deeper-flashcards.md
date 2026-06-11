# DDIA 2nd Edition — One Level Deeper (Design-Discussion Flashcards)

49 cards, the companion to the 66-card main-ideas deck. Same book (*Designing
Data-Intensive Applications, 2nd Edition*, Kleppmann & Riccomini, 2026), same
style — but **one level deeper**: the named mechanisms, patterns, and
failure modes that actually come up when a staff-level design discussion goes
two questions past the headline. Still no trivia — every card here is
something you'd plausibly *say or be asked* while whiteboarding. No question
repeats the main-ideas deck; the two are meant to be shuffled together.

**Book pointers:** as before, per-section page numbers aren't published and
differ across print/ebook/online, so each card ends with 📖 **chapter + exact
section title(s) from the official ToC** — a ten-second lookup in any format.
*Official ToC:* [O'Reilly — DDIA 2nd Edition](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/)

**How to use:** answer aloud first; spaced review (1 → 3 → 7 → 14 → 30 days);
interleave with the main-ideas deck — headline card, then its deeper sibling.

---

## Chapter 1 — Trade-Offs in Data Systems Architecture

**1. "Separation of storage and compute" — what does the defining cloud-native pattern actually change?**
Storage lives in a shared, durable, elastic layer (object storage); compute
is stateless-ish and scales — or shuts off — independently. Consequences:
you can resize/replace compute without migrating data, multiple engines can
share one copy of the data, and durability is the storage service's problem.
The trade: every read crosses a network, so caching layers and columnar
formats become load-bearing. Modern warehouses and lakehouses are this
pattern; it also quietly resurrects shared-disk architecture.
📖 *Ch. 1 — "Cloud Native System Architecture"; Ch. 4 — "Cloud Data Warehouses"*

**2. Data warehouse vs data lake — and what did the shift from ETL to ELT change?**
A warehouse stores curated, schema-on-write tables optimized for SQL
analytics; a lake stores raw files (schema-on-read) cheaply, deferring
structure to consumers. ELT (load raw first, transform inside the
warehouse/lake) won because storage got cheap and transformation logic
changes often — keeping the raw immutable data means you can re-derive when
the logic evolves, the same rebuildability principle as everywhere else in
the book. The cost: governance — a lake without discipline is a swamp.
📖 *Ch. 1 — "Data Warehousing", "Systems of Record and Derived Data"*

**3. What do serverless/FaaS architectures force you to do with state?**
Externalize it. Function instances are ephemeral and may cold-start, so all
state lives in databases, object stores, caches, or queues — which makes
data-system choices (latency to the store, connection limits, idempotency
of handlers that *will* be retried) the real architecture, with the
functions as glue. The trade: operational simplicity and per-request
economics vs cold-start latency, vendor coupling, and harder
local/long-running workloads.
📖 *Ch. 1 — "Microservices and Serverless", "Operations in the Cloud Era"*

---

## Chapter 2 — Defining Nonfunctional Requirements

**4. Why does latency explode as utilization approaches 100% — and what's the design consequence?**
Queueing: requests vary in cost, servers process limited work in parallel,
and a few slow requests make others wait behind them (head-of-line
blocking). Near saturation, queue length — and thus response time — grows
nonlinearly; the system feels fine at 70% and terrible at 95%. Consequence:
capacity-plan for tail latency at *peak*, keep headroom on purpose, and
treat rising queue depth as the earliest overload signal.
📖 *Ch. 2 — "Latency and Response Time", "Use of Response Time Metrics"*

**5. Shared-memory vs shared-disk vs shared-nothing — and which one is quietly back?**
Shared-memory = one big machine (scale-up: simple, expensive, a ceiling).
Shared-nothing = independent nodes coordinating over the network (scale-out:
the dominant model, at the price of distributed-systems problems).
Shared-disk — many compute nodes over common storage — was niche, but
cloud object storage revived it: storage/compute separation (card 1) *is*
shared-disk reborn, with the contention problems mitigated by immutable
files and caching.
📖 *Ch. 2 — "Shared-Memory, Shared-Disk, and Shared-Nothing Architectures"*

**6. What's the methodological trap in reporting percentiles?**
You can't average them: the mean of ten servers' p99s is not the fleet's
p99, and aggregating pre-computed percentiles is statistically meaningless —
keep histograms and merge those. Also measure where the user is (client- or
edge-side): server-side timing misses queueing in front of the service,
which is precisely what degrades first under load (card 4).
📖 *Ch. 2 — "Average, Median, and Percentiles", "Use of Response Time Metrics"*

**7. Why do mature systems inject faults on purpose?**
Because fault-tolerance code that's never exercised is broken by default —
the bugs hide in recovery paths, not steady state. Deliberately killing
processes, dropping packets, and failing dependencies (chaos-engineering
style, in test *and* production) converts "we believe we tolerate node
loss" into routinely demonstrated fact, and trains humans on the runbooks
too — addressing the largest fault source: people.
📖 *Ch. 2 — "Fault Tolerance", "Humans and Reliability"*

---

## Chapter 3 — Data Models and Query Languages

**8. Star and snowflake schemas — why does analytics model data this way?**
A central **fact table** of events (one row per sale/click, very long,
narrow-ish) surrounded by **dimension tables** (who/what/where/when —
products, customers, dates). Queries scan facts, filter and group by joined
dimensions — a shape that matches columnar storage perfectly. Snowflake =
dimensions further normalized; stars are usually preferred for query
simplicity. The design point: analytical models optimize for *aggregation
across events*, not entity lookup — opposite of OLTP modeling.
📖 *Ch. 3 — "Stars and Snowflakes: Schemas for Analytics"*

**9. What is GraphQL actually — and what is it not?**
A query language for **APIs**, not databases: clients declare the shape of
data they need; a server-side layer resolves it against backend services and
stores. It solves over/under-fetching and mobile round-trips. It is *not* a
database query language or a data model — resolvers can hide N+1 query
storms, and someone still designs the storage underneath. In design
discussions: GraphQL moves the join to the API layer; the database problems
remain yours.
📖 *Ch. 3 — "GraphQL"*

**10. Why do ML and scientific workloads get their own data model (DataFrames/matrices)?**
Because their operations are bulk transformations over columns and matrices
— feature engineering, linear algebra — not row-at-a-time lookups or joins
by key. DataFrames blend relational-ish operations with array computing,
and data flows to them as bulk exports of derived data (from lakes/
warehouses) rather than transactional reads. Knowing this explains why "the
ML team wants a copy of everything" is an architecture-by-derivation
problem, not a database-access problem.
📖 *Ch. 3 — "DataFrames, Matrices, and Arrays"*

---

## Chapter 4 — Storage and Retrieval

**11. What keeps LSM reads fast, and what's the LSM failure mode operators watch for?**
A key may live in the memtable or any SSTable, so reads check newest→oldest
— bounded by **Bloom filters** (skip files that definitely lack the key) and
**compaction** (merge files so there are few places to look). The failure
mode: compaction falling behind under write pressure — files pile up, reads
touch more of them, disk fills with un-merged data, and read latency
degrades *because of writes*. "LSM reads got slow" usually means "compaction
lost the race."
📖 *Ch. 4 — "Log-Structured Storage", "Comparing B-Trees and LSM-Trees"*

**12. Why does every serious storage engine have a write-ahead log, even B-trees?**
Crash recovery: pages/structures get modified in multi-step operations, and
a crash mid-step would corrupt them — so every change is first appended to a
log; on restart, replay the log to restore consistency. The conceptual
payoff is bigger than recovery: the WAL is an **ordered, complete record of
changes**, which is exactly what replication ships (Ch. 6) and CDC taps
(Ch. 12). The log isn't an implementation detail; it's the database's
spine.
📖 *Ch. 4 — "B-Trees" (WAL discussion), "Log-Structured Storage"*

**13. Clustered, covering, and heap-referencing indexes — what's the actual choice?**
Where does the *row* live relative to the index? **Heap + secondary
indexes**: indexes hold pointers; every hit costs an extra lookup, but rows
have one home. **Clustered index**: the table *is* stored in index order
(e.g. by primary key) — primary-key range reads are beautifully fast;
secondary lookups go through the key. **Covering index**: store selected
columns *inside* a secondary index so hot queries never touch the row —
faster reads, bought with extra write amplification and storage. It's the
read/write trade-off, applied per query.
📖 *Ch. 4 — "Storing Values Within the Index", "Multicolumn and Secondary Indexes"*

**14. What do in-memory databases actually buy — given disk-based DBs cache hot data in RAM anyway?**
Not "avoiding disk reads" — a warm cache already does that. The win is
avoiding the *format*: no encoding data structures into disk-page layouts,
no buffer-pool management overhead, and the freedom to offer structures
that are awkward on disk (rich data types, priority queues). Durability
still comes from a log, snapshots, or replication — memory-first doesn't
mean durability-optional, it means the disk format stops dictating the
design.
📖 *Ch. 4 — "Keeping Everything in Memory"*

---

## Chapter 5 — Encoding and Evolution

**15. What are the ground rules that make a schema change safe in both directions?**
Tagged formats (Protobuf): add fields only with **new tag numbers** and
defaults; never reuse or renumber a tag (old bytes would silently misparse);
unknown tags are skippable, which is what lets old code read new data.
Avro: fields match by **name** between writer's and reader's schema;
reader-only fields need **defaults** (that's the compatibility test), and
the writer's schema must travel (file header or registry). One sentence:
*evolution safety is mechanical, and therefore checkable before deploy.*
📖 *Ch. 5 — "Protocol Buffers", "Avro", "The Merits of Schemas"*

**16. In an event pipeline, where do schemas live and where is compatibility enforced?**
Messages are tiny, so each carries a small **schema ID**; a **registry**
stores the schemas, consumers fetch-and-cache by ID and resolve against
their own reader schema. The strategic part: the registry is configured
with a compatibility mode and **rejects incompatible schemas at publish
time** — turning a would-be 3 a.m. consumer crash into a failed CI step for
the producer. Compatibility becomes infrastructure-enforced, not
convention-hoped.
📖 *Ch. 5 — "Avro", "The Merits of Schemas", "Event-Driven Architectures"*

**17. Durable execution / workflow engines (new in 2e) — what's the core mechanism and its catch?**
Long-running business processes (payments, provisioning) are written as
code whose progress is **persisted as an event history**; after a crash, the
workflow *replays* deterministically to its last state and continues —
retries, timers, and human-wait steps survive process death. The catch:
replay demands **determinism** — side effects must go through recorded
activities (executed once, result stored), and *versioning* workflow code
is the hard part, since old histories must still replay against it
(chapter-5 evolution rules, applied to code).
📖 *Ch. 5 — "Durable Execution and Workflows"*

**18. Why is a message queue described as a "time capsule" for schemas?**
Messages written before a deploy are consumed after it; backlogs and
dead-letter replays resurrect messages that are hours or months old. So
consumers face an *archive* of every schema version ever produced, not just
the current one — forward compatibility lives longest here, and event
schemas must be treated as public, versioned APIs with the strictest
discipline of any boundary.
📖 *Ch. 5 — "Event-Driven Architectures", "Modes of Dataflow"*

---

## Chapter 6 — Replication

**19. What makes failover genuinely hard? Name the three classic hazards.**
(1) **Lost acknowledged writes** — with async replication, the promoted
follower may lack writes the old leader confirmed; discarding them revokes
durability, and external systems that saw those writes now disagree.
(2) **Split brain** — the old leader returns still believing it leads;
without epochs/fencing, two nodes accept writes. (3) **Timeout tuning** —
too short and load spikes trigger spurious failovers (adding load to a
stressed system), too long and outages stretch. This trio is why mature
teams often keep a human approving the final switch.
📖 *Ch. 6 — "Handling Node Outages", "Synchronous Versus Asynchronous Replication"*

**20. Statement vs WAL-shipping vs logical replication — why does the log format matter strategically?**
**Statement-based** ships SQL text — nondeterminism (NOW(), RANDOM())
diverges replicas. **Physical WAL** ships exact bytes — deterministic but
locks replicas to the same engine version, blocking zero-downtime upgrades.
**Logical (row-based)** ships "row X changed from A to B" —
version-tolerant (upgrade replicas first, then fail over) and, the
strategic part, **consumable by external systems**: logical replication is
the doorway through which CDC (Ch. 12) and the whole derived-data
architecture walk.
📖 *Ch. 6 — "Implementation of Replication Logs"*

**21. In leaderless systems, how does data heal — and what do sloppy quorums change?**
Two repair paths: **read repair** (a quorum read that sees a stale replica
writes the fresh value back — heals hot keys) and **anti-entropy** (a
background process diffs replicas and syncs — heals cold keys nobody
reads; without it, rarely-read data stays stale indefinitely). **Sloppy
quorums** accept writes on substitute nodes during a partition (with
hinted handoff back to the home nodes later) — availability rescued, but w
acks no longer overlap the home set, so the w+r>n read guarantee is
suspended until hints deliver.
📖 *Ch. 6 — "Writing to the Database When a Node Is Down", "Leaderless Replication"*

**22. What makes a CRDT mergeable — and where does that matter now (2e)?**
The data type's operations are designed to be **commutative/convergent**:
any two replicas can apply each other's updates in any order and
mathematically *must* reach the same state — counters that merge by
summing per-replica increments, sets with add/remove semantics, sequence
types for collaborative text. No conflict handler to write, no LWW data
loss. The 2e relevance: **sync engines and local-first software** — every
device is a writer, offline edits are normal, and CRDTs make convergence
automatic instead of an app-code chore. The trade: you must express your
domain in CRDT-shaped types, and some invariants (uniqueness, "at most N")
fundamentally still need coordination.
📖 *Ch. 6 — "Sync Engines and Local-First Software", "Dealing with Conflicting Writes"*

---

## Chapter 7 — Sharding

**23. Sharding for multitenancy (new 2e section) — what's the actual design question?**
Whether a tenant is your **unit of sharding**: tenant-per-shard (or
tenant-per-database) gives isolation — noisy neighbors contained, per-tenant
migration, backup, deletion, and compliance become operations on a shard —
at the cost of skew (one whale tenant outgrows its shard) and operational
sprawl for thousands of tiny tenants. Shared shards pool small tenants
efficiently but make isolation, per-tenant SLOs, and "delete this customer
everywhere" harder. Most real systems end up hybrid: pooled small tenants,
dedicated shards for whales.
📖 *Ch. 7 — "Sharding for Multitenancy"*

**24. Consistent hashing with virtual nodes vs many-fixed-partitions — what problem do both solve, and how?**
Both decouple key placement from cluster size so rebalancing moves ~1/N of
the data instead of everything (the `mod N` disaster). **Consistent
hashing**: nodes own arcs of a hash ring; *virtual nodes* (many tokens per
physical node) even out load statistically and spread a failed node's data
across many successors. **Fixed partitions**: create far more partitions
than nodes up front; rebalance by reassigning whole partitions via a
metadata map. Same goal, different machinery — and the fixed-partition
approach is the more common one in practice (Kafka-style), so don't equate
"sharding" with "the ring."
📖 *Ch. 7 — "Sharding by Hash of Key", "Operations: Automatic Versus Manual Rebalancing"*

**25. Request routing: who knows where partition 17 lives, and why does that knowledge need consensus?**
Three placements of the routing map: a **routing tier** (proxies consult
it), **partition-aware clients** (the driver holds it), or **any-node
forwarding** (every node knows enough to forward). All reduce to one
requirement: an authoritative, highly available record of
partition→node assignment that updates *consistently* during rebalances —
two routers disagreeing mid-move means misdirected writes. That's why the
assignment typically lives in a consensus-backed coordination service
(Ch. 10), and why "metadata service down" stalls an otherwise healthy
cluster.
📖 *Ch. 7 — "Request Routing"*

---

## Chapter 8 — Transactions

**26. How does MVCC implement snapshot isolation — and what's its operational bill?**
Writers never overwrite: each write creates a new row **version** tagged
with its transaction ID; each transaction's snapshot rule is "see versions
committed before I began." Readers and writers therefore never block each
other. The bill: old versions accumulate and must be **garbage-collected**
(Postgres's VACUUM), and a long-running transaction pins the oldest visible
snapshot — blocking cleanup, bloating tables, and stalling replication
apply. "A 6-hour analytics query on the primary" is how this bites in real
designs.
📖 *Ch. 8 — "Snapshot Isolation and Repeatable Read"*

**27. What's the practical toolbox for preventing lost updates?**
In preference order: **push the update into the database** (atomic ops:
`UPDATE … SET n = n + 1`) so there's no read-modify-write gap; **explicit
locking** (`SELECT … FOR UPDATE`) when logic must run in the app;
**compare-and-set** (update only if the value is unchanged, retry
otherwise); or rely on the engine's **automatic detection** under snapshot
isolation (abort the stale writer, retry). In replicated multi-writer
stores none of these apply locally — you're in version-vector/merge
territory instead.
📖 *Ch. 8 — "Preventing Lost Updates"*

**28. Beyond "use serializable" — what's the materialize-the-conflict pattern for write skew and phantoms?**
Write skew happens because the conflicting transactions touch *disjoint*
rows; phantoms because the conflicting row doesn't exist yet. The pattern:
**introduce a row that both transactions must touch** — a row per on-call
shift to lock, a pre-created row per bookable room-slot whose unique
constraint arbitrates — converting an invisible conflict into an ordinary
lock or constraint violation. It's often cheaper and clearer than turning
on serializable isolation globally, and it shows you understand *why* the
anomaly occurs.
📖 *Ch. 8 — "Write Skew and Phantoms"*

**29. How does data modeling buy you out of distributed transactions?**
Strong guarantees are cheap **within** one object/row/document/partition:
single-object atomicity, per-document transactions, single-partition
serial execution. So co-locate what must change together — model the
aggregate as one document, choose partition keys so the invariant lives in
one shard — and the need for 2PC/sagas evaporates for most flows.
Conversely, scattering one logical change across services is what
*creates* distributed-transaction problems. First question in design
reviews: "can we re-model so this is single-partition?"
📖 *Ch. 8 — "Single-Object and Multi-Object Operations", "Actual Serial Execution"*

**30. Distributed transactions inside one system vs across heterogeneous systems — why does the 2e treat them so differently?**
**Database-internal** distributed transactions (a sharded database
committing across its own partitions) can work well: one vendor controls
all participants, and the commit decision can itself be consensus-
replicated — removing 2PC's fatal single-coordinator blocking flaw.
**Across different systems** (your DB + a queue + a search engine via
XA-style protocols), 2PC's in-doubt stalls, lowest-common-denominator
semantics, and operational pain dominate — which is why integration across
systems moved to logs + exactly-once message processing instead. Same
protocol, opposite verdicts, depending on who owns the participants.
📖 *Ch. 8 — "Database-Internal Distributed Transactions", "Distributed Transactions Across Different Systems"*

---

## Chapter 9 — The Trouble with Distributed Systems

**31. What does TCP actually guarantee — and what does it pointedly not?**
Within one connection: ordered, deduplicated, retransmitted byte delivery.
It does **not** guarantee your request was *processed* (the connection can
die after delivery, before the reply), and its guarantees end at the
connection — a retry on a *new* connection is, to TCP, unrelated traffic.
That's why duplicates and unknown-outcome are application-level facts no
transport fixes, and why exactly-once must be built above (end-to-end
argument, Ch. 13).
📖 *Ch. 9 — "The Limitations of TCP", "Unreliable Networks"*

**32. A request times out. Walk the disciplined response.**
Accept the ambiguity: it may have executed. Retry only if the operation is
**idempotent** — naturally, or via an idempotency key the server dedupes on.
Space retries with **exponential backoff + jitter** (synchronized retries
re-DDoS the dependency), cap them with a **retry budget**, and retry at
**one layer only** (stacked retries multiply: 3 layers × 3 attempts = 27
calls). Then make the timeout itself deliberate: derived from the
dependency's tail latency, not a folk constant.
📖 *Ch. 9 — "Timeouts and Unbounded Delays", "Fault Detection"; Ch. 8 — "Exactly-Once Message Processing Revisited"*

**33. Walk the fencing-token mechanism — and why can't the lock holder just re-check its lease?**
The lock service issues a **monotonically increasing token** with each
grant; clients attach it to every write; the protected resource remembers
the highest token seen and **rejects lower ones**. Re-checking can't work
because a process pause (GC, VM migration) can land *between* the check and
the write — the holder validates its lease, freezes, expires, and wakes to
write as a zombie. The principle: safety must be enforced **where the
writes land**, by something that can't be paused along with the client.
📖 *Ch. 9 — "Process Pauses", "Distributed Locks and Leases"*

**34. How do you use clocks safely when you must rely on them?**
Treat a timestamp as an **interval, not a point**: clock readings carry an
uncertainty bound (NTP error; or tight GPS/atomic bounds in Spanner-style
TrueTime), and correctness logic must respect it — e.g. **commit-wait**:
hold a transaction's commit until its uncertainty interval has fully
passed, so timestamp order matches real order. The portable lessons: never
order cross-node events by raw wall clocks, use monotonic clocks for
durations, and *monitor* clock skew like any other failure mode — almost
nobody does until it bites.
📖 *Ch. 9 — "Clock Synchronization and Accuracy", "Relying on Synchronized Clocks"*

---

## Chapter 10 — Consistency and Consensus

**35. Linearizability vs serializability — disentangle them in two sentences.**
**Serializability** is about *transactions*: the multi-object history is
equivalent to *some* serial order — which may disagree with real time (a
serializable system can serve stale snapshots). **Linearizability** is
about *single-object recency in real time*: once anyone sees a write,
everyone does. They're orthogonal; both together is **strict
serializability**. Saying "we're serializable, so reads are fresh" is the
precise confusion this card exists to kill.
📖 *Ch. 10 — "What Makes a System Linearizable?"; Ch. 8 — "Serializability"*

**36. "We run Raft, so reads from the leader are consistent." What's wrong, and what are the fixes?**
A leader can be **deposed and not know it** (partitioned, paused) — its
local reads then return stale data while the new leader commits elsewhere:
not linearizable. Fixes: **read-index** (leader confirms it's still leader
with a quorum check before serving), **lease reads** (serve locally during
a clock-bounded lease — fast, but correctness now leans on bounded clock
drift), or route reads through the log like writes (slow, simple). Many
production "strongly consistent" claims quietly skip this — it's a great
probing question from either side of the table.
📖 *Ch. 10 — "Implementing Linearizable Systems", "Consensus in Practice"*

**37. How do epochs plus quorum overlap prevent two leaders from both deciding?**
Every election increments an **epoch/term**; replicas reject messages from
older epochs — so a stale leader's writes bounce (consensus's built-in
fencing token). Elections require a **majority**, and any two majorities
**overlap** — so a new epoch's quorum always contains someone who knows
about the latest committed entries and the newest epoch, making stale
leadership detectable and committed data survivable across leader changes.
One line: *epochs say who's newest; overlap guarantees someone in the room
remembers.*
📖 *Ch. 10 — "Consensus", "The Many Faces of Consensus"; Ch. 9 — "The Majority Rules"*

**38. Snowflake-style ID generators — what do they give up to avoid coordination?**
Structure: timestamp bits + node ID + per-node sequence → unique,
*roughly* time-sortable IDs at huge throughput with **zero coordination**
per ID. What's given up: linearizable ordering — clock skew between nodes
means ID order only approximates event order, and an ID is *not* proof of
happened-before. If IDs must be strictly monotonic (audit sequences, fencing
tokens), you're back to a single-writer or consensus-backed generator — as
expensive as the guarantee it makes. Most systems want snowflakes and only
*think* they want monotonic.
📖 *Ch. 10 — "ID Generators and Logical Clocks", "Linearizable ID Generators"*

---

## Chapter 11 — Batch Processing

**39. Batch on object stores + ephemeral compute — what changed from the HDFS era?**
Compute clusters used to *own* the data (HDFS on the same machines,
move-code-to-data); now durable data lives in **object storage** and
compute clusters spin up, read over the network, write results, and
disappear. Wins: elasticity, pay-per-job, many engines over one copy,
durability outsourced. Costs: network reads (mitigated by columnar
formats + caching) and object-store semantics — immutable objects,
list/rename quirks — which push job design toward write-once outputs and
explicit manifests. It's storage/compute separation (card 1) applied to
batch.
📖 *Ch. 11 — "Object Stores", "Distributed Filesystems"*

**40. How do you choose a distributed join strategy?**
Ask what you know about the inputs. Know nothing → **shuffle join**:
repartition both sides by key over the network so matches co-locate
(general, expensive — the shuffle dominates). One side small →
**broadcast join**: ship it whole to every worker; the big side never
moves. Both sides already partitioned (and sorted) by the key →
**merge in place**, no shuffle. And the universal saboteur: a **hot key**
stalls the whole job, because one key's records can't be parallelized —
fix by salting the key or broadcasting around it, not by adding workers.
📖 *Ch. 11 — "Joins and Grouping", "Shuffling Data"*

**41. Why must batch jobs be side-effect-free with atomically published outputs?**
Tasks retry and run speculatively, so any task **may execute more than
once** — a job that emails users or mutates an external store mid-run
duplicates effects on every retry, and a half-failed run leaves the world
half-changed with no rollback. Discipline: compute pure outputs to a
staging location, **publish atomically** on success (consumers see complete
old or complete new, never a mix), keep the previous output for instant
rollback, and do any real-world effects after commit, idempotently.
📖 *Ch. 11 — "Batch Processing in Distributed Systems", "MapReduce"*

---

## Chapter 12 — Stream Processing

**42. Consumer groups, offsets, and lag — why is this design so operationally pleasant?**
A group divides **partitions** (not messages) among members: one reader per
partition preserves order; parallelism scales to the partition count (size
it generously — repartitioning later is a project). Progress is one
**committed offset** per partition — crash recovery is "resume from
offset," no per-message broker state. **Lag** (head minus committed) is the
single staleness metric; the alert that matters is lag *versus retention* —
"hours until unread data is deleted" — not absolute lag.
📖 *Ch. 12 — "Log-Based Message Brokers"*

**43. The transactional outbox — solve "update the DB and publish an event, atomically" without 2PC.**
In **one local ACID transaction**, write the business row *and* an event
row into an `outbox` table — one commit, both or neither. A relay (poller,
or CDC on the outbox table itself) publishes outbox rows to the stream;
since the relay is at-least-once, consumers dedupe by event ID. Atomicity
is borrowed from the only place it's cheap — a single database — and the
event can carry **intent** ("OrderPlaced"), richer than a row diff. This is
the most-asked integration pattern in design interviews; say it with the
dedupe caveat attached.
📖 *Ch. 12 — "Keeping Systems in Sync", "Change Data Capture"; Ch. 8 — "Exactly-Once Message Processing Revisited"*

**44. Log compaction — what does a compacted topic give you?**
Compaction keeps, per **key**, only the latest value (and eventually drops
keys whose latest value is a deletion tombstone) — the topic becomes
"current state of every key, as a log," bounded by keyspace size rather
than time. Payoff: a **bootstrappable changelog** — a new consumer (fresh
cache, rebuilt index, recovering processor state) reads it from the start
and arrives at full current state, no separate snapshot system. Caveats:
intermediate history is gone, and tombstones must be retained long enough
for slow consumers to learn about deletions.
📖 *Ch. 12 — "Log-Based Message Brokers", "State, Streams, and Immutability"*

**45. The three stream joins — and the temporal gotcha that breaks reprocessing.**
**Stream–stream**: correlate two event streams within a window (searches ↔
clicks); buffered, keyed state bounded by the window. **Stream–table**:
enrich events against reference data held as local state, kept current by
consuming that table's changelog. **Table–table**: two changelogs in, a
maintained materialized view out. The gotcha: stream–table joins enrich
against state **as of processing time** — replay last month's events today
and they join against *today's* table, so reprocessing isn't deterministic
unless you keep **versioned/temporal state** and join as-of the event's
timestamp. Naming that trade-off is the differentiator.
📖 *Ch. 12 — "Stream Joins"*

---

## Chapter 13 — A Philosophy of Streaming Systems

**46. How do you change the logic or schema of a derived view without downtime?**
**Reprocess in parallel, then switch**: keep the raw log; start a second
job/pipeline with the new logic reading from the beginning; let it build
view-v2 alongside the serving view-v1; when v2 catches the head, switch
reads atomically; keep v1 briefly for rollback. Migrations, bug fixes, and
"what if we'd always computed it this way?" all become replay + compare +
switch — the gradual-migration superpower that justifies keeping raw
immutable input in the first place.
📖 *Ch. 13 — "Batch and Stream Processing", "Combining Specialized Tools by Deriving Data"*

**47. Enforce a uniqueness constraint at scale without a lock service.**
Let a **log decide**: route all claims for a given value (username, seat,
SKU reservation) through one partition — the partition's total order makes
the first claim win and the rest fail, deterministically, with a
single-threaded-per-partition processor emitting accepted/rejected events.
Linearizable *for that key*, horizontally scalable across keys, no lock
service in the hot path. For constraints **spanning** partitions, choose:
multi-partition transactions, or the **apology pattern** — permit the rare
violation, detect it from the log, compensate (how overbooking has always
worked).
📖 *Ch. 13 — "Enforcing Constraints", "Aiming for Correctness"*

**48. "Observing derived state" — what does it mean to extend dataflow all the way to the client?**
If every view is a fold over a change stream, the user's screen is just the
last view in the chain — so instead of request/response polling, **push
state changes to clients**: subscriptions, live queries, offline-capable
apps that sync (meeting Ch. 6's local-first thread from the other side).
The write path (events → views) and read path (views → screens) become one
continuous dataflow. The costs are real — fan-out to millions of
subscribers, reconnect/catch-up semantics — but the model explains where
"real-time collaborative" products come from architecturally.
📖 *Ch. 13 — "Designing Applications Around Dataflow", "Observing Derived State"*

---

## Chapter 14 — Doing the Right Thing

**49. How does "delete this user" actually work in a log-based, replay-everything architecture?**
Deletion becomes a **propagation problem with acceptance criteria**: emit
deletion events every derived view must honor; use **tombstones** on
compacted topics so changelogs really drop the keys; bound retention on raw
topics so history ages out; and for data spread across logs, views, and
backups, use **crypto-shredding** — encrypt per user, delete the key, and
everything encrypted under it becomes unreadable everywhere at once. Then
*verify* by audit/replay that it's gone. Privacy regulation made this an
engineering requirement, not a policy memo — which is precisely the
chapter's point.
📖 *Ch. 14 — "Privacy and Use of Data", "Legislation and Self-Regulation"; Ch. 13 — "Trust, but Verify"*

---

*Pairing drill: take any main-ideas card from the 66-deck and find its deeper
siblings here (e.g., "dual writes are broken" → outbox 43, compaction 44,
reprocess-and-switch 46). If you can move fluently between the headline and
the mechanism, you can survive any follow-up an interviewer throws.*
