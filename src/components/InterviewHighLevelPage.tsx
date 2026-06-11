import React, { useState, useEffect, useCallback, useMemo } from "react";
import DDIAThemeProvider from "../blog/components/ddia/DDIAThemeProvider";

/* ─── Data ─── */

interface Flashcard {
  id: number;
  section: string;
  chapter: number;
  question: string;
  answer: string;
}

const flashcards: Flashcard[] = [
  { id: 1, section: "Trade-Offs in Data Systems Architecture", chapter: 1,
    question: "What's the single most important mindset the book opens with?",
    answer: "There are no best data systems, only trade-offs: every choice (database,\narchitecture, cloud, consistency level) buys something by paying something\nelse. Staff-level answers therefore never say \"X is better\" — they say \"X\nbuys us A at the cost of B, and here's why A matters more for *this*\nworkload.\"" },
  { id: 2, section: "Trade-Offs in Data Systems Architecture", chapter: 1,
    question: "Operational vs analytical systems — why does the split exist?",
    answer: "OLTP serves many small, latency-critical reads/writes of current state;\nanalytics scans huge swaths of history to aggregate. They conflict on access\npattern, storage layout, and blast radius (one analyst scan can flatten\ncheckout), so they're built as separate systems — with data flowing from the\noperational side into warehouses/lakes." },
  { id: 3, section: "Trade-Offs in Data Systems Architecture", chapter: 1,
    question: "Systems of record vs derived data — why is this distinction the book's backbone?",
    answer: "Every piece of data is either the authoritative source of truth (system\nof record) or derived from one (caches, indexes, materialized views,\nwarehouse tables). Derived data is redundant and rebuildable — so the key\narchitectural questions become: what's the source of truth, and how do\nderived copies stay in sync? Most of chapters 11–13 is answering that." },
  { id: 4, section: "Trade-Offs in Data Systems Architecture", chapter: 1,
    question: "Cloud vs self-hosting — how do you frame it beyond \"cloud is easier\"?",
    answer: "It's an economics-and-control trade: cloud buys elasticity, managed\noperations, and faster starts at the cost of per-unit price, egress,\nlock-in, and a ceiling on customization; self-hosting inverts all of that.\nCloud-native architectures (separating storage from compute, object stores)\nchange *how* systems are designed, not just where they run." },
  { id: 5, section: "Trade-Offs in Data Systems Architecture", chapter: 1,
    question: "When should a system be distributed — and what's the honest default?",
    answer: "Distribute only when forced: data/load beyond one node, fault-tolerance or\ngeographic-latency requirements. A single node (or single beefy primary) is\nsimpler, cheaper, and often faster — distribution buys scalability and\nresilience at the price of partial failures, consistency questions, and\noperational complexity. The same logic tempers microservices and serverless:\nnetwork boundaries are expensive." },
  { id: 6, section: "Defining Nonfunctional Requirements", chapter: 2,
    question: "Why are percentiles (p95/p99) the right way to describe performance?",
    answer: "Latency is a distribution, not a number; averages hide the tail, and the\ntail is what users hit — especially since one page fans out to many backend\ncalls, so the slowest dependency dominates (tail latency amplification).\nSLOs are therefore written against percentiles, and optimization targets the\ntail." },
  { id: 7, section: "Defining Nonfunctional Requirements", chapter: 2,
    question: "What does \"reliability\" actually mean in this book's philosophy?",
    answer: "Not \"nothing fails\" but fault tolerance: hardware, software, and humans\n*will* fail, so design systems that keep working when components don't —\nredundancy, isolation, graceful degradation, and (for the largest fault\nsource, humans) good interfaces, sandboxes, and easy recovery. Faults are\nexpected inputs, not exceptions." },
  { id: 8, section: "Defining Nonfunctional Requirements", chapter: 2,
    question: "What's the book's core claim about scalability?",
    answer: "There is no generic \"scalable\" — scalability is always relative to a\nspecific load (the chapter's social-timeline case study: fan-out per post,\nnot just requests/sec). The job is to identify your load parameters, then\nchoose an architecture (shared-nothing scale-out being the dominant one) for\n*that* load — and accept that a 10× growth usually means a redesign." },
  { id: 9, section: "Defining Nonfunctional Requirements", chapter: 2,
    question: "What are the three pillars of maintainability?",
    answer: "Operability (make life easy for operations: observability, automation,\npredictability), simplicity (manage complexity via good abstractions —\ncomplexity is where bugs and slow changes come from), and evolvability\n(make change easy — requirements *will* change). Most of a system's cost is\nafter launch, so these quietly dominate the fancier -ilities." },
  { id: 10, section: "Data Models and Query Languages", chapter: 3,
    question: "Why do data models matter more than they appear to?",
    answer: "The data model shapes how you *think* about the problem — each layer\n(application objects → JSON/tables/graphs → bytes) is an abstraction that\nmakes some things easy and others nearly impossible. Choosing a model is\nchoosing which questions will be cheap to ask for the next decade." },
  { id: 11, section: "Data Models and Query Languages", chapter: 3,
    question: "Relational vs document — what actually decides it?",
    answer: "The shape of relationships. Document models win when data is\nself-contained trees (one-to-many, loaded together): locality, schema\nflexibility, less impedance mismatch. Relational wins when there are\nmany-to-many relationships and joins: normalize once, join anywhere.\nModern systems blur the line (JSON in Postgres), so the decision is about\nyour dominant access pattern, not vendor religion." },
  { id: 12, section: "Data Models and Query Languages", chapter: 3,
    question: "Normalization vs denormalization — the one-sentence trade?",
    answer: "Normalize to keep each fact in one place (cheap, safe updates); denormalize\nto co-locate data with its reads (fast queries, duplicated facts that must\nbe kept in sync). At scale this becomes a derived-data problem: a normalized\nsource of truth plus denormalized read views, with a pipeline keeping them\nconsistent." },
  { id: 13, section: "Data Models and Query Languages", chapter: 3,
    question: "When do graph data models earn their keep?",
    answer: "When relationships are the data: anything-connects-to-anything\n(social graphs, recommendations, fraud rings, knowledge graphs) and queries\ntraverse variable-length paths — awkward as recursive SQL, natural in graph\nquery languages (Cypher, SPARQL). If your joins keep growing hops, you're\nholding a graph in relational disguise." },
  { id: 14, section: "Data Models and Query Languages", chapter: 3,
    question: "Event sourcing and CQRS — what's the data-model idea (new to this chapter in 2e)?",
    answer: "Store what happened (immutable events) as the source of truth, and\nderive current state as views; separate the write model (events/commands)\nfrom read models optimized per query (CQRS). You gain audit, replay, and\nflexible read views — at the cost of projection machinery and event-schema\ndiscipline." },
  { id: 15, section: "Storage and Retrieval", chapter: 4,
    question: "The two storage-engine philosophies — and the trade between them?",
    answer: "B-trees update pages in place: predictable reads, one home per key, the\nOLTP classic. LSM-trees / log-structured storage append and merge:\nsequential writes give high write throughput and compression, at the cost of\nmulti-file reads and background compaction that must keep up. Rule of thumb:\nread-heavy transactional → B-tree; write-heavy/append-heavy → LSM — then\nmeasure." },
  { id: 16, section: "Storage and Retrieval", chapter: 4,
    question: "What is every index, fundamentally?",
    answer: "A derived structure that trades write cost and space for read speed —\neach write must also maintain every index. So indexes are chosen from real\nquery patterns and pruned like dependencies; \"add an index\" is never free." },
  { id: 17, section: "Storage and Retrieval", chapter: 4,
    question: "Why does analytics storage look completely different (columns, not rows)?",
    answer: "Analytical queries read few columns of millions of rows, so column-oriented\nstorage stores each column contiguously: read only what you need, compress\nruthlessly (similar values together), and execute vectorized over compressed\nblocks. Row stores optimize \"fetch an entity\"; column stores optimize\n\"scan an attribute\"." },
  { id: 18, section: "Storage and Retrieval", chapter: 4,
    question: "Materialized views and data cubes — the main idea?",
    answer: "Precompute the expensive aggregation and keep it updated, trading\nfreshness and write-time work for instant reads. It's the same\nderived-data bargain as an index or a cache — and the same sync obligation." },
  { id: 19, section: "Storage and Retrieval", chapter: 4,
    question: "Where do full-text search and vector embeddings fit conceptually (new in 2e)?",
    answer: "They're just more index types for fuzzier questions: inverted indexes map\nterms → documents for text search; vector indexes map embeddings →\nnearest-neighbors for semantic similarity. Architecturally they're derived\ndata like any index — usually maintained in a specialized system fed from\nthe source of truth." },
  { id: 20, section: "Encoding and Evolution", chapter: 5,
    question: "Backward and forward compatibility — why must every schema change satisfy both?",
    answer: "Rolling upgrades mean old and new code run *simultaneously*, each reading\nthe other's output; and data outlives code — rows and messages written\nyears ago are still read today. So: new code must read old data (backward),\nold code must read new data (forward), on the day the change ships." },
  { id: 21, section: "Encoding and Evolution", chapter: 5,
    question: "What's the real merit of schemas (Protobuf/Avro) beyond smaller bytes?",
    answer: "Machine-checkable compatibility: with explicit schemas, a compiler or\nregistry can *prove* an evolution safe before it ships, generate code, and\ndocument the data guaranteed-current. The size win is visible; the\nevolution-safety win is the strategic one." },
  { id: 22, section: "Encoding and Evolution", chapter: 5,
    question: "Name the dataflow modes data crosses — and the 2e addition.",
    answer: "Data flows through databases (your future code reads your past writes),\nthrough services (REST/RPC — old clients linger for years), and\nthrough asynchronous events (messages written before a deploy are\nconsumed after it). The 2nd edition adds durable execution and workflow\nengines — long-running, retried business processes where state and code\nversions must coexist. Every one of these boundaries is an evolution\nboundary." },
  { id: 23, section: "Encoding and Evolution", chapter: 5,
    question: "Why is \"RPC looks like a local function call\" a dangerous abstraction?",
    answer: "A network call can time out with unknown outcome, duplicate on retry,\nand arrive late — none of which local calls do. Good service design keeps\nthe convenient syntax but surfaces the network: deadlines, retries you\nconfigure, and idempotency as part of the API." },
  { id: 24, section: "Replication", chapter: 6,
    question: "Why replicate, and what are the three architectures (by \"who accepts writes\")?",
    answer: "Replicate for fault tolerance, read scale, and latency near users. The three\nshapes: single-leader (one write door — no conflicts, needs failover),\nmulti-leader (write locally in several places — conflicts inevitable),\nleaderless (any replica accepts — consistency by quorum arithmetic, no\nfailover). Everything else in the chapter is consequences." },
  { id: 25, section: "Replication", chapter: 6,
    question: "Synchronous vs asynchronous replication — what's really being chosen?",
    answer: "What \"committed\" means. Sync: acknowledged writes exist on ≥2 nodes —\ndurable through failover, but latency and availability are hostage to\nfollowers. Async: fast acks, but a failover can lose acknowledged\nwrites. The standard compromise is semi-synchronous (one sync follower).\nThis dial is the durability/latency trade in its purest form." },
  { id: 26, section: "Replication", chapter: 6,
    question: "Replication lag causes three classic anomalies — name them and the fix family.",
    answer: "Vanishing own writes (read-your-writes), time moving backwards across\nrefreshes (monotonic reads), and effect-before-cause\n(consistent prefix). All are fixed by *routing reads*, not speeding\nreplication — per-user session guarantees, far cheaper than global\nconsistency and usually all the product needs." },
  { id: 27, section: "Replication", chapter: 6,
    question: "When is multi-leader justified — and what's the 2e's new emphasis?",
    answer: "When writes must succeed locally despite distance or disconnection:\nmulti-region operation, and — newly prominent — sync engines and\nlocal-first software (your device is a leader that syncs later;\ncollaborative apps). The price is always the same: concurrent writes to the\nsame data become legal, so you owe a convergence story." },
  { id: 28, section: "Replication", chapter: 6,
    question: "Conflicting writes — what are the honest options?",
    answer: "Avoid (route each record's writes to one home leader — most real\ndeployments), last-write-wins (converges by silently discarding an\nacknowledged write, using clocks that lie — fine only for overwritable\ndata), or detect-and-merge (version vectors to spot concurrency, keep\nsiblings, merge in the app — or use CRDTs, data types whose merges are\nautomatic and always converge). Whatever you pick must be deterministic\neverywhere." },
  { id: 29, section: "Replication", chapter: 6,
    question: "Quorums (w + r > n) — what do they guarantee, and famously not?",
    answer: "Overlap: every read quorum intersects every successful write quorum, so\nreads see at least one up-to-date copy. Not guaranteed: linearizability\nor bounded staleness — concurrent writes, partial failures, and sloppy\nquorums all leak past the math. The sound bite: *quorums give overlap, not\nordering.*" },
  { id: 30, section: "Sharding", chapter: 7,
    question: "Why shard — and why is it framed as a means of last resort?",
    answer: "Shard when one node can't hold the data or the write load. The costs are\npermanent: cross-shard queries and transactions get hard, operations get\ncomplex, and hot spots appear. So: scale up and replicate first; shard when\nforced — then choose keys carefully, because re-keying later is a migration." },
  { id: 31, section: "Sharding", chapter: 7,
    question: "Key-range vs hash sharding — the core trade?",
    answer: "Range preserves order (efficient scans) but invites hot spots on\nsequential keys; hash spreads load evenly but kills range queries. The\nproduction pattern is the compound key — hash a coarse component, sort\nwithin it — getting spread *and* per-entity locality." },
  { id: 32, section: "Sharding", chapter: 7,
    question: "What makes a hot spot, and why can't the system fix it for you?",
    answer: "Skew is a property of the data (a celebrity key, \"now\" in time-series):\nthe load is indivisible by key, so no rebalancer helps. Fixes change the\nkeying — salt hot keys, special-case the head of the power law, pick\npartition keys aligned with even load and dominant queries." },
  { id: 33, section: "Sharding", chapter: 7,
    question: "What's the golden rule of rebalancing?",
    answer: "Move only what must move: never derive placement as `hash mod N` (changing N\nremaps everything); use many fixed partitions (or consistent hashing) so\nadding a node moves ~1/N of data. And be wary of fully automatic\nrebalancing — bulk data movement triggered by a flaky failure detector can\nturn a blip into a cascade." },
  { id: 34, section: "Sharding", chapter: 7,
    question: "Secondary indexes on sharded data — the two options and their trade?",
    answer: "Local (each shard indexes its own data): cheap writes,\nscatter-gather reads across all shards. Global (the index itself is\nsharded by indexed value): one-shard reads, but writes fan out and the\nindex is typically updated asynchronously — it *lags*. Write-heavy → local;\nread-heavy lookups → global, with staleness stated." },
  { id: 35, section: "Transactions", chapter: 8,
    question: "What is a transaction actually *for*, and what does the A in ACID really mean?",
    answer: "A transaction collapses a whole class of partial-failure and concurrency\nworries into one question: commit or abort. The A is abortability — on\nfailure, all-or-nothing rollback, which is what makes safe retries\npossible. (Concurrency guarantees are Isolation's job; the C —\napplication invariants — is yours, not the database's.)" },
  { id: 36, section: "Transactions", chapter: 8,
    question: "What's the uncomfortable truth about default isolation levels?",
    answer: "Most databases default to read committed (or snapshot isolation), not\nserializability — so lost updates, write skew, and phantoms are *possible by\ndefault*, and \"we use transactions\" doesn't mean \"we're safe from races\".\nKnowing what your level actually permits is the whole game." },
  { id: 37, section: "Transactions", chapter: 8,
    question: "Snapshot isolation — the one idea?",
    answer: "Every transaction reads a consistent snapshot as of its start (MVCC:\nwriters create new versions, readers ignore later ones), so readers and\nwriters never block each other. Long reads, reports, and backups coexist\nwith OLTP traffic — the workhorse isolation level of modern databases." },
  { id: 38, section: "Transactions", chapter: 8,
    question: "Lost updates, write skew, phantoms — what's the family resemblance?",
    answer: "All are check-then-act races: a transaction reads something (a value, an\ninvariant, a search result), decides, and writes — while a concurrent\ntransaction invalidates the premise. Lost update: read-modify-write\nclobbered. Write skew: invariant read overlapping, writes disjoint (\"≥1\ndoctor on call\"). Phantom: the conflicting row didn't exist yet. Spotting\nthe shape in a design is a staff signal." },
  { id: 39, section: "Transactions", chapter: 8,
    question: "Name the three practical routes to serializability.",
    answer: "Actual serial execution (one transaction at a time per partition —\nviable when data fits memory and transactions are short stored procedures),\ntwo-phase locking (pessimistic: block on conflict; deadlocks, fragile\nlatency under contention), and serializable snapshot isolation\n(optimistic: run on snapshots, abort on dangerous patterns; retry storms\nunder contention). Pick by contention rate and transaction length." },
  { id: 40, section: "Transactions", chapter: 8,
    question: "Why is two-phase commit avoided across systems — and what's the modern alternative (2e)?",
    answer: "After voting yes, a participant is in doubt — stuck holding locks until\na possibly-crashed coordinator decides; plus latency and an availability\nproduct of all parties. The 2nd edition's reframing: integrate systems with\nexactly-once message processing instead — idempotence, atomic\noffset+output commits, and end-to-end identifiers, i.e. transactions\nrecast as careful messaging." },
  { id: 41, section: "The Trouble with Distributed Systems", chapter: 9,
    question: "What single property defines distributed systems trouble?",
    answer: "Partial failure: in one machine things either work or crash; across\nmachines, *some* parts fail, *sometimes*, in nondeterministic ways — and you\noften can't even tell what failed. All the chapter's machinery exists\nbecause of this one property." },
  { id: 42, section: "The Trouble with Distributed Systems", chapter: 9,
    question: "What can a timeout actually tell you?",
    answer: "Only \"no answer within T\" — not whether the node is dead, slow, partitioned,\nor *finished the work and lost the reply*. Failure detection is inherently a\nguess in asynchronous networks, so actions taken on timeout (retry,\nfailover) must be safe when the guess is wrong: idempotency, fencing,\nconservative automation." },
  { id: 43, section: "The Trouble with Distributed Systems", chapter: 9,
    question: "Why can't you trust clocks — and what's the broader lesson about local knowledge?",
    answer: "Wall clocks skew and jump (NTP), and a process can pause for seconds\nbetween any two instructions (GC, VM migration) — so \"my clock says\" and\n\"my lease is still valid\" are beliefs that can be stale the moment they're\nformed. Never order cross-node events by time-of-day clocks; never let a\nnode's local belief be the safety mechanism." },
  { id: 44, section: "The Trouble with Distributed Systems", chapter: 9,
    question: "If a node can't trust itself, where does truth live?",
    answer: "In the majority (quorum decisions — a node deposed by a majority is\ndeposed, whether it knows or not) and at the resource (fencing tokens:\nstorage rejects writes from stale leaseholders). Leadership is a claim;\nquorums grant it and resources verify it." },
  { id: 45, section: "The Trouble with Distributed Systems", chapter: 9,
    question: "What do system models and formal/randomized testing give you (2e emphasis)?",
    answer: "Algorithms are correct relative to assumptions (partially synchronous\ntiming, crash-recovery nodes, non-Byzantine behavior) — deploy outside the\nmodel and \"proven correct\" stops applying. Hence the 2e's added emphasis:\nstate your model, then hunt the gaps with formal methods (TLA+-style specs)\nand randomized fault-injection testing, because partial-failure bugs hide\nfrom ordinary tests." },
  { id: 46, section: "Consistency and Consensus", chapter: 10,
    question: "Linearizability in one sentence — and its price?",
    answer: "The system behaves as if there's one copy of the data and every\noperation takes effect atomically at a point in real time — once anyone\nreads the new value, everyone does. Price: coordination on every operation —\nlatency, throughput limits, and unavailability for the minority side of a\npartition. Buy it only where invariants demand recency." },
  { id: 47, section: "Consistency and Consensus", chapter: 10,
    question: "What actually *needs* linearizability?",
    answer: "The short list: locks and leases (two holders = disaster), uniqueness\nconstraints (one winner per username), and anything where acting on stale\nstate breaks an invariant. Most reads don't — session guarantees or plain\neventual consistency serve them — which is why the design move is an\n*inventory*, not a global setting." },
  { id: 48, section: "Consistency and Consensus", chapter: 10,
    question: "Logical clocks and ID generators — what problem do they solve (2e framing)?",
    answer: "Ordering events without trusting wall clocks: Lamport-style logical\nclocks give a total order consistent with causality (without detecting\nconcurrency), and ID generators (snowflakes and friends) trade between\nordering guarantees, coordination cost, and throughput — a linearizable ID\ngenerator is exactly as hard as the consistency it promises." },
  { id: 49, section: "Consistency and Consensus", chapter: 10,
    question: "Why is consensus \"many problems in one\" — and where does it run in practice?",
    answer: "Agreeing on one value, electing one leader, ordering a replicated log\n(total order broadcast), and committing atomically are equivalent\nproblems — solve one, you've solved the others. In practice consensus is\nconcentrated into a small control plane: replicated-log protocols (Raft and\nkin) inside databases and brokers, and coordination services\n(ZooKeeper/etcd) that export it as locks, leases, elections, and metadata." },
  { id: 50, section: "Consistency and Consensus", chapter: 10,
    question: "Why not make everything linearizable / run everything through consensus?",
    answer: "Because you'd pay cross-node round-trips on every operation, cap throughput\nat the ordering group, and go unavailable in partitions — for a guarantee\nmost flows don't need. Mature architecture: a tiny coordinated kernel\n(elections, uniqueness, leases), and everything else deliberately,\nexplicitly weaker." },
  { id: 51, section: "Batch Processing", chapter: 11,
    question: "What's the batch-processing philosophy that everything else inherits?",
    answer: "Immutable inputs, deterministic jobs, explicit outputs (the Unix\npipeline ethos at datacenter scale): any task can be re-run anywhere with\nidentical results, so fault tolerance is retry-and-recompute — and *human*\nfault tolerance comes free: fix the bug, re-run on the untouched input." },
  { id: 52, section: "Batch Processing", chapter: 11,
    question: "MapReduce vs modern dataflow engines — the essential difference?",
    answer: "MapReduce fully materializes every stage to replicated storage (durable\ncheckpoints, slow I/O, dead time between jobs); dataflow engines (Spark,\nFlink lineage) model the whole pipeline as one operator DAG and stream\nbetween operators — much faster, but they owe their own recovery story\n(lineage recompute or checkpoints)." },
  { id: 53, section: "Batch Processing", chapter: 11,
    question: "Where does the cost (and the pain) live in distributed batch jobs?",
    answer: "In the shuffle — repartitioning data by key across the network for joins\nand grouping. Join strategy is \"what do I know about my inputs\" (broadcast a\nsmall side, merge pre-partitioned sides, otherwise full shuffle), and\nskew — one hot key — stalls everything, because parallelism can't divide\nan indivisible key." },
  { id: 54, section: "Batch Processing", chapter: 11,
    question: "What are batch jobs *for*, in the derived-data worldview?",
    answer: "Building derived data: ETL into warehouses, analytics, ML training\nsets/features, and precomputed serving stores (search indexes,\nrecommendations) — written as fresh immutable outputs and swapped in, not\nmutated in place. Batch is the rebuild arm of the\nsource-of-truth/derived-data architecture from chapter 1." },
  { id: 55, section: "Stream Processing", chapter: 12,
    question: "Log-based brokers vs traditional message queues — the defining difference?",
    answer: "A queue treats messages as tasks: deliver to one worker, delete on ack.\nA log treats them as events — append-only, retained; consumers are just\noffsets, so you get per-partition ordering, many independent readers of the\nsame stream, and replay — the property that makes derived views\nrebuildable. History with value → log; disposable jobs → queue." },
  { id: 56, section: "Stream Processing", chapter: 12,
    question: "Keeping several systems in sync — why do dual writes fail, and what's the fix?",
    answer: "App-writes-to-each-system has no shared order (concurrent updates apply in\ndifferent orders → permanent silent divergence) and no atomicity (crash\nbetween writes). Fix: one system of record, with change data capture\npublishing its commit log so every other system applies *the same changes in\nthe same order*." },
  { id: 57, section: "Stream Processing", chapter: 12,
    question: "\"State is a cache of the log\" — unpack the slogan.",
    answer: "A table is what you get by folding a changelog; a changelog is how the table\ngot there (stream-table duality). Keep the log and every state —\ncaches, indexes, aggregates, processor state — becomes disposable and\nrebuildable by replay. This immutability principle is the load-bearing beam\nunder CDC, event sourcing, and chapter 13's architecture." },
  { id: 58, section: "Stream Processing", chapter: 12,
    question: "Event time vs processing time — and what's a watermark?",
    answer: "Event time = when it happened; processing time = when your pipeline saw it.\nWindowing by processing time records *your pipeline's hiccups as user\nbehavior*. Event-time windows need a watermark — a calibrated bet that\n\"all events ≤ T have arrived\" — to know when to close, plus an explicit\npolicy for stragglers that arrive after it (drop / correct / sideline)." },
  { id: 59, section: "Stream Processing", chapter: 12,
    question: "What does \"exactly-once\" honestly mean in stream processing?",
    answer: "Effectively-once effects, not single delivery: duplicates are physics\n(retries), so they're neutralized at boundaries — idempotent writes,\natomic output+offset commits — and the guarantee always has a *scope*; the\nmoment results leave for an external system, that system needs its own\nidempotency." },
  { id: 60, section: "A Philosophy of Streaming Systems", chapter: 13,
    question: "The chapter's thesis: how do you integrate many specialized systems without chaos?",
    answer: "Derive, don't dual-write: pick systems of record, flow their changes\nthrough ordered logs, and treat every other store (search, cache, warehouse,\nML features) as a derived view — rebuildable by replay, updated\nasynchronously, loosely coupled. Batch and stream are the two arms of the\nsame derivation." },
  { id: 61, section: "A Philosophy of Streaming Systems", chapter: 13,
    question: "\"Unbundling the database\" — the idea in two sentences?",
    answer: "A database is internally a log keeping storage, indexes, and views in\nlockstep; an organization's systems are those same components scattered\nacross products, missing the lockstep. Unbundling restores it: an ordered\nchange log as the org's WAL, specialized systems as its indexes — composing\nbest-of-breed tools into one coherent \"database\" at architecture scale." },
  { id: 62, section: "A Philosophy of Streaming Systems", chapter: 13,
    question: "The end-to-end argument — why do reliable components not add up to reliable operations?",
    answer: "Each layer's guarantee is scoped to itself (TCP per connection, broker per\nmessage, DB per transaction), but faults like duplicates can be *born above\nall of them* — a user's retry is two legitimate requests. Correctness\nfunctions like exactly-once must be implemented at the endpoints: an\noperation ID minted at the moment of intent, enforced at the final write.\nLower layers optimize; ends own correctness." },
  { id: 63, section: "A Philosophy of Streaming Systems", chapter: 13,
    question: "Timeliness vs integrity — the decomposition that changes designs?",
    answer: "Timeliness (readers see fresh state) violations heal by waiting;\nintegrity (nothing lost, double-counted, or inconsistent with sources)\nviolations are permanent until repaired. Products tolerate lots of the\nfirst and none of the second — so spend coordination on integrity, relax\ntimeliness deliberately, and verify (\"trust, but verify\": audit derived\nstate against sources, because silent corruption happens)." },
  { id: 64, section: "Doing the Right Thing", chapter: 14,
    question: "What's the core warning about predictive analytics?",
    answer: "Models trained on biased history launder bias into objective-looking\noutputs, and feedback loops amplify (deny credit → thinner file → deny\ncredit). \"The algorithm decided\" is a responsibility smell — humans chose\nthe data, the objective, and the threshold, and accountability has to live\nwith them." },
  { id: 65, section: "Doing the Right Thing", chapter: 14,
    question: "How should an engineer think about collected data?",
    answer: "As liability as much as asset: replay-everything architectures spread\npersonal data into logs, views, and backups; consent decays as data is\njoined and repurposed; breaches and acquisitions inherit everything. The\nonly privacy mechanism that survives every future is collecting less —\nand deletion/retention must be designed as data flows, not bolted on." },
  { id: 66, section: "Doing the Right Thing", chapter: 14,
    question: "Why does the book end with regulation and responsibility rather than technology?",
    answer: "Because the systems this book teaches concentrate power over people, and\nhistory (the chapter invokes the Industrial Revolution) says industries\ndon't self-correct externalities without norms and law — GDPR-style\nlegislation made deletion, purpose limitation, and minimization *engineering\nrequirements*. Treating \"doing the right thing\" as part of the design space\nis the closing thesis.\n*Coverage drill: close the file and try to reconstruct the book's spine from\nmemory — trade-offs → requirements → models → storage → encoding →\nreplication → sharding → transactions → trouble → consensus → batch →\nstreams → philosophy → ethics. If you can narrate one main idea per chapter\nin two minutes, you have the whole book at interview-recall depth.*" },
];

