# DDIA 2nd Edition — Main-Ideas Flashcards

A deliberately short deck (66 cards) covering the **core ideas** of
*Designing Data-Intensive Applications, 2nd Edition* (Kleppmann & Riccomini,
O'Reilly, 2026 — 14 chapters). Built for staff-engineer interviews: each card
is a concept you'd actually *use* in a design discussion, not a detail anyone
would quiz you on. Answers are intentionally brief — the main idea and why it
matters — because at this level the win is fluent recall of the concept, not
recitation.

**About the book pointers (read this once):** the official table of contents
does not publish per-section page numbers, and pagination differs between
print, ebook, and O'Reilly online — so instead of guessed page numbers, every
card ends with 📖 **chapter + the exact section title from the official ToC**.
That's a 10-second lookup via the book's contents or index in any format, and
unlike a page number it's correct in all of them.
*Official ToC:* [O'Reilly — DDIA 2nd Edition](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/)

**How to use:** answer aloud before flipping; review misses at growing
intervals (1 → 3 → 7 → 14 → 30 days); shuffle across chapters. When a card is
easy, escalate: "where does this break at 10×, and what would I monitor?"

---

## Chapter 1 — Trade-Offs in Data Systems Architecture

**1. What's the single most important mindset the book opens with?**
There are no best data systems, only **trade-offs**: every choice (database,
architecture, cloud, consistency level) buys something by paying something
else. Staff-level answers therefore never say "X is better" — they say "X
buys us A at the cost of B, and here's why A matters more for *this*
workload."
📖 *Ch. 1 — chapter introduction & "Summary"*

**2. Operational vs analytical systems — why does the split exist?**
OLTP serves many small, latency-critical reads/writes of current state;
analytics scans huge swaths of history to aggregate. They conflict on access
pattern, storage layout, and blast radius (one analyst scan can flatten
checkout), so they're built as separate systems — with data flowing from the
operational side into warehouses/lakes.
📖 *Ch. 1 — "Operational Versus Analytical Systems", "Data Warehousing"*

**3. Systems of record vs derived data — why is this distinction the book's backbone?**
Every piece of data is either the **authoritative source of truth** (system
of record) or **derived** from one (caches, indexes, materialized views,
warehouse tables). Derived data is redundant and rebuildable — so the key
architectural questions become: what's the source of truth, and how do
derived copies stay in sync? Most of chapters 11–13 is answering that.
📖 *Ch. 1 — "Systems of Record and Derived Data"*

**4. Cloud vs self-hosting — how do you frame it beyond "cloud is easier"?**
It's an economics-and-control trade: cloud buys elasticity, managed
operations, and faster starts at the cost of per-unit price, egress,
lock-in, and a ceiling on customization; self-hosting inverts all of that.
Cloud-native architectures (separating storage from compute, object stores)
change *how* systems are designed, not just where they run.
📖 *Ch. 1 — "Cloud Versus Self-Hosting", "Cloud Native System Architecture"*

**5. When should a system be distributed — and what's the honest default?**
Distribute only when forced: data/load beyond one node, fault-tolerance or
geographic-latency requirements. A single node (or single beefy primary) is
simpler, cheaper, and often faster — distribution buys scalability and
resilience at the price of partial failures, consistency questions, and
operational complexity. The same logic tempers microservices and serverless:
network boundaries are expensive.
📖 *Ch. 1 — "Distributed Versus Single-Node Systems", "Microservices and Serverless"*

---

## Chapter 2 — Defining Nonfunctional Requirements

**6. Why are percentiles (p95/p99) the right way to describe performance?**
Latency is a distribution, not a number; averages hide the tail, and the
tail is what users hit — especially since one page fans out to many backend
calls, so the slowest dependency dominates (tail latency amplification).
SLOs are therefore written against percentiles, and optimization targets the
tail.
📖 *Ch. 2 — "Describing Performance", "Average, Median, and Percentiles"*

**7. What does "reliability" actually mean in this book's philosophy?**
Not "nothing fails" but **fault tolerance**: hardware, software, and humans
*will* fail, so design systems that keep working when components don't —
redundancy, isolation, graceful degradation, and (for the largest fault
source, humans) good interfaces, sandboxes, and easy recovery. Faults are
expected inputs, not exceptions.
📖 *Ch. 2 — "Reliability and Fault Tolerance", "Humans and Reliability"*

**8. What's the book's core claim about scalability?**
There is no generic "scalable" — scalability is always **relative to a
specific load** (the chapter's social-timeline case study: fan-out per post,
not just requests/sec). The job is to identify your load parameters, then
choose an architecture (shared-nothing scale-out being the dominant one) for
*that* load — and accept that a 10× growth usually means a redesign.
📖 *Ch. 2 — "Case Study: Social Network Home Timelines", "Scalability", "Principles for Scalability"*

**9. What are the three pillars of maintainability?**
**Operability** (make life easy for operations: observability, automation,
predictability), **simplicity** (manage complexity via good abstractions —
complexity is where bugs and slow changes come from), and **evolvability**
(make change easy — requirements *will* change). Most of a system's cost is
after launch, so these quietly dominate the fancier -ilities.
📖 *Ch. 2 — "Maintainability" (Operability / Simplicity / Evolvability)*

---

## Chapter 3 — Data Models and Query Languages

**10. Why do data models matter more than they appear to?**
The data model shapes how you *think* about the problem — each layer
(application objects → JSON/tables/graphs → bytes) is an abstraction that
makes some things easy and others nearly impossible. Choosing a model is
choosing which questions will be cheap to ask for the next decade.
📖 *Ch. 3 — chapter introduction & "Summary"*

**11. Relational vs document — what actually decides it?**
The shape of relationships. Document models win when data is
**self-contained trees** (one-to-many, loaded together): locality, schema
flexibility, less impedance mismatch. Relational wins when there are
**many-to-many relationships** and joins: normalize once, join anywhere.
Modern systems blur the line (JSON in Postgres), so the decision is about
your dominant access pattern, not vendor religion.
📖 *Ch. 3 — "Relational Versus Document Models", "Many-to-One and Many-to-Many Relationships", "When to Use Which Model"*

**12. Normalization vs denormalization — the one-sentence trade?**
Normalize to keep each fact in one place (cheap, safe updates); denormalize
to co-locate data with its reads (fast queries, duplicated facts that must
be kept in sync). At scale this becomes a derived-data problem: a normalized
source of truth plus denormalized read views, with a pipeline keeping them
consistent.
📖 *Ch. 3 — "Normalization, Denormalization, and Joins"*

**13. When do graph data models earn their keep?**
When **relationships are the data**: anything-connects-to-anything
(social graphs, recommendations, fraud rings, knowledge graphs) and queries
traverse variable-length paths — awkward as recursive SQL, natural in graph
query languages (Cypher, SPARQL). If your joins keep growing hops, you're
holding a graph in relational disguise.
📖 *Ch. 3 — "Graph-Like Data Models", "Property Graphs", "The Cypher Query Language"*

**14. Event sourcing and CQRS — what's the data-model idea (new to this chapter in 2e)?**
Store **what happened** (immutable events) as the source of truth, and
derive current state as views; separate the write model (events/commands)
from read models optimized per query (CQRS). You gain audit, replay, and
flexible read views — at the cost of projection machinery and event-schema
discipline.
📖 *Ch. 3 — "Event Sourcing and CQRS"*

---

## Chapter 4 — Storage and Retrieval

**15. The two storage-engine philosophies — and the trade between them?**
**B-trees** update pages in place: predictable reads, one home per key, the
OLTP classic. **LSM-trees / log-structured storage** append and merge:
sequential writes give high write throughput and compression, at the cost of
multi-file reads and background compaction that must keep up. Rule of thumb:
read-heavy transactional → B-tree; write-heavy/append-heavy → LSM — then
measure.
📖 *Ch. 4 — "Log-Structured Storage", "B-Trees", "Comparing B-Trees and LSM-Trees"*

**16. What is every index, fundamentally?**
A **derived structure that trades write cost and space for read speed** —
each write must also maintain every index. So indexes are chosen from real
query patterns and pruned like dependencies; "add an index" is never free.
📖 *Ch. 4 — "Multicolumn and Secondary Indexes", "Storing Values Within the Index"*

**17. Why does analytics storage look completely different (columns, not rows)?**
Analytical queries read few columns of millions of rows, so **column-oriented
storage** stores each column contiguously: read only what you need, compress
ruthlessly (similar values together), and execute vectorized over compressed
blocks. Row stores optimize "fetch an entity"; column stores optimize
"scan an attribute".
📖 *Ch. 4 — "Data Storage for Analytics", "Column-Oriented Storage", "Query Execution: Compilation and Vectorization"*

**18. Materialized views and data cubes — the main idea?**
**Precompute the expensive aggregation** and keep it updated, trading
freshness and write-time work for instant reads. It's the same
derived-data bargain as an index or a cache — and the same sync obligation.
📖 *Ch. 4 — "Materialized Views and Data Cubes"*

**19. Where do full-text search and vector embeddings fit conceptually (new in 2e)?**
They're **just more index types** for fuzzier questions: inverted indexes map
terms → documents for text search; vector indexes map embeddings →
nearest-neighbors for semantic similarity. Architecturally they're derived
data like any index — usually maintained in a specialized system fed from
the source of truth.
📖 *Ch. 4 — "Multidimensional and Full-Text Indexes", "Full-Text Search", "Vector Embeddings"*

---

## Chapter 5 — Encoding and Evolution

**20. Backward and forward compatibility — why must every schema change satisfy both?**
Rolling upgrades mean old and new code run *simultaneously*, each reading
the other's output; and **data outlives code** — rows and messages written
years ago are still read today. So: new code must read old data (backward),
old code must read new data (forward), on the day the change ships.
📖 *Ch. 5 — chapter introduction, "Formats for Encoding Data"*

**21. What's the real merit of schemas (Protobuf/Avro) beyond smaller bytes?**
**Machine-checkable compatibility**: with explicit schemas, a compiler or
registry can *prove* an evolution safe before it ships, generate code, and
document the data guaranteed-current. The size win is visible; the
evolution-safety win is the strategic one.
📖 *Ch. 5 — "Protocol Buffers", "Avro", "The Merits of Schemas"*

**22. Name the dataflow modes data crosses — and the 2e addition.**
Data flows **through databases** (your future code reads your past writes),
**through services** (REST/RPC — old clients linger for years), and
**through asynchronous events** (messages written before a deploy are
consumed after it). The 2nd edition adds **durable execution and workflow
engines** — long-running, retried business processes where state and code
versions must coexist. Every one of these boundaries is an evolution
boundary.
📖 *Ch. 5 — "Modes of Dataflow", "Durable Execution and Workflows", "Event-Driven Architectures"*

**23. Why is "RPC looks like a local function call" a dangerous abstraction?**
A network call can time out with **unknown outcome**, duplicate on retry,
and arrive late — none of which local calls do. Good service design keeps
the convenient syntax but surfaces the network: deadlines, retries you
configure, and idempotency as part of the API.
📖 *Ch. 5 — "Dataflow Through Services: REST and RPC"*

---

## Chapter 6 — Replication

**24. Why replicate, and what are the three architectures (by "who accepts writes")?**
Replicate for fault tolerance, read scale, and latency near users. The three
shapes: **single-leader** (one write door — no conflicts, needs failover),
**multi-leader** (write locally in several places — conflicts inevitable),
**leaderless** (any replica accepts — consistency by quorum arithmetic, no
failover). Everything else in the chapter is consequences.
📖 *Ch. 6 — chapter introduction, "Single-Leader Replication", "Multi-Leader Replication", "Leaderless Replication"*

**25. Synchronous vs asynchronous replication — what's really being chosen?**
What "committed" means. Sync: acknowledged writes exist on ≥2 nodes —
durable through failover, but latency and availability are hostage to
followers. Async: fast acks, but a failover can **lose acknowledged
writes**. The standard compromise is semi-synchronous (one sync follower).
This dial is the durability/latency trade in its purest form.
📖 *Ch. 6 — "Synchronous Versus Asynchronous Replication", "Handling Node Outages"*

**26. Replication lag causes three classic anomalies — name them and the fix family.**
Vanishing own writes (**read-your-writes**), time moving backwards across
refreshes (**monotonic reads**), and effect-before-cause
(**consistent prefix**). All are fixed by *routing reads*, not speeding
replication — per-user **session guarantees**, far cheaper than global
consistency and usually all the product needs.
📖 *Ch. 6 — "Problems with Replication Lag", "Solutions for Replication Lag"*

**27. When is multi-leader justified — and what's the 2e's new emphasis?**
When writes must succeed locally despite distance or disconnection:
multi-region operation, and — newly prominent — **sync engines and
local-first software** (your device is a leader that syncs later;
collaborative apps). The price is always the same: concurrent writes to the
same data become legal, so you owe a convergence story.
📖 *Ch. 6 — "Multi-Leader Replication", "Geographically Distributed Operation", "Sync Engines and Local-First Software"*

**28. Conflicting writes — what are the honest options?**
**Avoid** (route each record's writes to one home leader — most real
deployments), **last-write-wins** (converges by silently discarding an
acknowledged write, using clocks that lie — fine only for overwritable
data), or **detect-and-merge** (version vectors to spot concurrency, keep
siblings, merge in the app — or use **CRDTs**, data types whose merges are
automatic and always converge). Whatever you pick must be deterministic
everywhere.
📖 *Ch. 6 — "Dealing with Conflicting Writes", "Detecting Concurrent Writes"*

**29. Quorums (w + r > n) — what do they guarantee, and famously not?**
Overlap: every read quorum intersects every successful write quorum, so
reads see at least one up-to-date copy. **Not** guaranteed: linearizability
or bounded staleness — concurrent writes, partial failures, and sloppy
quorums all leak past the math. The sound bite: *quorums give overlap, not
ordering.*
📖 *Ch. 6 — "Leaderless Replication", "Writing to the Database When a Node Is Down"*

---

## Chapter 7 — Sharding

**30. Why shard — and why is it framed as a means of last resort?**
Shard when one node can't hold the data or the write load. The costs are
permanent: cross-shard queries and transactions get hard, operations get
complex, and hot spots appear. So: scale up and replicate first; shard when
forced — then choose keys carefully, because re-keying later is a migration.
📖 *Ch. 7 — "Pros and Cons of Sharding"*

**31. Key-range vs hash sharding — the core trade?**
**Range** preserves order (efficient scans) but invites hot spots on
sequential keys; **hash** spreads load evenly but kills range queries. The
production pattern is the compound key — hash a coarse component, sort
within it — getting spread *and* per-entity locality.
📖 *Ch. 7 — "Sharding by Key Range", "Sharding by Hash of Key"*

**32. What makes a hot spot, and why can't the system fix it for you?**
Skew is a **property of the data** (a celebrity key, "now" in time-series):
the load is indivisible by key, so no rebalancer helps. Fixes change the
keying — salt hot keys, special-case the head of the power law, pick
partition keys aligned with even load and dominant queries.
📖 *Ch. 7 — "Skewed Workloads and Relieving Hot Spots"*

**33. What's the golden rule of rebalancing?**
Move only what must move: never derive placement as `hash mod N` (changing N
remaps everything); use many fixed partitions (or consistent hashing) so
adding a node moves ~1/N of data. And be wary of fully automatic
rebalancing — bulk data movement triggered by a flaky failure detector can
turn a blip into a cascade.
📖 *Ch. 7 — "Operations: Automatic Versus Manual Rebalancing", "Request Routing"*

**34. Secondary indexes on sharded data — the two options and their trade?**
**Local** (each shard indexes its own data): cheap writes,
scatter-gather reads across all shards. **Global** (the index itself is
sharded by indexed value): one-shard reads, but writes fan out and the
index is typically updated asynchronously — it *lags*. Write-heavy → local;
read-heavy lookups → global, with staleness stated.
📖 *Ch. 7 — "Sharding and Secondary Indexes", "Local Secondary Indexes", "Global Secondary Indexes"*

---

## Chapter 8 — Transactions

**35. What is a transaction actually *for*, and what does the A in ACID really mean?**
A transaction collapses a whole class of partial-failure and concurrency
worries into one question: commit or abort. The A is **abortability** — on
failure, all-or-nothing rollback, which is what makes **safe retries**
possible. (Concurrency guarantees are Isolation's job; the C —
application invariants — is yours, not the database's.)
📖 *Ch. 8 — "What Exactly Is a Transaction?", "The Meaning of ACID"*

**36. What's the uncomfortable truth about default isolation levels?**
Most databases default to **read committed** (or snapshot isolation), not
serializability — so lost updates, write skew, and phantoms are *possible by
default*, and "we use transactions" doesn't mean "we're safe from races".
Knowing what your level actually permits is the whole game.
📖 *Ch. 8 — "Weak Isolation Levels", "Read Committed"*

**37. Snapshot isolation — the one idea?**
Every transaction reads a **consistent snapshot** as of its start (MVCC:
writers create new versions, readers ignore later ones), so **readers and
writers never block each other**. Long reads, reports, and backups coexist
with OLTP traffic — the workhorse isolation level of modern databases.
📖 *Ch. 8 — "Snapshot Isolation and Repeatable Read"*

**38. Lost updates, write skew, phantoms — what's the family resemblance?**
All are **check-then-act races**: a transaction reads something (a value, an
invariant, a search result), decides, and writes — while a concurrent
transaction invalidates the premise. Lost update: read-modify-write
clobbered. Write skew: invariant read overlapping, writes disjoint ("≥1
doctor on call"). Phantom: the conflicting row didn't exist yet. Spotting
the shape in a design is a staff signal.
📖 *Ch. 8 — "Preventing Lost Updates", "Write Skew and Phantoms"*

**39. Name the three practical routes to serializability.**
**Actual serial execution** (one transaction at a time per partition —
viable when data fits memory and transactions are short stored procedures),
**two-phase locking** (pessimistic: block on conflict; deadlocks, fragile
latency under contention), and **serializable snapshot isolation**
(optimistic: run on snapshots, abort on dangerous patterns; retry storms
under contention). Pick by contention rate and transaction length.
📖 *Ch. 8 — "Serializability", "Actual Serial Execution", "Two-Phase Locking", "Serializable Snapshot Isolation"*

**40. Why is two-phase commit avoided across systems — and what's the modern alternative (2e)?**
After a participant votes "yes" in prepare, it is **in doubt** — it cannot
unilaterally commit or abort until the coordinator decides. If the coordinator
crashes (or network drops), the participant holds locks indefinitely, stalling
unrelated transactions until recovery. That's the core sin: 2PC couples the
availability of all participants to one coordinator, and a single failure
blocks the whole chain. Add latency (multiple round trips + fsyncs) and the
operational pain of XA across heterogeneous systems.

The 2nd edition reframes cross-system integration: don't wrap distributed
transactions around updates. Instead, use **exactly-once message processing** —
ordered logs (one system of record), idempotent operations keyed by unique
identifiers, and atomic offset+output commits in the streaming layer. The
end-to-end operation ID collapses duplicates born above any single layer, so
retries are safe without a blocking coordinator. Transactions become careful
messaging, not a distributed lock.
📖 *Ch. 8 — "Distributed Transactions", "Two-Phase Commit", "Exactly-Once Message Processing Revisited"*

---

## Chapter 9 — The Trouble with Distributed Systems

**41. What single property defines distributed systems trouble?**
**Partial failure**: in one machine things either work or crash; across
machines, *some* parts fail, *sometimes*, in nondeterministic ways — and you
often can't even tell what failed. All the chapter's machinery exists
because of this one property.
📖 *Ch. 9 — "Faults and Partial Failures"*

**42. What can a timeout actually tell you?**
Only "no answer within T" — not whether the node is dead, slow, partitioned,
or *finished the work and lost the reply*. Failure detection is inherently a
guess in asynchronous networks, so actions taken on timeout (retry,
failover) must be safe when the guess is wrong: idempotency, fencing,
conservative automation.
📖 *Ch. 9 — "Unreliable Networks", "Timeouts and Unbounded Delays", "Fault Detection"*

**43. Why can't you trust clocks — and what's the broader lesson about local knowledge?**
Wall clocks skew and jump (NTP), and a process can **pause for seconds
between any two instructions** (GC, VM migration) — so "my clock says" and
"my lease is still valid" are beliefs that can be stale the moment they're
formed. Never order cross-node events by time-of-day clocks; never let a
node's local belief be the safety mechanism.
📖 *Ch. 9 — "Unreliable Clocks", "Relying on Synchronized Clocks", "Process Pauses"*

**44. If a node can't trust itself, where does truth live?**
In the **majority** (quorum decisions — a node deposed by a majority is
deposed, whether it knows or not) and at the **resource** (fencing tokens:
storage rejects writes from stale leaseholders). Leadership is a claim;
quorums grant it and resources verify it.
📖 *Ch. 9 — "Knowledge, Truth, and Lies", "The Majority Rules", "Distributed Locks and Leases"*

**45. What do system models and formal/randomized testing give you (2e emphasis)?**
Algorithms are correct **relative to assumptions** (partially synchronous
timing, crash-recovery nodes, non-Byzantine behavior) — deploy outside the
model and "proven correct" stops applying. Hence the 2e's added emphasis:
state your model, then hunt the gaps with formal methods (TLA+-style specs)
and randomized fault-injection testing, because partial-failure bugs hide
from ordinary tests.
📖 *Ch. 9 — "System Model and Reality", "Byzantine Faults", "Formal Methods and Randomized Testing"*

---

## Chapter 10 — Consistency and Consensus

**46. Linearizability in one sentence — and its price?**
The system behaves as if there's **one copy of the data** and every
operation takes effect atomically at a point in real time — once anyone
reads the new value, everyone does. Price: coordination on every operation —
latency, throughput limits, and unavailability for the minority side of a
partition. Buy it only where invariants demand recency.
📖 *Ch. 10 — "Linearizability", "What Makes a System Linearizable?", "The Cost of Linearizability"*

**47. What actually *needs* linearizability?**
The short list: locks and leases (two holders = disaster), uniqueness
constraints (one winner per username), and anything where acting on stale
state breaks an invariant. Most reads don't — session guarantees or plain
eventual consistency serve them — which is why the design move is an
*inventory*, not a global setting.
📖 *Ch. 10 — "Relying on Linearizability"*

**48. Logical clocks and ID generators — what problem do they solve (2e framing)?**
Ordering events without trusting wall clocks: Lamport-style **logical
clocks** give a total order consistent with causality (without detecting
concurrency), and ID generators (snowflakes and friends) trade between
ordering guarantees, coordination cost, and throughput — a **linearizable ID
generator** is exactly as hard as the consistency it promises.
📖 *Ch. 10 — "ID Generators and Logical Clocks", "Logical Clocks", "Linearizable ID Generators"*

**49. Why is consensus "many problems in one" — and where does it run in practice?**
Agreeing on one value, electing one leader, ordering a replicated log
(total order broadcast), and committing atomically are **equivalent**
problems — solve one, you've solved the others. In practice consensus is
concentrated into a small control plane: replicated-log protocols (Raft and
kin) inside databases and brokers, and **coordination services**
(ZooKeeper/etcd) that export it as locks, leases, elections, and metadata.
📖 *Ch. 10 — "Consensus", "The Many Faces of Consensus", "Consensus in Practice", "Coordination Services"*

**50. Why not make everything linearizable / run everything through consensus?**
Because you'd pay cross-node round-trips on every operation, cap throughput
at the ordering group, and go unavailable in partitions — for a guarantee
most flows don't need. Mature architecture: a tiny coordinated kernel
(elections, uniqueness, leases), and everything else deliberately,
explicitly weaker.
📖 *Ch. 10 — "The Cost of Linearizability", "Consensus in Practice"*

---

## Chapter 11 — Batch Processing

**51. What's the batch-processing philosophy that everything else inherits?**
**Immutable inputs, deterministic jobs, explicit outputs** (the Unix
pipeline ethos at datacenter scale): any task can be re-run anywhere with
identical results, so fault tolerance is retry-and-recompute — and *human*
fault tolerance comes free: fix the bug, re-run on the untouched input.
📖 *Ch. 11 — "Batch Processing with Unix Tools", "Batch Processing in Distributed Systems"*

**52. MapReduce vs modern dataflow engines — the essential difference?**
MapReduce **fully materializes** every stage to replicated storage (durable
checkpoints, slow I/O, dead time between jobs); dataflow engines (Spark,
Flink lineage) model the whole pipeline as one operator DAG and **stream
between operators** — much faster, but they owe their own recovery story
(lineage recompute or checkpoints).
📖 *Ch. 11 — "MapReduce", "Dataflow Engines"*

**53. Where does the cost (and the pain) live in distributed batch jobs?**
In the **shuffle** — repartitioning data by key across the network for joins
and grouping. Join strategy is "what do I know about my inputs" (broadcast a
small side, merge pre-partitioned sides, otherwise full shuffle), and
**skew** — one hot key — stalls everything, because parallelism can't divide
an indivisible key.
📖 *Ch. 11 — "Shuffling Data", "Joins and Grouping"*

**54. What are batch jobs *for*, in the derived-data worldview?**
Building **derived data**: ETL into warehouses, analytics, ML training
sets/features, and precomputed serving stores (search indexes,
recommendations) — written as fresh immutable outputs and swapped in, not
mutated in place. Batch is the rebuild arm of the
source-of-truth/derived-data architecture from chapter 1.
📖 *Ch. 11 — "Batch Use Cases", "Serving Derived Data"*

---

## Chapter 12 — Stream Processing

**55. Log-based brokers vs traditional message queues — the defining difference?**
A queue treats messages as **tasks**: deliver to one worker, delete on ack.
A log treats them as **events** — append-only, retained; consumers are just
offsets, so you get per-partition ordering, many independent readers of the
same stream, and **replay** — the property that makes derived views
rebuildable. History with value → log; disposable jobs → queue.
📖 *Ch. 12 — "Messaging Systems", "Log-Based Message Brokers"*

**56. Keeping several systems in sync — why do dual writes fail, and what's the fix?**
App-writes-to-each-system has no shared order (concurrent updates apply in
different orders → permanent silent divergence) and no atomicity (crash
between writes). Fix: one **system of record**, with **change data capture**
publishing its commit log so every other system applies *the same changes in
the same order*.
📖 *Ch. 12 — "Keeping Systems in Sync", "Change Data Capture"*

**57. "State is a cache of the log" — unpack the slogan.**
A table is what you get by folding a changelog; a changelog is how the table
got there (**stream-table duality**). Keep the log and every state —
caches, indexes, aggregates, processor state — becomes disposable and
rebuildable by replay. This immutability principle is the load-bearing beam
under CDC, event sourcing, and chapter 13's architecture.
📖 *Ch. 12 — "State, Streams, and Immutability"*

**58. Event time vs processing time — and what's a watermark?**
Event time = when it happened; processing time = when your pipeline saw it.
Windowing by processing time records *your pipeline's hiccups as user
behavior*. Event-time windows need a **watermark** — a calibrated bet that
"all events ≤ T have arrived" — to know when to close, plus an explicit
policy for stragglers that arrive after it (drop / correct / sideline).
📖 *Ch. 12 — "Reasoning About Time"*

**59. What does "exactly-once" honestly mean in stream processing?**
**Effectively-once effects**, not single delivery: duplicates are physics
(retries), so they're neutralized at boundaries — idempotent writes,
atomic output+offset commits — and the guarantee always has a *scope*; the
moment results leave for an external system, that system needs its own
idempotency.
📖 *Ch. 12 — "Fault Tolerance"*

---

## Chapter 13 — A Philosophy of Streaming Systems

**60. The chapter's thesis: how do you integrate many specialized systems without chaos?**
**Derive, don't dual-write**: pick systems of record, flow their changes
through ordered logs, and treat every other store (search, cache, warehouse,
ML features) as a **derived view** — rebuildable by replay, updated
asynchronously, loosely coupled. Batch and stream are the two arms of the
same derivation.
📖 *Ch. 13 — "Data Integration", "Combining Specialized Tools by Deriving Data"*

**61. "Unbundling the database" — the idea in two sentences?**
A database is internally a log keeping storage, indexes, and views in
lockstep; an organization's systems are those same components scattered
across products, missing the lockstep. Unbundling restores it: an ordered
change log as the org's WAL, specialized systems as its indexes — composing
best-of-breed tools into one coherent "database" at architecture scale.
📖 *Ch. 13 — "Unbundling Databases", "Composing Data Storage Technologies", "Designing Applications Around Dataflow"*

**62. The end-to-end argument — why do reliable components not add up to reliable operations?**
Each layer's guarantee is scoped to itself (TCP per connection, broker per
message, DB per transaction), but faults like duplicates can be *born above
all of them* — a user's retry is two legitimate requests. Correctness
functions like exactly-once must be implemented **at the endpoints**: an
operation ID minted at the moment of intent, enforced at the final write.
Lower layers optimize; ends own correctness.
📖 *Ch. 13 — "Aiming for Correctness", "The End-to-End Argument for Databases"*

**63. Timeliness vs integrity — the decomposition that changes designs?**
**Timeliness** (readers see fresh state) violations heal by waiting;
**integrity** (nothing lost, double-counted, or inconsistent with sources)
violations are permanent until repaired. Products tolerate lots of the
first and none of the second — so spend coordination on integrity, relax
timeliness deliberately, and verify ("trust, but verify": audit derived
state against sources, because silent corruption happens).
📖 *Ch. 13 — "Timeliness and Integrity", "Trust, but Verify", "Enforcing Constraints"*

---

## Chapter 14 — Doing the Right Thing

**64. What's the core warning about predictive analytics?**
Models trained on biased history launder bias into objective-looking
outputs, and **feedback loops amplify** (deny credit → thinner file → deny
credit). "The algorithm decided" is a responsibility smell — humans chose
the data, the objective, and the threshold, and accountability has to live
with them.
📖 *Ch. 14 — "Predictive Analytics", "Bias and Discrimination", "Feedback Loops"*

**65. How should an engineer think about collected data?**
As **liability as much as asset**: replay-everything architectures spread
personal data into logs, views, and backups; consent decays as data is
joined and repurposed; breaches and acquisitions inherit everything. The
only privacy mechanism that survives every future is **collecting less** —
and deletion/retention must be designed as data flows, not bolted on.
📖 *Ch. 14 — "Privacy and Tracking", "Consent and Freedom of Choice", "Data as Assets and Power"*

**66. Why does the book end with regulation and responsibility rather than technology?**
Because the systems this book teaches concentrate power over people, and
history (the chapter invokes the Industrial Revolution) says industries
don't self-correct externalities without norms and law — GDPR-style
legislation made deletion, purpose limitation, and minimization *engineering
requirements*. Treating "doing the right thing" as part of the design space
is the closing thesis.
📖 *Ch. 14 — "Remembering the Industrial Revolution", "Legislation and Self-Regulation"*

---

*Coverage drill: close the file and try to reconstruct the book's spine from
memory — trade-offs → requirements → models → storage → encoding →
replication → sharding → transactions → trouble → consensus → batch →
streams → philosophy → ethics. If you can narrate one main idea per chapter
in two minutes, you have the whole book at interview-recall depth.*