/* ─── Chapter metadata ─── */
const CHAPTERS = [
  { id: 1, label: "Ch. 1", full: "Trade-Offs in Data Systems Architecture", count: 5 },
  { id: 2, label: "Ch. 2", full: "Defining Nonfunctional Requirements", count: 4 },
  { id: 3, label: "Ch. 3", full: "Data Models and Query Languages", count: 5 },
  { id: 4, label: "Ch. 4", full: "Storage and Retrieval", count: 5 },
  { id: 5, label: "Ch. 5", full: "Encoding and Evolution", count: 4 },
  { id: 6, label: "Ch. 6", full: "Replication", count: 6 },
  { id: 7, label: "Ch. 7", full: "Sharding", count: 5 },
  { id: 8, label: "Ch. 8", full: "Transactions", count: 6 },
  { id: 9, label: "Ch. 9", full: "The Trouble with Distributed Systems", count: 5 },
  { id: 10, label: "Ch. 10", full: "Consistency and Consensus", count: 5 },
  { id: 11, label: "Ch. 11", full: "Batch Processing", count: 4 },
  { id: 12, label: "Ch. 12", full: "Stream Processing", count: 5 },
  { id: 13, label: "Ch. 13", full: "A Philosophy of Streaming Systems", count: 4 },
  { id: 14, label: "Ch. 14", full: "Doing the Right Thing", count: 3 },
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

export default function InterviewHighLevelPage() {
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set(CHAPTERS.map(c => c.id)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [progress, setProgress] = useState<Record<string, 'correct' | 'wrong' | undefined>>({});

  /* Filtered + optionally shuffled deck */
  const deck = useMemo(() => {
    const filtered = flashcards.filter(c => selectedChapters.has(c.chapter));
    if (shuffled) return shuffleArray(filtered);
    return filtered;
  }, [selectedChapters, shuffled]);

  const card = deck[index];
  const total = deck.length;

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setFlipped(false);
  }, [total]);

  const toggleChapter = useCallback((id: number) => {
    setSelectedChapters(prev => {
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
          <p className="text-lg">Select at least one chapter to begin.</p>
        </div>
      </DDIAThemeProvider>
    );
  }

  return (
    <DDIAThemeProvider>
      <div className="min-h-screen flex flex-col items-center px-4 pt-24 md:pt-32 pb-12 md:pb-16">
        {/* ═══════ Header ═══════ */}
        <div className="w-full max-w-4xl mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#f2fafc] bg-gradient-to-r from-[#f2fafc] to-[#f2fafc]/60 bg-clip-text text-transparent">
                DDIA 2e — Main Ideas
              </h1>
              <p className="text-sm text-[#8aa6b0] mt-2 font-mono">
                {total} cards active &middot; {gradedCount} graded
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/interview"
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc] transition-all"
              >
                Detailed Deck
              </a>
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

          {/* ═══════ Chapter Filters ═══════ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {CHAPTERS.map(chapter => {
              const active = selectedChapters.has(chapter.id);
              return (
                <button
                  key={chapter.id}
                  onClick={() => toggleChapter(chapter.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "bg-[#0c1a10] border-[#2a4651] text-[#f2fafc]"
                      : "bg-transparent border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651]"
                  }`}
                >
                  <span className="font-mono text-xs mr-1.5 opacity-60">{chapter.label}</span>
                  {chapter.full}
                  <span className="font-mono text-xs ml-1.5 opacity-60">{chapter.count}</span>
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
                    Ch. {card.chapter} — {card.section}
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
                    Ch. {card.chapter} — {card.section}
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
