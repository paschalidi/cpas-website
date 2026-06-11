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
  { id: 1, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Why do we report p95/p99 latency instead of the average?",
    answer: "Because the average hides exactly the users who are suffering. Latency\ndistributions are heavily skewed: most requests are fast, a few are very slow\n(GC pauses, page faults, queueing, a cold cache), and the mean gets dragged\naround by neither group informatively. Worse, modern pages fan out: one\nuser action touches dozens of backend calls, so the probability of hitting at\nleast one slow call approaches certainty — the service's p99 becomes the\n*user's typical experience*. This is tail latency amplification. So SLOs\nare written against percentiles (p95/p99/p999), capacity planning targets the\ntail, and tail-tolerant techniques exist specifically for it: hedged requests,\nrequest replication to the fastest replica, and tied requests." },
  { id: 2, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Design question: push vs pull for a social feed (the fan-out problem)?",
    answer: "The question is *when* you pay the join between \"people I follow\" and \"their\nposts\". Push (fan-out on write): when someone posts, insert it into every\nfollower's precomputed timeline — reads are a cheap single lookup; writes cost\nO(followers), which is catastrophic for a 50M-follower account (one post = 50M\ninserts). Pull (fan-out on read): store posts once; build the timeline at\nread time by querying everyone you follow — writes are O(1), reads are\nexpensive and hit hot accounts constantly. The staff answer is the hybrid:\npush for ordinary users (bounded follower counts), but flag celebrity accounts\nand merge their posts in at read time. This is a general pattern: precompute\nfor the common case, special-case the power law's head, and accept that the\nboundary needs tuning and monitoring." },
  { id: 3, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "B-tree vs LSM-tree: core trade-off?",
    answer: "Two philosophies of \"where do writes go\". B-trees update fixed-size pages\nin place: reads are predictable (one tree descent), each key lives in\nexactly one place (easier transactional locking), and decades of tuning back\nthem — but random writes mean random I/O, and every page touch may rewrite a\nwhole page. LSM-trees never update in place: writes land in an in-memory\nmemtable, get flushed as sorted immutable files (SSTables), and\nbackground compaction merges files and discards overwritten values.\nSequential writes give much higher write throughput and better compression\n(no half-empty pages) — but reads may consult several files, and compaction\ncompetes with live traffic for disk bandwidth, causing latency spikes when\nmis-tuned (or, worse, falling behind until disk fills). Rule of thumb:\nwrite-heavy / append-mostly → LSM (Cassandra, RocksDB); read-heavy with strong\ntransactional needs → B-tree (Postgres, MySQL/InnoDB). Measure on *your*\nworkload — the crossover is real but workload-dependent." },
  { id: 4, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "What is write amplification and why does a staff engineer care?",
    answer: "One logical write becoming multiple physical writes. B-trees: changing one row\nrewrites its whole page (and possibly parents on splits) plus the WAL.\nLSM-trees: the same value is rewritten every time compaction moves it down a\nlevel — easily 10–30× over its lifetime. Why care: physical write bandwidth is\na hard resource, so amplification is often the *hidden ceiling* on sustained\nwrite throughput — the reason \"the disk is at 100% but we're only doing 5k\nwrites/sec\" — and on SSDs it directly burns device endurance. It's also a\ntuning lever: LSM compaction strategy choices (card 9) trade write\namplification against read amplification and space amplification. When someone\nproposes \"just log everything\", this is the number to ask about." },
  { id: 5, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Every index you add does what to your write path?",
    answer: "Slows it, permanently. Each write must now also update every index — more\nstructures, more pages or SSTable entries, more write amplification, more lock\nor latch work. Indexes also consume cache/RAM that data pages wanted.\nThe framing that lands in interviews: an index is a read optimization\npurchased with write cost and storage, i.e. a derived data structure the\ndatabase maintains synchronously. So: derive them from real query patterns\n(not speculation), audit and drop unused ones like dead code, and on\nwrite-hot tables treat each additional index as a capacity decision. The same\nlogic, scaled out, becomes chapter 12's \"derived views\" — a search index is\njust this trade-off made asynchronous and distributed." },
  { id: 6, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Normalize or denormalize at scale?",
    answer: "Normalize to keep each fact in one place: updates are cheap and can't\nmiss a copy; joins reconstruct what you need. Denormalize to co-locate\ndata with its reads: fewer joins, fewer round-trips, better cache behavior —\nat the price of duplicated facts that must be updated everywhere, every time.\nThe staff insight is that at scale this stops being a schema debate and\nbecomes a derived-data pipeline problem: you usually keep a normalized\nsource of truth *and* denormalized read-optimized copies (caches,\nmaterialized views, search documents), and the real engineering is keeping\nthe copies in sync — which is exactly the dual-writes/CDC territory of cards\n94–96. Denormalization without a sync strategy is how data quietly forks." },
  { id: 7, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "\"Schemaless\" databases — what actually happened to the schema?",
    answer: "It didn't disappear; it moved, unenforced, into every reader. This is\nschema-on-read: the database stores whatever shape arrives, and each\nconsumer carries implicit assumptions about field names, types, and presence.\nValidation failures shift from explicit write-time errors to runtime\nsurprises in consumers — often months later, in a different team's code.\nThat's a legitimate trade for genuinely heterogeneous or rapidly evolving\ndata (it's also how data lakes work, card 91's cousin), but it must be chosen\nknowingly: pair it with validation at boundaries, versioned event/document\nschemas, and tolerant readers. \"Schemaless\" is best pronounced \"schema moved\nto the readers\"." },
  { id: 8, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Walk the read path of an LSM-tree. What keeps it from being slow?",
    answer: "A key might be in the memtable, or any SSTable, so the read checks newest to\noldest: memtable → most recent SSTable → older ones, returning the first\nhit (newest value wins; deletes are tombstone markers found the same way).\nUnbounded, that's many file probes per read — so three mechanisms bound it:\nBloom filters per SSTable (a tiny probabilistic \"definitely not here /\nmaybe here\" check that skips most files with ~1% false positives), sparse\nin-file indexes (SSTables are sorted, so a small index plus binary search\nfinds the block), and compaction (merging files keeps the count of places\nto look small). Staff-level connection: a read-heavy workload on an LSM store\nlives or dies by Bloom-filter memory and compaction keeping up — \"reads got\nslow\" is often \"compaction fell behind\"." },
  { id: 9, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Size-tiered vs leveled compaction — what's being traded?",
    answer: "Compaction strategy decides *when* overlapping SSTables get merged, trading\nthe three amplifications against each other. Size-tiered: collect several\nsimilar-sized SSTables, merge into a bigger one. Cheap on writes (each value\nis rewritten few times) but reads may consult many overlapping files and disk\nusage spikes during merges (space amplification) — good for write-heavy,\nread-tolerant workloads. Leveled: organize into levels of\nnon-overlapping, fixed-size runs; a key lives in at most one SSTable per\nlevel. Reads check few files (low read amplification) and space overhead is\nsmall, but values are rewritten at every level — high write amplification —\ngood for read-heavy workloads. The interview move is naming the triangle:\nwrite amp vs read amp vs space amp; compaction strategy picks your corner." },
  { id: 10, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "Why does column-oriented storage dominate analytics?",
    answer: "Analytical queries read few columns of very many rows (\"sum revenue by\nregion for 2 years\"), while row stores fetch entire wide rows to use two\nfields. Storing each column contiguously means: only the needed columns are\nread from disk; values within a column are self-similar, so compression is\ndramatic (run-length, dictionary, bitmap encodings); and CPUs chew through\ncompressed columnar blocks with vectorized execution. Writes get harder —\nupdating one \"row\" touches many column files — which is why column stores\ningest in batches/buffered loads (often LSM-style) rather than OLTP-style\nupdates. One sentence to carry: *row stores optimize for retrieving an\nentity; column stores optimize for scanning an attribute.*" },
  { id: 11, section: "Foundations & storage engines (DDIA ch. 1–3)", sectionShort: "A",
    question: "OLTP vs OLAP — and why do they end up as separate systems?",
    answer: "OLTP: many small, low-latency, index-driven reads/writes of individual\nrecords — the application's live state, availability-critical. OLAP: few\nhuge scan-and-aggregate queries over history, run by analysts and pipelines.\nThey conflict on every axis — access pattern (point vs scan), storage layout\n(row vs column, card 10), tuning, and blast radius: one analyst's\ntable-scan can flatten the latency of checkout. Hence the data warehouse:\na separate analytical store fed by ETL/ELT or CDC from production systems,\nmodeled for scans (star schemas: fact table + dimension tables). The staff\nfollow-up to anticipate: *how* it's fed and how fresh it is — nightly batch vs\nstreaming CDC — which is exactly the chapter 11 material (cards 94–95)." },
  { id: 12, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "Define backward and forward compatibility, and explain why a rolling upgrade needs both.",
    answer: "Backward: new code can read data written by old code. Forward: old\ncode can read data written by new code. You need both because of two facts.\nFirst, deploys roll: during any upgrade, versions N and N+1 run\n*simultaneously*, and each is sometimes writer and sometimes reader — via\ndatabase rows, RPC responses, and queued messages. Second, data outlives\ncode: rows written five years ago are still read today, so backward\ncompatibility is effectively forever, and old code lingers (mobile clients\nupdate on the user's schedule, sometimes never), so forward compatibility\nlasts years too. The practical corollary: every schema change must be safe in\n*both* directions on the day it ships, not after the fleet converges —\nbecause the fleet never fully converges." },
  { id: 13, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "How does an old Protobuf reader survive a field it has never seen?",
    answer: "Every encoded field starts with a tag byte combining the field number and\na wire type. The old reader doesn't recognize the number, but the wire\ntype tells it mechanically how to skip: varint → read until the\nterminator bit; length-delimited → read the length, jump that many bytes. So\nparsing continues unharmed — that skip rule *is* forward compatibility in\ntagged formats. One subtlety worth saying out loud: a well-behaved\nimplementation preserves unknown fields when it re-serializes, otherwise\nan old service doing read-modify-write silently erases data that newer code\nwrote (a real production bug class, especially with ORMs that map rows to\nfixed structs)." },
  { id: 14, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "Why is reusing a retired Protobuf field number catastrophic, and what's the safeguard?",
    answer: "The field number is the wire contract — names never appear in the bytes.\nHistorical data where tag 3 meant `team: string` still exists in databases,\nqueues, backups, and on devices. If a new schema reuses tag 3 as\n`score: int32`, every old record decodes those string bytes as an integer:\nsilent garbage, no exception, possibly persisted onward and spread by\npipelines. \"Silent\" is the operative horror — fresh test data never triggers\nit. Safeguard: when deleting a field, declare `reserved 3;` (and reserve the\nname) so the compiler rejects any future reuse; same logic behind \"never\nchange a field's type\" and why proto3 removed `required` (a new required\nfield makes all historical data unreadable — a backward-compat landmine)." },
  { id: 15, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "Why do APIs ship 64-bit IDs as strings in JSON?",
    answer: "JSON has one number type, and JavaScript backs it with an IEEE-754 double:\nintegers are exact only up to 2⁵³ − 1 (9,007,199,254,740,991).\nSnowflake-style 64-bit IDs exceed that, so an ID round-tripped through a JS\nclient can come back silently off by a few — the client then references a\n*different entity*, which is a corruption bug, not a display bug. Hence the\nindustry convention: serialize large integers as strings (or send both\n`id` and `id_str`). General lesson for the interview: textual formats have\nquietly lossy type systems (no int/float distinction, no binary without\nBase64), and these gaps cause real incidents, not just inefficiency." },
  { id: 16, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "What does a schema registry actually enforce, and when?",
    answer: "Two jobs. Delivery: stream messages are tiny, so embedding a schema per\nmessage is absurd — instead each message carries a small schema ID;\nproducers register schemas and get IDs; consumers fetch-and-cache the\nwriter's schema by ID and resolve it against their own. Enforcement: the\nregistry is configured with a compatibility mode per subject (backward,\nforward, full) and rejects an incompatible schema at registration time —\nturning what would be a 3 a.m. consumer crash (or worse, silent\nmisparsing) into a failed CI step for the producer team. That shift-left is\nthe strategic point: compatibility becomes a property *checked by\ninfrastructure at publish time*, not a hope distributed across consumer\nteams." },
  { id: 17, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "Avro matches fields by name; Protobuf by number. What does each buy you?",
    answer: "Numbers (Protobuf/Thrift): the wire stays tiny and stable, names are free\nto change — but humans must allocate field numbers and guard them forever\n(card 14). Perfect for hand-maintained service contracts. Names (Avro):\nno tags on the wire at all — just values in schema order — so decoding\nrequires the writer's schema, which the reader *resolves* against its own\nreader schema: fields matched by name, writer-only fields skipped,\nreader-only fields filled from declared defaults (no default ⇒ that's\nprecisely an incompatible change). The payoff: with no number bookkeeping,\nschemas can be machine-generated — e.g. from a database table's columns\non every export — making Avro the natural format for data pipelines that\ndump evolving relational data. The cost: renames break compatibility unless\naliased, and the writer's schema must travel (file header for big files,\nregistry ID for streams)." },
  { id: 18, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "Name the three dataflow modes data passes through, and where compatibility bites in each.",
    answer: "Through databases: the writer is your past, the reader your future. Old\nrows aren't rewritten when columns are added — reads fill defaults — and the\ntrap is old code doing read-modify-write and dropping fields it doesn't know.\nData here outlives code by *years*, the longest compatibility horizon.\nThrough services (REST/RPC): servers usually deploy before clients — and\nmobile clients lag for years — so servers need forward-compatible request\nparsing and clients need backward-compatible response parsing.\nThrough async messages: a queue is a time capsule — messages written\nbefore a deploy are consumed after it, and dead-letter replays resurrect the\ntruly ancient; consumers effectively face an archive, not a peer. That's why\nschema registries with enforced compatibility matter most exactly here.\nInterview framing: *every boundary where bytes outlive or outrun code is an\nevolution boundary.*" },
  { id: 19, section: "Encoding & schema evolution (DDIA ch. 4)", sectionShort: "B",
    question: "RPC looks like a local function call. Why is that abstraction dangerous, and what do modern frameworks do about it?",
    answer: "A local call either returns or throws, takes predictable time, and passes\nreferences. A network call can time out with unknown outcome (the request\nmay have executed — chapter 8's ambiguity), duplicate on retry, reorder,\nand must serialize everything. Pretending these away is how systems end up\nwith double-charges and hangs. Modern RPC (gRPC on Protobuf) keeps the\nconvenient syntax but surfaces the network: explicit deadlines propagated\nthrough call chains, cancellation, streaming, and retry policies you must\nconfigure — plus schema-driven evolution so old and new clients coexist\n(cards 13–14). The staff answer treats RPC as \"a convenient codec + transport\nwith the network's failure modes intact\", and designs idempotency and\ntimeouts as part of the API, not an afterthought." },
  { id: 20, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What is semi-synchronous replication and why is it the standard compromise?",
    answer: "Fully synchronous replication (leader waits for *every* follower) means any\none follower being slow or dead blocks all writes — availability hostage to\nthe weakest node. Fully asynchronous means an acknowledged write may exist\nonly on the leader — durability hostage to one disk. Semi-synchronous:\nexactly one follower is synchronous (the leader waits for its ack before\nconfirming), the rest are async. Every acknowledged write is guaranteed on\n≥2 nodes; if the sync follower slows, *swap which follower is sync* rather\nthan stopping the world. PostgreSQL exposes this directly via\n`synchronous_commit` and `synchronous_standby_names` — even per-transaction,\nso you can pay the sync tax only for writes that deserve it." },
  { id: 21, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What can be lost in an async-replication failover, and why is \"discard the divergent writes\" more radical than it sounds?",
    answer: "The promoted follower may lack writes the old leader acknowledged —\nclients were told \"committed\". Common practice discards the old leader's\ndivergent tail so it can rejoin as a follower. That quietly *revokes\ndurability*: if anything external consumed those writes — an email sent, a\ncache warmed, an ID handed out, another system's counter — the outside world\nnow permanently disagrees with the database. GitHub's October 2018 incident\nis the canonical case study: a ~43-second network partition led to writes on\ntwo sides that could not be trivially reconciled, and a day of degraded\nservice while data was repaired. Staff takeaways: monitor what your sync\nguarantee actually is; reconciliation of acked-but-lost writes is an\n*application-level* problem; and cross-system invariants need end-to-end IDs\n(card 106), not faith in failover." },
  { id: 22, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What is split brain, and what actually prevents it?",
    answer: "Two nodes simultaneously believing they're the leader and accepting writes —\ntypically after a partition or a botched failover — producing divergent,\npossibly unmergeable histories. Prevention is never \"the old leader will\nnotice\": a partitioned or paused node *can't* notice (card 67). Real\ndefenses: epochs/terms (each election increments a number; replicas and\nstorage reject messages from older epochs), quorum-based election (a new\nleader requires a majority, and majorities overlap, so the old leader can no\nlonger assemble one), and fencing at shared resources (card 68). Some\nstacks add STONITH (\"shoot the other node in the head\") as a blunt backstop.\nThe principle: leadership must be *enforced where the writes land*, not\nbelieved where the leader runs." },
  { id: 23, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Why is the failover timeout a trap in both directions?",
    answer: "Failure detection is just a timeout (card 62), so you're tuning a guess. Too\nshort: a load spike, GC pause, or transient network blip looks like leader\ndeath → spurious failover → cold caches, client reconnections, possible\nlost-write reconciliation — *additional load and risk precisely when the\nsystem is already stressed*, sometimes cascading into failover ping-pong. Too\nlong: real outages extend by your timeout. There is no correct constant —\nonly a trade-off tuned to your failure modes — which is why many mature\noperations keep a human approving failover, automate everything *around* the\ndecision (detection, runbooks, traffic shift), and rate-limit automatic\nfailovers. Saying \"I'd make failover automatic and fast\" without this caveat\nis a classic mid-level tell." },
  { id: 24, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "A user posts a comment, reloads, and it's gone. Name the anomaly and the standard fixes.",
    answer: "Read-your-writes (read-after-write) violation: the write went to the\nleader; the immediate read was load-balanced to a follower still behind by\nthe replication lag. To the author it looks like data loss — far worse than\ngeneric staleness. Fixes, cheapest first: route reads of *content the user\ncan edit* (own profile, own comments) to the leader; or track each user's\nlast-write position (log sequence number) and serve them only from replicas\nthat have applied past it, waiting or falling through to the leader\notherwise; or sticky-route the user's session to one sufficiently fresh\nreplica. Note the scope: this is a session guarantee — a per-user\npromise, vastly cheaper than global consistency, and usually all the product\nneeds." },
  { id: 25, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Why does read-your-writes get harder across devices, and what's the fix?",
    answer: "The user posts on their phone and immediately checks on their laptop. Any\nper-connection trick — sticky sessions, a client-remembered timestamp — fails\nbecause the second device shares none of that state, and with multi-DC\nrouting the two devices may not even hit the same datacenter. The fix is to\nmake the tracking server-side and user-centric: on each write, record the\nuser's last-write position centrally; on each read from *any* device, pick a\nreplica caught up past it (or wait/leader-read). Plus routing discipline:\npin the user (not the device) to a home region so the metadata and data\nconverge somewhere. The deeper lesson generalizes: session guarantees are\nper-*user* promises, so the state that implements them must live where all\nthe user's sessions can see it." },
  { id: 26, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "A live scoreboard shows 1–0, then 0–0 on refresh. Anomaly and fix?",
    answer: "Monotonic reads violation. Successive reads were load-balanced to\nreplicas with *different* lag — the second one further behind — so the user\nmoved backwards in time; a goal \"un-happened\". This is more disorienting\nthan uniform staleness, and it breaks client logic that assumes state only\nadvances. The standard fix is one line of routing: make each user's reads\nsticky — `hash(user_id) → replica` — so every user rides a single\ntimeline that may pause but never rewinds. Mind the failover edge: if the\npinned replica dies, its replacement must be at least as fresh, or you carry\na read-position token to enforce monotonicity explicitly. Weaker than\nlinearizability, stronger than plain eventual consistency — and almost free." },
  { id: 27, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "In a sharded chat, an observer sees the answer before the question. Anomaly and fix?",
    answer: "Consistent-prefix violation. The question went to partition 1, the reply\nto partition 2; each partition replicates at its own pace, and the reply's\npartition synced to the observer's region first — so causality appears\ninverted (effect before cause). Single-partition systems get prefix ordering\nfor free from the shared log; sharding removes the shared log and the free\nordering with it. Fixes: write causally related events to the same\npartition (one conversation → one shard — usually the right modeling\nanyway, and it restores per-conversation order, card 44); or carry explicit\ncausal dependencies (\"this reply depends on message 17\") and have readers\ndelay display until dependencies arrive. Full causal consistency machinery\nexists (cards 84), but the partition key is the 90% fix." },
  { id: 28, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "When is multi-leader replication actually justified, and what's the bill?",
    answer: "Justified when writes must succeed *locally* despite WAN distance or\ndisconnection: multi-region apps (cross-ocean write latency is physics;\na region must survive losing its peers), offline-first clients (a phone's\nlocal DB is a leader that syncs later), and collaborative editing (every\ncursor is a writer). The bill: the same record can now legally be written in\ntwo places concurrently, so you owe a convergence story (card 29) for\nevery write path, plus operational complexity (replication topologies,\nconflict monitoring). Netflix's active-active architecture is the canonical\nfield report — note how heavily it leans on routing users to a home region\nand tolerating eventual consistency, i.e. *designing conflicts out* rather\nthan merging them heroically." },
  { id: 29, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Two datacenters concurrently rename the same record. Walk the three honest resolutions.",
    answer: "There's no shared queue, so neither write is \"later\" — they're concurrent,\nand you must choose: (1) Last-write-wins: attach timestamps, keep the\nmax, everywhere. Converges, but silently destroys an acknowledged write, and\nthe clocks deciding \"last\" skew (card 30). Fine for caches and telemetry;\nnegligent for data you promised to keep. (2) Keep both + merge: detect\nconcurrency with version vectors (card 31), store conflicting values as\n*siblings*, and have application code or the user merge. Lossless and\nhonest; someone must write and maintain merge logic (CRDTs, when the data\ntype fits, make the merge automatic and provably convergent —\n[crdt.tech](https://crdt.tech/)). (3) Avoid: route all writes for a given\nrecord to one *home* leader — per-record single-leader; conflicts only\nresurface on re-homing. Whatever you choose must be deterministic and\nidentical at every replica, or replicas diverge forever." },
  { id: 30, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Why is last-write-wins dangerous beyond \"you lose a write\"?",
    answer: "Three compounding reasons. The loss is silent — no error, no log entry,\nno metric; the discarded value simply ceases to exist, so you can't even\naudit how often it happens. The ordering is a lie: \"last\" is decided by\ntimestamps from clocks that skew (card 65), so the surviving write may\nactually be the older one — LWW doesn't even reliably implement its own\nsemantics. And it converts *acknowledged* writes into casualties: the client\nwas told \"OK\". Acceptable when the data is overwrite-by-nature (latest\nsensor reading, cache entries); for user data, the interview-grade answer is\nversion vectors + explicit merge, or conflict avoidance — and if you must use\nLWW, generate timestamps in one place (the storage node, not clients) to at\nleast bound the damage." },
  { id: 31, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What question do version vectors answer that timestamps and plain version numbers can't?",
    answer: "Whether two writes are causally ordered or concurrent — which is the\nonly fact that tells you if an overwrite is safe. Mechanism: one counter per\nwriter (replica/leader); each write increments its own slot and carries the\nvector. Compare two vectors: if A ≥ B in every slot, B *happened-before* A —\noverwriting B is safe, no information lost. If each wins somewhere\n({EU:4,US:7} vs {EU:3,US:8}), they're concurrent — keep both as siblings\nfor merging. A single timestamp or counter collapses many timelines into one\nnumber and thus *guesses*; a vector makes causality computable. This is also\nthe honest answer to \"how does Dynamo/Riak know to keep siblings\" and the\nfoundation under card 29's option 2." },
  { id: 32, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What does w + r > n actually guarantee — and what doesn't it?",
    answer: "Setup: leaderless replication, n replicas, writes succeed on w acks, reads\nquery r nodes and keep the newest version. If w + r > n, any read quorum\n*overlaps* any successful write quorum in ≥1 node — so every read sees at\nleast one copy of the latest fully-acknowledged write (version numbers pick\nit). That's the guarantee: overlap. Not guaranteed: linearizability\n(concurrent and partially-failed writes interleave so that one client sees\nnew data and a *later* client sees old — card 75's definition fails), and\nbounded staleness (sloppy quorums, card 33, and writes that died at 1 of\n2 acks leak staleness past the math — note there's no rollback: \"failed\"\nwrites linger on whichever replicas took them). The phrase that lands:\n*quorums give overlap, not ordering.*" },
  { id: 33, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What is a sloppy quorum with hinted handoff, and what does it cost?",
    answer: "During a partition, a client may reach w nodes — just not the *home* nodes\nfor the key. A sloppy quorum accepts the write on substitute nodes, each\nstoring a hint: \"this belongs to node C; deliver when it's back.\" You\nrescue write availability and durability (the bytes live on w disks\nsomewhere). The cost: w acks no longer guarantee overlap with the home set,\nso a read quorum against the proper replicas can miss the write entirely\nuntil handoff completes — the w+r>n math silently stops applying. It's\n\"durable now, consistent later\". Dynamo-family systems make this a\nper-operation choice; the staff answer is knowing it's *on by default* in\nsome systems and saying which of your reads can tolerate the gap." },
  { id: 34, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Read repair vs anti-entropy — why do you need both?",
    answer: "Two healing mechanisms for leaderless systems (where there's no leader log\nto replay). Read repair: a quorum read that observes a stale replica\nwrites the newest value back to it — free, immediate, but only touches keys\nthat *get read*. Anti-entropy: a background process compares replicas —\nMerkle trees make \"what differs?\" cheap by comparing hash trees instead\nof all data — and syncs differences, covering keys nobody reads. Read repair\nalone means \"node was down an hour\" becomes \"rarely-read keys are wrong for\nmonths, discovered during an audit\"; anti-entropy alone heals hot keys too\nslowly. Together: hot path self-heals instantly, cold data converges in the\nbackground. Monitoring hook: anti-entropy backlog is a real health metric." },
  { id: 35, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Replication lag jumps from 50 ms to 4 minutes. What breaks first, and what do you do?",
    answer: "Order of breakage: read-your-writes (users' fresh actions vanish on\nreload — support tickets begin), then monotonic reads (load balancing\nacross unevenly lagged replicas makes state flap), then any business logic\nthat read replicas assuming freshness — fraud checks, inventory displays,\n\"did they already pay?\" lookups. Response, in order: shift critical-path\nreads to the leader (mind its capacity); enforce a max-lag threshold that\nejects replicas from the read pool (serving fewer, fresher replicas beats\nmany stale ones); shed or degrade non-essential read features; then find the\ncause — usually a long-running transaction holding back the apply position, a\nschema migration, a bulk load, or an under-provisioned follower. The\nprepared-engineer tell: you already had per-replica lag alerting and a\ndocumented threshold before the incident." },
  { id: 36, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "How do you add a new follower (or recover a crashed one) without downtime?",
    answer: "Never by naively copying live data files — they're changing underneath you.\nThe standard dance: take a consistent snapshot of the leader (without\nlocking writes; databases support this), note the snapshot's exact position\nin the replication log (Postgres: LSN; MySQL: binlog coordinates), restore\nthe snapshot on the new node, then replay the log from that position\nuntil caught up — at which point it streams live like any follower. A crashed\nfollower recovers the same way from its own last-applied position. Two\noperational gotchas worth naming: the leader must *retain* log segments long\nenough to cover snapshot transfer (retention vs disk pressure), and initial\ncatch-up consumes leader I/O and network — schedule big follower builds off\npeak." },
  { id: 37, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "Statement-based vs WAL shipping vs logical (row-based) replication — why does the choice matter?",
    answer: "Statement-based ships SQL text: compact, but nondeterminism breaks it —\n`NOW()`, `RANDOM()`, auto-increments, and triggers can evaluate differently\non replicas, silently diverging them. Physical WAL shipping ships the\nexact byte-level changes: deterministic and fast, but it couples replicas to\nthe *same storage engine version* — you can't run mixed versions, which\nblocks zero-downtime major upgrades. Logical (row-based) ships \"row X in\ntable Y changed from A to B\": version-tolerant (upgrade replicas first, then\nfail over), engine-independent, and — the strategic payoff — *consumable by\nexternal systems*, which is exactly what change-data-capture taps (card 95).\nStaff framing: logical replication is the bridge from \"database internals\"\nto \"data integration\"." },
  { id: 38, section: "Replication (DDIA ch. 5)", sectionShort: "C",
    question: "What does \"eventual consistency\" actually promise, and how do you operate a system built on it?",
    answer: "A deliberately weak promise: *if writes stop, replicas converge* — with no\nbound on when, and no guarantees about what reads see meanwhile. The term\nnames the absence of timeliness guarantees, not a quality bar (Werner\nVogels' essay — which also coined the session-guarantee vocabulary of cards\n24–27 — frames these as explicit, purchasable consistency levels). Operating\nit well means: measure the lag (leader-vs-replica apply positions in\nseconds and bytes; in leaderless systems, proxy metrics like read-repair\nrates and anti-entropy backlog, since there's no log to lag behind);\nalert on thresholds tied to product promises (\"profile edits visible\nwithin 5 s\"); and design the few flows that can't tolerate the window onto\nsession guarantees or leader reads, on purpose, with the cost stated." },
  { id: 39, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Key-range vs hash partitioning: the core trade?",
    answer: "Key-range assigns contiguous key spans to partitions: preserves sort\norder, so range scans (\"all events for March\") hit one or few partitions —\nbut real-world keys are skewed, and *sequential* keys (timestamps,\nauto-increment IDs) hammer the newest partition while old ones idle.\nHash partitioning scatters keys uniformly: load spreads beautifully, but\nadjacency dies — range queries become scatter-gather across everything. The\nproduction pattern is the compound key: hash a coarse component to\nspread load, range-sort within it — `(user_id, timestamp)` spreads users\nacross partitions while keeping each user's history contiguous and\nscannable. Lead with that hybrid; it shows you've actually modeled a\nworkload." },
  { id: 40, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Why is `hash(key) mod N` a rebalancing disaster, and what's used instead?",
    answer: "Because N appears in every key's address: change node count by one and\nalmost every key remaps → a full-cluster data migration on every scale\nevent, saturating disks and networks exactly when you're trying to add\ncapacity. Alternatives move only what must move: fixed logical\npartitions — create many more partitions than nodes (say 1,000 for 10\nnodes) and rebalance by reassigning *whole partitions* to new nodes (the\nmapping changes; the data within a partition doesn't re-shuffle); or\nconsistent hashing / token ranges (card 46). Either way, adding a node\nmoves ~1/N of the data, not all of it. The deeper rule: never bake the\ncluster size into the key-to-location function." },
  { id: 41, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "One celebrity key is melting a partition. Mitigations, and what each costs?",
    answer: "First diagnose: hot *key* (one ID) vs hot *partition* (bad key choice — card\n44). For a genuinely hot key: salt it — append a small random suffix\n(`key#0..key#15`) so writes spread over 16 partitions; reads must now\nscatter-gather all suffixes and merge, so salt only the identified hot keys\nand keep a registry of them. Special-case the head of the power law:\nroute known-hot entities to dedicated capacity or a different path (e.g.\ncelebrity fan-out handled pull-side, card 2). Cache aggressively in front\nfor read-hot keys. Costs to say out loud: salting sacrifices per-key\nordering and single-key atomic ops; special-casing adds a second code path;\ncaching adds invalidation. Hot keys are a *data property* — no rebalancer\nfixes them, because the load is indivisible by key." },
  { id: 42, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Local vs global secondary indexes?",
    answer: "Local (document-partitioned): each partition indexes only its own rows.\nWrites stay single-partition (index updated in the same place, even\ntransactionally) — but a query by the indexed field must scatter-gather\nevery partition and merge, with tail latency set by the slowest (card 47).\nGlobal (term-partitioned): the index itself is partitioned by the\nindexed *value*, so a lookup hits exactly the right index partition — but a\nsingle row write must now update index entries on *other* partitions, which\nis done asynchronously in practice (synchronous would need a distributed\ntransaction), so the index lags the data. Decision rule: write-heavy\nwith occasional filtered queries → local; read-heavy lookups on the indexed\nfield → global, with the staleness window stated as a product fact." },
  { id: 43, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "How does a request find the right partition? The three routing options.",
    answer: "(1) A routing tier — proxies that consult an authoritative\npartition-assignment store (classically ZooKeeper) and forward; simple\nclients, extra hop, the assignment store must be highly available.\n(2) Partition-aware clients — the client library holds the assignment\nmap and connects directly; lowest latency, but every client must learn about\nrebalances (gossip, metadata refresh, \"moved\" redirects). (3) Any-node\nforwarding — send anywhere; nodes know the map and forward (Cassandra-style\ncoordinators); simplest clients, occasional extra hop. All three reduce to\nthe same hard sub-problem: *someone* must hold the truth about\npartition→node assignment and propagate changes promptly — which is why a\nconsensus-backed metadata service usually sits underneath (card 79)." },
  { id: 44, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "What makes a good partition key?",
    answer: "Three properties, in tension: even distribution of both data volume and\nrequest load (beware low-cardinality keys, time, and power-law entities);\naccess-pattern alignment — the dominant queries should be answerable\nwithin one partition (key by `conversation_id` so a chat loads from one\nshard, not by `message_id` which scatters every conversation); and\nco-location of what must be ordered or transactional together, since\nper-partition order and single-partition atomicity are the cheap guarantees\n(cards 27, 109's uniqueness trick). Classic failures: keying time-series by\ntimestamp (one white-hot \"now\" partition — card 48's fix), keying by country\n(US partition melts), keying by `user_id` when one user is a bot doing 90%\nof traffic. Always state the follow-up: \"and I'd monitor per-partition load\nto catch skew early.\"" },
  { id: 45, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Why is automatic rebalancing dangerous during incidents?",
    answer: "Rebalancing is itself a heavy workload — bulk data movement consuming disk\nand network. The danger pattern: overload or a network blip makes nodes\n*look* dead to the failure detector → the autobalancer declares them lost\nand starts re-replicating/moving their partitions → the movement adds load →\nmore nodes look dead → cascade. The cure is friction: rate-limit\nrebalancing, require sustained (not instantaneous) failure signals, cap\nconcurrent movements, and gate large-scale rebalances behind human\nconfirmation. Same family as card 23's failover trap — automation that\nreacts to timeouts must be tuned for the false-positive case, because its\ncorrective action is expensive precisely when false positives spike." },
  { id: 46, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Explain consistent hashing and why systems add virtual nodes.",
    answer: "Map both nodes and keys onto a hash ring; each key belongs to the next node\nclockwise. Adding or removing a node only remaps keys in its arc — ~1/N of\ndata moves, solving card 40's problem. Two raw-ring defects, both fixed by\nvirtual nodes: with one point per physical node, load between nodes is\nuneven (random arc sizes) and a node's departure dumps its entire arc on one\nneighbor. Giving each physical node many vnodes (tokens) scattered around\nthe ring evens out arc ownership statistically and spreads a failed node's\nload across *many* successors — also letting heterogeneous hardware take\nproportionally more vnodes. Worth saying: Dynamo-style stores use the ring;\nplenty of other systems (Kafka, many SQL shardings) instead use fixed\npartitions + an assignment map (card 40) — consistent hashing is one tool,\nnot the definition of sharding." },
  { id: 47, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "Why does scatter-gather over many partitions wreck tail latency, and what mitigates it?",
    answer: "A fan-out query is as slow as its slowest shard, and slow shards aren't\nrare events at fan-out scale: if each shard is slow (GC, compaction, queue\nspike) just 1% of the time, a 100-shard query hits at least one slow shard\n~63% of the time — the component p99 becomes the query's *median*. This is\ntail amplification applied to partitioning. Mitigations: reduce fan-out\n(better partition keys so queries are single-shard — card 44; global indexes\n— card 42), hedged requests (send the straggling sub-request to a\nreplica after a short delay, take the first answer; cheap because only the\nslowest few percent are duplicated), partial results with timeouts where the\nproduct tolerates it, and relentless work on per-shard variance (compaction\ntuning, GC, isolation from batch work)." },
  { id: 48, section: "Partitioning / sharding (DDIA ch. 6)", sectionShort: "D",
    question: "How do you partition time-series data so \"now\" doesn't melt one shard?",
    answer: "Pure time-range partitioning sends *all* current writes to the newest\npartition — one hot shard, N−1 idle ones. The standard fix is a compound\nkey: (source, time window) — e.g. `(sensor_id, day)` or\n`(tenant, hour)` — so concurrent writes spread across sources while each\nsource's recent data stays contiguous for range scans. Queries for one\nsource over a window touch few partitions; cross-source aggregations\nscatter-gather (acceptable for analytics). Bonus operational win: old time\nwindows become immutable, so they can be compressed hard, tiered to cheap\nstorage, and dropped wholesale for retention — deleting a partition beats\ndeleting rows. If a single source is itself too hot, salt within the window\n(card 41). This pattern composes cards 39, 41, and 44 — say it as a worked\nexample." },
  { id: 49, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "What does the A in ACID actually mean? (Common trap.)",
    answer: "Abortability, not \"atomic with respect to other threads\". Atomicity\npromises that a transaction's writes are all-or-nothing *in the face of\nfaults*: if it can't complete (crash, constraint violation, disconnect),\nevery partial write is rolled back as if nothing happened — which is what\nmakes safe retries possible. Guarantees about what *concurrent*\ntransactions see belong to Isolation. The trap exists because \"atomic\"\nmeans the concurrency thing in atomic-CPU-instruction land. Interview\ndelivery: \"A is about crashes, I is about concurrency — A gives me clean\nretries, I gives me sane interleavings.\"" },
  { id: 50, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "What does the C in ACID stand for, and why is it the odd one out?",
    answer: "Consistency here means *application-defined invariants hold* (accounts\nbalance, foreign keys resolve) — and unlike A, I, D, it isn't something the\ndatabase can provide alone. The database supplies tools (constraints,\natomicity, isolation); the *application* must write transactions that take\nthe data from one valid state to another. Joe Hellerstein's quip, quoted in\nDDIA, is that C was tossed in to make the acronym work. Also keep it\ndistinct from CAP's C, which means linearizability (card 76) — three\ndifferent \"consistencies\" share one word, and interviewers probe exactly\nthat confusion." },
  { id: 51, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "What does read committed prevent, and what does it still allow?",
    answer: "Prevents dirty reads (you never see uncommitted data — implemented by\nreturning the old committed value while a writer holds the new one) and\ndirty writes (you never overwrite uncommitted data — row-level write\nlocks). It's the default in PostgreSQL, Oracle, and SQL Server. Still\nallowed: read skew (card 52), lost updates (card 54), write skew\n(card 55), phantoms (card 56) — i.e. nearly every interesting\nconcurrency bug. The staff habit: name your database's *actual* default\nisolation level in designs, because most engineers assume more protection\nthan read committed gives." },
  { id: 52, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "What is read skew, and which mechanism fixes it?",
    answer: "A transaction reads several rows while another transaction commits *between\nthose reads*, so it observes a mixture of before-and-after — a state that\nnever existed at any instant. Canonical: you check account A ($500), a\ntransfer commits, you check account B ($400) — the $100 seems to have\nvanished. Harmless for some UIs; fatal for backups (restoring a\nmixed-state backup makes the anomaly permanent) and long analytics\nqueries. The fix is snapshot isolation: every transaction reads from a\nconsistent snapshot of the database as of its start, implemented with MVCC\n(card 53). One sentence: *read committed protects each read; snapshot\nisolation protects the relationship between reads.*" },
  { id: 53, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "How does MVCC work, and what's the headline benefit?",
    answer: "Multi-Version Concurrency Control: writers never overwrite — they append a\nnew version of the row stamped with their transaction ID, and the old\nversion remains. Each transaction gets a snapshot rule: \"see versions\ncommitted before I started; ignore later ones and uncommitted ones.\" Visible\neffects: readers never block writers and writers never block readers —\nlong reads (reports, backups) coexist with OLTP traffic — and consistent\nsnapshots are nearly free. The operational bill: old versions accumulate and\nmust be garbage-collected (Postgres VACUUM); a long-running transaction pins\nthe oldest visible snapshot, blocking cleanup — which is the classic root\ncause behind \"table bloat\" and replication-apply stalls (card 35's culprit)." },
  { id: 54, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "Two clients read a counter at 40 and both write 41. Name the anomaly and four defenses.",
    answer: "Lost update — concurrent read-modify-write cycles where one clobbers the\nother. Defenses, in order of preference: (1) atomic write operations —\npush the modification into the database (`UPDATE counters SET n = n + 1`),\neliminating the client-side gap entirely; (2) explicit locking —\n`SELECT … FOR UPDATE` serializes the cycle (works, costs blocking);\n(3) compare-and-set — `UPDATE … WHERE n = 40` and retry on zero rows\n(beware: under snapshot isolation the WHERE may read the snapshot — know\nyour engine); (4) automatic detection — some snapshot-isolation engines\nabort a transaction whose read was stale at write time; retry on abort. In\nleaderless/multi-leader stores none of these exist locally — you're back to\nversion vectors and merges (card 31)." },
  { id: 55, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "Define write skew, give the canonical example, and the fix.",
    answer: "Generalized lost update: two transactions read an overlapping set to\ncheck an invariant, then write disjoint rows — each write fine alone,\nthe pair violating the invariant. Canonical: hospital rule \"≥1 doctor on\ncall\"; Alice and Bob, both on call, each query `COUNT(on_call) = 2`,\nconclude it's safe, and *each removes themself* — different rows, zero\ndoctors. Snapshot isolation permits it (no write-write conflict to detect).\nFixes: true serializability (SSI detects the dangerous read-write\npattern and aborts one; 2PL blocks it); or materialize the conflict —\ncreate a row both must lock (the on-call-shift row, `FOR UPDATE`); or a\ndatabase constraint when expressible. The detection skill: any\n\"check-then-act on a condition others can change\" is write-skew-shaped." },
  { id: 56, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "What's a phantom, and why can't row locks stop it?",
    answer: "Your transaction's *search condition* (\"any booking for room 12,\n2–3 pm?\") is invalidated by a row that didn't exist when you ran it —\nanother transaction inserts the conflicting booking after your check. You\ncan't lock a row that isn't there, so plain row locking is structurally\nhelpless. Remedies: predicate locks (lock the condition itself —\nexpensive) approximated in practice by next-key/gap locks on index\nranges (lock the gap where matching rows *would* land); SSI's read-tracking\ncatches phantoms too; or materialize the resource — pre-create a row per\nbookable slot so the conflict becomes an ordinary row lock/unique constraint.\nPhantoms are write skew's insert-shaped sibling, and booking systems are\ntheir natural habitat." },
  { id: 57, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "Name the three practical routes to serializability and when each fits.",
    answer: "(1) Actual serial execution: run transactions one at a time on a single\ncore — trivially serializable, viable since RAM-resident data made\ntransactions microsecond-fast (VoltDB lineage; Redis scripts are this\nspirit). Requires short, non-interactive transactions (stored procedures —\nno waiting on the client mid-transaction) and throughput bounded by one\ncore per partition; cross-partition transactions get hard. (2) Two-phase\nlocking: readers and writers take shared/exclusive locks held to commit —\nthe classic; safe but blocking, deadlock-prone, fragile latency under\ncontention. (3) Serializable Snapshot Isolation: optimistic — run on\nsnapshots, detect dangerous read-write dependency patterns at commit, abort\none party; great when contention is low, retry-stormy when it isn't. Staff\nadd-on: \"and per-partition serial execution via a log is how stream\nprocessors sneak serializability in\" (card 108)." },
  { id: 58, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "2PL vs SSI — how do they fail differently under contention?",
    answer: "Same guarantee, opposite temperaments. 2PL is pessimistic: conflicts\nmanifest as *waiting* — lock queues, blocked readers behind writers,\ndeadlocks resolved by victim-killing; under a hot row, latency stretches and\nthroughput collapses, but no work is wasted on doomed transactions. SSI is\noptimistic: conflicts manifest as *aborts at commit* — transactions run\nfull speed on snapshots, then some discover their reads went stale and must\nretry; under low contention it's near-free, under a hot row you burn CPU\nre-executing the same losers (retry storms) and need backoff. Decision lens:\ncontention rate × transaction length. Long transactions are poison to both —\nthey hold locks (2PL) or widen the conflict window (SSI) — so the real fix\nfor a hot spot is often restructuring the conflict (card 54's atomic ops,\nsharded counters), not switching CC algorithms." },
  { id: 59, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "Why is two-phase commit (2PC) painful at scale, and what do people do instead?",
    answer: "2PC makes commit atomic across participants via a coordinator: prepare\n(everyone votes, promises, and holds locks) then commit. The pain: after\nvoting yes, a participant is in doubt — it cannot unilaterally commit or\nabort — so a crashed coordinator strands participants holding locks,\nstalling unrelated traffic until recovery; plus extra round-trips and fsyncs\nper transaction, and an availability product of all participants. It also\ndoesn't compose across heterogeneous systems well (XA is operationally\ngrim). Alternatives by case: keep transactions single-partition (choose\nkeys so they can be — card 44); idempotent multi-step flows / sagas with\ncompensation; outbox + log for \"update DB and publish event\" (card 96);\nand where atomic multi-node commit is truly required, consensus-based commit\n(the coordinator's decision in a replicated log) removes the\nsingle-coordinator blocking flaw." },
  { id: 60, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "When do you actually pay for serializable isolation?",
    answer: "When an invariant spans data that concurrent transactions *read* to make a\ndecision and then write disjointly — the write-skew/phantom family:\ndouble-booking, \"balance never below zero\" enforced via check-then-debit,\nquota and capacity enforcement, uniqueness under race. The discipline is to\ninventory transactions, not flip a global switch: most traffic\n(reads, single-row updates, atomic increments) is safe at snapshot\nisolation/read committed; the handful of invariant-bearing transactions get\nserializable (or a materialized lock / constraint). Saying \"I'd enumerate\nwhich transactions carry invariants and protect exactly those, then load-test\nthe abort/lock rate\" is the staff-shaped answer; \"turn on serializable\neverywhere\" reads as never having paid the latency bill." },
  { id: 61, section: "Transactions (DDIA ch. 7)", sectionShort: "E",
    question: "When is single-object atomicity enough — and what does that imply for data modeling?",
    answer: "Databases give strong guarantees cheaply *within* one object/row/document:\natomic single-key updates, per-document transactions, atomic compare-and-set.\nIf every invariant you care about lives inside one object, you don't need\nmulti-object transactions at all — which is the design bet document stores\nmade: model the aggregate (order + its line items) as one document, update it\natomically, scale without cross-document coordination. The implication runs\nboth ways: *modeling can buy you out of distributed transactions* (co-locate\nwhat must change together — same row, same document, same partition), and\nconversely, scattering one logical change across many rows/services is what\n*creates* the need for 2PC/sagas. In design interviews, reach for \"can I\nre-model so the invariant is single-object/single-partition?\" before\nreaching for transaction machinery." },
  { id: 62, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Why are timeouts the only failure detector — and what can't they tell you?",
    answer: "In an asynchronous network there is no upper bound on delay: packets\nqueue, links congest, GC pauses intervene. So the only available evidence of\nfailure is *silence for longer than expected* — a timeout. What it cannot\ndistinguish: dead node vs slow node vs dead link vs slow link vs a node that\nreceived the request and is still working. Critically, it can't tell you\nwhether the request was executed before the silence — the foundation of\ncard 63. Consequences: failure detection is probabilistic (tune timeouts to\nmeasured latency distributions, not vibes); actions taken on timeout\n(retry, failover) must be safe under false positives; and \"the node is\ndown\" should be spoken as \"the node looks down *to me, right now*.\"" },
  { id: 63, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Why does \"retry on timeout\" require idempotency?",
    answer: "Because a lost response is indistinguishable from a lost request. If the\nrequest executed but the ack died, your retry executes it *again*:\ndouble-charge, duplicate email, two shipments. Safe retries need\nidempotency: the operation can be applied many times with the effect of\nonce. Naturally idempotent ops (set x = 5) are fine as-is; for the rest, the\nclient mints an idempotency key (a unique operation ID) per logical\naction, sends it on every attempt, and the server deduplicates — typically a\nunique-keyed insert that returns the original result on conflict. Note the\nscope rule that becomes card 106: the key must be minted at the *source of\nintent* and survive every hop, or a layer above the dedupe point can still\nduplicate." },
  { id: 64, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Your dependency starts timing out. How do clients retry without making it worse?",
    answer: "Naive retries triple traffic into a service that's drowning — a retry storm\nthat converts a brownout into an outage. The toolkit: exponential\nbackoff (space attempts out so the dependency can recover), jitter\n(randomize the backoff — otherwise all clients retry in synchronized waves),\na retry budget / token bucket (retries allowed only while tokens last,\nso retry traffic is capped at a fraction of base traffic — built into the\nAWS SDK), retry at one layer only (stacked retries multiply: 3 layers ×\n3 attempts = 27 calls), and circuit breakers used carefully (they add\nmodal behavior; budgets are gentler). Plus card 63's prerequisite: only\nretry what's idempotent, and only errors worth retrying (not 4xx)." },
  { id: 65, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "How does clock skew turn last-write-wins into data loss?",
    answer: "LWW orders writes by wall-clock timestamps, but every node's clock is wrong\nby some unknown amount — NTP sync is best-effort (milliseconds when healthy,\nunbounded when not: VM pauses, network issues, misconfiguration, leap-second\nhandling). So a write stamped by a fast clock beats a *genuinely later*\nwrite stamped by a slow clock: the newest data is silently discarded, with\nno error, on a healthy system. And the loss is invisible — nothing logs \"I\ndropped the real latest value.\" Mitigations: don't order cross-node events\nby time-of-day clocks at all — use logical sequence (per-partition log\norder, version vectors); if timestamps are unavoidable, generate them at one\nplace (the storage node); and treat clock skew as a *monitored* failure mode\nwith alerts, since few teams watch it." },
  { id: 66, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Time-of-day vs monotonic clocks — when must you use which?",
    answer: "Time-of-day (wall) clocks answer \"what time is it?\" — synchronized via\nNTP, which means they can jump, including backwards (step corrections),\nand freeze or smear around leap seconds. Never use them to measure elapsed\ntime or order events across nodes. Monotonic clocks answer \"how long\nhas it been?\" — guaranteed to move forward, ideal for timeouts and duration\nmeasurement, but their absolute value is meaningless and incomparable\n*across machines*. The bug this card prevents: `deadline = wallclock() + 30s`\nmisfires when NTP steps the clock — every timeout in that process fires\nearly or late at once. Rule: durations → monotonic; calendar moments →\nwall clock; cross-node ordering → neither (logical clocks, card 84)." },
  { id: 67, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "What is a process pause, and why does it break lease-based code?",
    answer: "The whole process can freeze for seconds *between any two instructions*:\nstop-the-world GC, VM live-migration, host hypervisor steal, swapping/page\nfaults, even laptop lid-close in dev. The killer pattern: code checks \"my\nlease is still valid,\" passes, *then pauses*; the lease expires, another\nnode legitimately takes over, the original thread wakes and writes anyway —\na zombie writer corrupting state while believing it holds exclusivity.\nNo amount of re-checking the clock helps: the pause can land between the\ncheck and the write. Consequences: any safety property must be enforced\n*outside* the pausable process (fencing — card 68), and lease durations must\ndwarf worst-case pauses you've actually measured (GC logs are evidence)." },
  { id: 68, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Explain fencing tokens.",
    answer: "The fix for zombie writers: make the *resource* reject stale authority\ninstead of trusting clients to know they're stale. The lock/lease service\nissues a monotonically increasing token with every grant (epoch, term,\nor counter). Clients include the token on each write; the protected\nresource records the highest token seen and rejects anything lower. Now\nthe paused old holder wakes, writes with token 33, and storage — having seen\n34 — refuses. Requirements worth naming: the resource must be able to check\nand persist tokens (a dumb resource needs a gateway that can), and token\nissuance must be linearizable (which is why this lives next to\nconsensus-backed lock services, card 81). This is Kleppmann's celebrated\ncritique of Redlock distilled: a lock without fencing protects only against\npolite failures." },
  { id: 69, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Is \"exactly-once delivery\" possible? What's the achievable version?",
    answer: "Delivery: no — over a lossy network you must retry to guarantee\ndelivery, and retries can duplicate; you can have at-most-once or\nat-least-once, pick. Achievable: exactly-once *effects* (effectively-\nonce processing): duplicates exist in transit and are *neutralized* at\nboundaries — idempotent application (card 63), sequence numbers that let\nreceivers discard replays, and transactional sinks that commit output and\nprogress atomically (card 99). The interview answer in one breath:\n\"impossible at the delivery layer, engineered at the effect layer — and the\ndedupe must live at the layer where the *operation's identity* is known,\nwhich is the end-to-end argument\" (card 106)." },
  { id: 70, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Crash-stop vs Byzantine faults — what do most systems assume, and why?",
    answer: "Crash-stop/crash-recovery: nodes fail by halting (possibly returning\nwith stable storage intact); they never lie. Byzantine: nodes may do\nanything — corrupt data, send contradictory messages, act maliciously.\nTolerating f Byzantine nodes needs 3f+1 replicas and expensive protocols\n(BFT consensus), so inside a single organization's trust perimeter,\ninfrastructure (Raft, ZooKeeper, databases) assumes non-Byzantine and spends\nthe budget where real risks are: checksums end-to-end (disks and memory\ndo corrupt bits — a weak Byzantine reality), auth between services, and\ninput validation at trust boundaries (clients are Byzantine by\ndefinition). Byzantine-tolerant protocols earn their cost in\nmulti-organization settings — blockchains, some aerospace." },
  { id: 71, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Why must any node's \"I'm the only writer\" belief be enforced somewhere else?",
    answer: "Because every ingredient of that belief is falsifiable without the node\nknowing: it can be paused (card 67) past its lease, partitioned from\nthe majority that already elected a successor, or de-elected while its\nnotification is in flight. Local state about global authority is always\npotentially stale — \"the truth is defined by the majority/the resource, not\nby the node's memory of being chosen.\" So safety must be checked where\nwrites land: fencing tokens at storage (card 68), epoch numbers on every\nreplication message (card 80), conditional writes keyed on a leader\ngeneration. A clean staff phrasing: *leadership is a claim; the resource\nverifies claims.*" },
  { id: 72, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "Sketch the system models: what do \"partially synchronous\" and \"crash-recovery\" buy you as a designer?",
    answer: "Models are the assumptions proofs and protocols rest on. Timing:\n*synchronous* (bounded delays — unrealistic for real networks), *asynchronous*\n(no timing assumptions at all — brutally pessimistic; FLP lives here, card\n85), and partially synchronous — the realistic middle: the system behaves\nasynchronously in bad periods but eventually delivers within bounds. Node\nfaults: crash-stop, crash-recovery (nodes return, stable storage\nsurvives — the model real databases target), Byzantine (card 70). Why care:\nalgorithms are correct *relative to a model* — Raft is safe in partial\nsynchrony with crash-recovery nodes; deploy it where assumptions break\n(unbounded pauses treated as crashes without fencing) and \"proven correct\"\nstops applying. It's also the vocabulary for whittling vague reliability\ntalk into checkable claims." },
  { id: 73, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "\"The network is reliable inside our datacenter.\" What does production evidence say?",
    answer: "Partitions and partial failures are routine, and they're rarely clean\nbinary splits: asymmetric links (A reaches B, B can't reach A),\none-way packet loss, a congested or misconfigured switch isolating a rack,\nflapping links that heal and re-fail, and gray failures where a NIC drops a\npercentage of packets. The GitHub October 2018 incident began with ~43\nseconds of partition between sites — enough for both sides to make\nirreconcilable progress and cost a day of recovery. Design consequences:\nevery safety mechanism must survive *partial and asymmetric* connectivity\n(quorums and epochs do; \"ping it to check\" doesn't), failure detection is\nper-observer (card 62), and partition response is a designed behavior, not\nan exception path." },
  { id: 74, section: "The trouble with distributed systems (DDIA ch. 8)", sectionShort: "F",
    question: "How does Spanner's TrueTime make clocks safe to use — and what's the universal lesson?",
    answer: "Google's Spanner doesn't pretend clocks are accurate; it makes their\nuncertainty explicit. TrueTime returns an interval [earliest, latest]\nguaranteed to contain the true time (GPS + atomic clocks keep it a few ms\nwide). For ordering guarantees, a transaction commit-waits: it holds\nits commit until the uncertainty interval has fully passed, so its timestamp\nis unambiguously in the past before effects are visible — buying external\nconsistency (real-time ordering) from clocks. The universal lesson, usable\nwithout Google hardware: never trust a point timestamp across nodes; either\nuse logical ordering (cards 65, 84) or *quantify* clock error and design\nwaits/conflict-windows around the bound. \"Confidence intervals on time\" is\nthe idea; commit-wait is the price." },
  { id: 75, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Define linearizability in one sentence, then state its price.",
    answer: "The system behaves as if there were one copy of the data and every\noperation took effect atomically at some instant between its invocation\nand its response — so once any client's read returns a value, every later\nread returns that value or newer; recency is guaranteed in real time. The\nprice: every operation needs coordination — cross-node round-trips on the\ncritical path (latency), throughput capped by the coordinating group,\nand forced unavailability during partitions (the minority side must\nrefuse rather than serve stale data). That's why card 82's answer is to buy\nit only where invariants demand it." },
  { id: 76, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "State CAP precisely — and why sophisticated engineers lean on it less than juniors do.",
    answer: "Precise form: when a network partition occurs, a system must choose\nbetween *linearizable consistency* (refuse some requests rather than serve\nnon-linearizable results) and *availability* (serve everyone, sacrificing\nlinearizability). No partition → no forced choice. Why it underwhelms at\nstaff level: it covers exactly one consistency level (linearizability) and\none fault (partitions) — nothing about latency, which dominates real\ndesigns even when the network is healthy; many systems are *neither* C nor A\nby its strict definitions; and real systems make different choices per\noperation, so \"is X CP or AP?\" is usually a category error. Use it as a\nreminder that partitions force trade-offs; use richer vocabulary\n(linearizable / causal / session guarantees; timeliness vs integrity, card\n107) for actual design." },
  { id: 77, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Linearizability vs serializability — disentangle them.",
    answer: "Orthogonal axes that share a syllable. Serializability (isolation, ch.\n7): *multi-object transactions* behave as if executed in some serial\norder — but that order may disagree with real time (a serializable system\nmay legally let you read stale data, as long as the whole history is\nequivalent to some serial one). Linearizability (ch. 9): *single-object\noperations* respect real-time recency — no transactions implied.\nCombine them and you get strict serializability: a serial order that\nalso matches real time. Concrete probe to keep handy: serializable-but-not-\nlinearizable = snapshot-based serializable engine serving a stale-but-\nconsistent snapshot; linearizable-but-not-serializable = a linearizable\nkey-value register with no multi-key transactions at all." },
  { id: 78, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Why is total order broadcast equivalent to consensus?",
    answer: "Total order broadcast (TOB) = all nodes deliver the same messages in the\nsame order, exactly once, reliably. Deciding \"what is entry #N of the\nshared log?\" is precisely a consensus decision; run consensus repeatedly,\nonce per slot, and you've built TOB — run TOB and you can implement\nconsensus (propose; first message delivered wins). So \"replicated log\" and\n\"consensus\" are one machine in two vocabularies — which is why Raft is\ndescribed as replicated-log management. The payoff identity: TOB + applying\nentries deterministically = state machine replication — every replica,\nfed the same ordered inputs, computes the same state. That identity is also\nwhy a Kafka-style partition (a durable total order per partition) can stand\nin for coordination in card 108's uniqueness trick." },
  { id: 79, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Where does consensus actually run in a typical stack?",
    answer: "Fewer places than people think, and they're load-bearing: leader election\nand log ordering inside replicated systems (Raft in etcd and many modern\ndatabases; Kafka's metadata/controller quorum; ZooKeeper's ZAB);\ncluster metadata — membership, partition assignments (card 43's truth),\nconfiguration, feature flags that must not glitch; distributed locks and\nleases with fencing (cards 68, 81); and atomic commit when the commit\ndecision itself is consensus-replicated to fix 2PC's blocking coordinator\n(card 59). Everything else — replication fan-out, derived views, caches —\ndeliberately *rides on top of* those few ordered, agreed points. Staff\nphrasing: \"consensus is expensive, so architecture concentrates it into a\nsmall control plane and keeps the data plane mostly coordination-free.\"" },
  { id: 80, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Why do consensus protocols need both quorums and epochs?",
    answer: "Each solves the failure the other can't. Epochs/terms order leaders\n*across time*: every election increments the epoch; participants reject\nproposals from older epochs — so a deposed, paused, or partitioned old\nleader can't overwrite the new regime (the protocol-level fencing token,\ncard 68). Quorums make that enforceable and elections decisive: any two\nmajorities overlap, so a candidate gathering a majority is guaranteed to\ncontact at least one node that knows about any later epoch or any committed\nentry — stale leadership is detected, and committed data survives into the\nnew term (Raft additionally only elects candidates with up-to-date logs).\nOne line: *epochs say who's newest; quorum overlap guarantees somebody in\nthe room remembers.*" },
  { id: 81, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "What do ZooKeeper/etcd actually give an application developer?",
    answer: "Outsourced consensus, packaged as a tiny linearizable kernel: atomic\ncompare-and-set on small keys (the primitive under elections and locks),\nephemeral nodes / leases — keys bound to a client session that vanish\nwhen the session dies, giving automatic cleanup and liveness detection;\ntotal ordering of all updates (zxid / revision — usable directly as\nfencing tokens, card 68); and watches — notifications on change, so\nclients react without polling. From these you assemble leader election,\nlocks with fencing, service discovery, membership, and config — without\nwriting consensus. Two usage rules that mark experience: keep the data tiny\nand low-churn (it's a coordination kernel, not a database), and treat\n*watch-then-read* races and session expiry as first-class code paths." },
  { id: 82, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Why not make the whole system linearizable and be done with it?",
    answer: "Because you'd pay consensus prices on every operation: cross-node\nround-trips on each read/write (tail latency multiplies — and this cost is\npaid even when the network is perfectly healthy, the thing CAP doesn't\nmention), throughput capped by the ordering group, and minority-side\nunavailability during partitions. Most product flows don't need real-time\nrecency — they need session guarantees (cards 24–27) or mere integrity\n(card 107). The staff design move is an inventory: linearizability for\nthe handful of operations whose invariants demand it — uniqueness claims,\nlease grants, ledger appends, config flips — implemented via the\ncoordination kernel (card 79); everything else explicitly, comfortably\nweaker. \"Strong everywhere\" is how you build a slow system that still has\noutages." },
  { id: 83, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "How do you get a linearizable read from a Raft-style leader — and what's the trap?",
    answer: "The trap is the obvious approach: \"read from the leader.\" A leader can be\ndeposed and not know it (partition, pause); serving reads from its local\nstate then returns stale data — non-linearizable — while a new leader\ncommits writes elsewhere. Correct options: read-index — the leader\nconfirms leadership with a quorum round-trip (cheaper than a log write),\nthen serves the read at or past its commit index; lease reads — the\nleader serves locally during a clock-bounded lease granted by the quorum\n(fast, but correctness now leans on bounded clock drift — card 66's\ncaveats); or push the read through the log like a write (slowest, simplest).\nThis card is the bridge between \"we run Raft\" and \"our reads are actually\nlinearizable\" — many deployments quietly aren't." },
  { id: 84, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Lamport timestamps vs version vectors — both \"logical clocks\"; what's the difference that matters?",
    answer: "Lamport timestamps (counter, bumped on events and to max+1 on message\nreceipt, ties broken by node ID) give a total order consistent with\ncausality: if A happened-before B, L(A) < L(B). But the converse fails —\nfrom two timestamps you *cannot tell* whether the events were causally\nrelated or concurrent; the order between concurrent events is arbitrary.\nVersion vectors (card 31) preserve exactly that information: comparing\nvectors tells you ordered-vs-concurrent. So: need a single agreed\nsequence (and don't care that concurrency is hidden)? Lamport-style numbers\n— though note they order *after the fact* and can't alone enforce\nuniqueness-at-decision-time, which needs TOB/consensus (card 78). Need to\n*detect conflicts* to merge them (multi-leader, leaderless)? Version\nvectors. One hides concurrency; the other exposes it." },
  { id: 85, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "What does the FLP result say, and why do real consensus systems work anyway?",
    answer: "FLP (Fischer–Lynch–Paterson, 1985): in a fully asynchronous model — no\nclocks, no timing bounds — no deterministic protocol can guarantee consensus\ntermination if even one node may crash; there's always a schedule that\ndelays a decision forever. It's a statement about that pessimistic model,\nnot a ban: real systems escape by adding exactly what the model forbids —\ntimeouts and failure detectors (partial synchrony: Raft's randomized\nelection timers), or randomness. The mature reading: safety holds\nunconditionally in good protocols (never two decisions, regardless of\ntiming), while liveness is conditional on the network behaving\neventually — so consensus systems can *stall* during pathological periods\nbut won't *corrupt*. That safety/liveness split is the right frame for most\ndistributed guarantees." },
  { id: 86, section: "Consistency & consensus (DDIA ch. 9)", sectionShort: "G",
    question: "Sketch Raft in 60 seconds: components and the safety property.",
    answer: "Three pieces. Leader election: randomized election timeouts; a follower\nthat hears no heartbeat becomes a candidate in a new term, wins with a\nmajority of votes; voters refuse candidates whose logs are behind theirs.\nLog replication: all writes go through the leader, which appends and\nreplicates entries; an entry is committed once a majority stores it,\nthen applied by all state machines in log order (state machine replication,\ncard 78). Safety: at most one leader per term (majority votes + term\nchecks), and the election restriction means a new leader already holds every\ncommitted entry — so committed entries are never lost or reordered, across\nany sequence of crashes and elections. Designed explicitly to be teachable —\nthe paper is genuinely readable, and the site has a live visualization." },
  { id: 87, section: "Batch processing (DDIA ch. 10)", sectionShort: "H",
    question: "Why do batch frameworks insist on immutable inputs and deterministic tasks?",
    answer: "Because it makes fault tolerance *structural* instead of protocolic: any\nfailed task can be re-executed anywhere from the same input and produce the\nidentical output — so the scheduler retries freely, speculative duplicates\nof stragglers are harmless, and partial failures never corrupt state. The\nunderrated second benefit is human fault tolerance: a buggy job is fixed\nby editing code and re-running on the same untouched input — the original\ndata was never mutated, so there's nothing to un-break. This pair —\nimmutable input, re-derivable output — is the philosophical core the rest of\nthe book reuses: streams inherit it via replayable logs (card 100's rewind),\nand chapter 12's \"rebuildable views\" (card 105) is the same idea at\narchitecture scale." },
  { id: 88, section: "Batch processing (DDIA ch. 10)", sectionShort: "H",
    question: "Reduce-side vs map-side joins?",
    answer: "Reduce-side is the general-purpose join: map both datasets emitting the\njoin key, let the shuffle bring all records with the same key to the same\nreducer, join there. Always works, no assumptions — at the cost of a full\nsort/shuffle of both inputs across the network, usually the job's\ndominant expense. Map-side joins skip the shuffle when structure allows:\nbroadcast join — one side is small enough to ship in full to every\nmapper as an in-memory lookup table; partitioned/sorted-merge join —\nboth inputs are already partitioned (and ideally sorted) by the join key\nfrom a previous job, so each mapper joins its aligned slice locally.\nInterview framing: join strategy = \"what do I know about my inputs?\" —\nnothing → shuffle; one side tiny → broadcast; both pre-partitioned → merge\nin place. (Card 89 covers when the key itself betrays you.)" },
  { id: 89, section: "Batch processing (DDIA ch. 10)", sectionShort: "H",
    question: "One key has 100× the records and stalls the whole join. What do you do?",
    answer: "That's skew: shuffle-by-key sends every record for the hot key\n(\"celebrity user\", null IDs, a default value) to one reducer, which runs for\nhours while peers idle — the job is as slow as its hottest key. Remedies:\ndetect first (sample key frequencies — engines and a quick pre-job both\nwork); broadcast-join the small side so the big side never shuffles at\nall; salt the hot keys — split them across many reducers with a random\nsuffix, replicating the matching small-side rows to each, then merge;\nisolate known-hot keys into a dedicated path. Also audit for *garbage* hot\nkeys (nulls/defaults) you can filter or handle separately. Same disease as\ncard 41 — skew is a data property; parallelism can't divide an indivisible\nkey, so the *plan* must change." },
  { id: 90, section: "Batch processing (DDIA ch. 10)", sectionShort: "H",
    question: "MapReduce writes everything to disk between stages; Spark/Flink-style engines don't. What's the actual trade?",
    answer: "MapReduce fully materializes each job's output to the distributed\nfilesystem (replicated!) before the next job starts. Costs: enormous I/O,\nand a pipeline of N jobs pays N round-trips through storage with dead time\nbetween. Benefits: stages are durable checkpoints — a failure resumes from\nthe last boundary, and intermediate outputs are inspectable/reusable.\nDataflow engines model the whole pipeline as one operator DAG and\nstream records between operators (memory/local disk, no replication):\nmassively faster, no waiting for stage completion — but a failure now loses\nin-flight state, so they need their own recovery machinery: recompute lost\npartitions from lineage, or periodic checkpoints of operator state.\nThe trade in one line: *materialization buys cheap recovery and debuggability\nwith expensive I/O; pipelining buys speed and owes you a recovery story.*" },
  { id: 91, section: "Batch processing (DDIA ch. 10)", sectionShort: "H",
    question: "Why should batch jobs be side-effect-free, with outputs written all-or-nothing?",
    answer: "Because retries and speculative execution mean any task may run more than\nonce — a task that sends emails or mutates an external database mid-job\nduplicates those effects on every retry, and a half-failed job leaves the\nworld half-mutated with no rollback. Discipline: tasks compute pure\noutputs; the framework writes them to a staging location and atomically\npublishes on success (rename/commit), so downstream consumers see either\nthe complete old output or the complete new one — never a torn mix; failed\nruns leave the previous output untouched (instant rollback = repoint).\nExternal effects, if truly needed, happen *after* commit, idempotently\n(card 63). This is exactly the discipline streaming re-derives as\n\"idempotent or transactional sinks\" (card 99) — batch just gets it almost\nfor free." },
  { id: 92, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "Log vs queue: what's the decision rule?",
    answer: "Two philosophies of what a message *is*. A queue (AMQP-style) treats it\nas a task: deliver to exactly one worker, delete on ack; per-message\nacknowledgment, redelivery, and fair dispatch across workers — ideal for\nindependent, expensive jobs (encode this video). History is gone by design,\nand redelivery reorders. A log (Kafka-style) treats it as an event —\na fact that happened: append-only, retained regardless of consumption;\nconsumers are just offsets advancing through partitions, so you get\nper-key ordering (card 93), many independent consumer groups reading the\nsame stream, and replay — the superpower that makes derived views\nrebuildable (cards 100, 105). Decision rule: does history have value, and\ndoes per-entity order matter? → log. Independent tasks needing per-message\nack/retry? → queue. Using a log *as* a job queue buys head-of-line blocking\ninside partitions — name that cost." },
  { id: 93, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "How do consumer groups, offsets, and lag relate — and why is the design so operationally pleasant?",
    answer: "A consumer group divides the topic's partitions (not individual\nmessages) among its members: each partition has exactly one reader per\ngroup, so per-partition order survives consumption, and parallelism scales\nto the partition count (more consumers than partitions = idle consumers —\nsize partition counts generously up front). Progress is one committed\noffset per partition — crash recovery is \"resume from offset,\" no broker\nbookkeeping per message, no in-flight ack matrix. Lag = log head minus\ncommitted offset: a single, per-partition staleness metric that tells you\nwhether consumers keep up, how stale derived views are, and how close you\nare to retention loss (card 100). Rebalances (membership changes\nreassigning partitions) are the operational sharp edge — pauses and\nduplicate-processing windows — worth mentioning unprompted." },
  { id: 94, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "Why are dual writes (app writes DB + search + cache) broken?",
    answer: "Two independent failure modes, both silent. Race: concurrent updates\nreach the destinations in different orders — DB applies $30 then $25; the\nsearch index, on its own network schedule, applies $25 then $30. Final\nstates disagree *permanently*, and nothing errors — there's no shared\nserialization point to even notice. Partial failure: the app writes the\nDB, then crashes before the cache call; no transaction spans Postgres,\nElasticsearch, and Redis (2PC across heterogeneous systems is rarely\navailable and operationally grim — card 59), so one copy is stale until\nluck intervenes. Root cause in one sentence: multiple destinations, no\nsingle place where order is decided. The fixes are exactly cards 95\n(derive everything from the DB's own log) and 96 (make the event's creation\natomic with the write)." },
  { id: 95, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "How does change data capture (CDC) fix what dual writes break?",
    answer: "Appoint the database the sole writer-of-record; everything else becomes\na *derived* copy fed from the DB's own ordered history. Mechanism: a\nconnector poses as a replica and tails the logical replication log\n(card 37) — every committed change, in commit order — publishing events into\na durable log, partitioned by key so per-key order survives. All consumers\n(search indexer, cache filler, warehouse loader) apply the same sequence\nin the same order → convergence; a crashed consumer resumes at its offset;\na brand-new consumer bootstraps from an initial snapshot + the log, or from\na compacted topic (card 101). The order problem and the atomicity\nproblem both dissolve because order is decided exactly once — inside the\ndatabase's commit — and merely *propagated* everywhere else." },
  { id: 96, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "Explain the transactional outbox pattern and the problem it solves.",
    answer: "The problem: \"update the database and publish an event, atomically\" —\ndual writes in miniature, since the app crashing between the two leaves\nstate changed but the event unsent (or vice versa). The pattern: within\none local ACID transaction, write the business row *and* insert an\nevent row into an `outbox` table — a single database commit, so both happen\nor neither. A relay then publishes outbox rows to the stream (polling, or\nbetter, CDC on the outbox table itself) and marks them sent; consumers\ndedupe by event ID since the relay is at-least-once. Atomicity is borrowed\nfrom the only place it's cheap — a single database — no 2PC. Choose outbox\nover raw CDC when you want intent-level events (\"OrderPlaced\", richer\nthan row diffs) or can't tail the DB log; they compose fine." },
  { id: 97, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "When is event sourcing the right call — and what are its honest costs?",
    answer: "Event sourcing stores the intents (\"ItemAdded\", \"CouponApplied\") as the\nimmutable source of truth; current state is a *fold* over them. Right when\nhistory is the product: audit-heavy domains (payments, compliance),\ndebugging-by-replay, temporal queries (\"what did the account look like on\nMarch 3?\"), and many independently evolving read models derived from one\ntruth. Honest costs: event schemas become a versioned public API —\nchapter 4's rules with higher stakes, forever; current-state queries need\nmaintained projections; replay time grows with history (mitigate with\nsnapshots: fold once, checkpoint, replay only the tail); and\nimmutability is a discipline — corrections are compensating events,\nnever edits, which audits love and some teams culturally hate. For\nCRUD-shaped domains with no audit need: ceremony without payoff — say so." },
  { id: 98, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "Event time vs processing time — and what is a watermark, really?",
    answer: "Event time = when the thing happened (source timestamp); processing\ntime = when your pipeline handled it. They diverge routinely — offline\nmobile buffers, retries, consumer lag — so windowing by processing time\nrecords *your pipeline's hiccups as user behavior*: a deploy paints a fake\ntraffic dip-then-spike. Event-time windows are honest but raise a new\nquestion: when is the 10:02 window *complete*, given arrival order proves\nnothing? Enter the watermark: a flowing, heuristic assertion — \"we\nbelieve all events with timestamp ≤ T have arrived\" — calibrated from\nobserved lateness; when it passes the window's end, the window fires.\nIt's a latency/completeness dial, and it will sometimes be wrong, so\nevery event-time aggregation owes an explicit straggler policy: drop\n(cheap, slightly wrong), update (re-emit corrected results; downstream\nmust handle revisions), or sideline to a late-output for reconciliation." },
  { id: 99, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "What does Kafka's \"exactly-once\" actually guarantee, and where does it stop?",
    answer: "Two mechanisms. Idempotent producer: per-partition sequence numbers let\nbrokers detect and drop duplicate *resends* of the same batch (retries\nafter lost acks). Transactions: a consume-process-produce loop publishes\nits output messages and commits its input offsets atomically;\n`read_committed` consumers skip aborted data. Net effect:\neffectively-once processing within the Kafka loop — a crash-and-retry\ncan't double-count, because reprocessed output and the offset commit abort\nor land together. Where it stops: the moment results leave for an\nexternal system — a database write, an email, an HTTP call is outside\nthe transaction — those need their own idempotency (deterministic keys,\nupserts, card 63). Naming that boundary unprompted is the senior tell; it's\nalso card 106's opening move." },
  { id: 100, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "A consumer is permanently slower than its producer. What happens, and what do you do?",
    answer: "On a log, the broker doesn't suffer — *you* do, on a timer: lag grows\nmonotonically, your derived views go increasingly stale, and when lag\nexceeds retention, the consumer's next read finds the data already\ndeleted — silent, permanent loss of unprocessed events. Responses, in\norder: scale consumers — bounded by partition count, so you may need to\nrepartition (an operation to plan, not improvise); make processing cheaper\n(batching, async I/O, remove per-event round-trips — the usual culprit);\nshed or sample if the use case tolerates it; raise retention to buy\nrunway (storage cost). The non-negotiable: alert on lag-vs-retention\nheadroom (\"hours until data loss\"), not just absolute lag — the second\nnumber is the one that pages someone in time." },
  { id: 101, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "What is log compaction, and what does a compacted topic give you?",
    answer: "Background compaction keeps, for each key, only the latest value\n(and drops keys whose latest value is a *tombstone* — the deletion marker).\nThe topic stops being \"everything that ever happened\" and becomes \"current\nstate of every key, expressed as a log\" — bounded in size by the keyspace,\nnot by time. What that buys: a bootstrappable changelog — a new consumer\n(fresh cache, new search index, recovering stream-processor state) reads the\ncompacted topic from the beginning and arrives at full current state, no\nseparate snapshot system needed; Kafka Streams persists its state stores\nexactly this way. Limits to name: intermediate history is gone (event\nsourcing wants full retention, possibly tiered); tombstones must be retained\nlong enough for slow consumers to see deletions; compaction is asynchronous,\nso recent duplicates per key still appear." },
  { id: 102, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "\"A table is a view of a stream; a stream is the changelog of a table.\" Unpack the duality.",
    answer: "Fold a changelog (insert/update/delete events) and you get the table's\ncurrent state; record every change to a table and you get a stream — each\nis derivable from the other, which is why this is called stream-table\nduality. It's the WAL idea (every database already *is* a table fed by a\nlog) promoted to an architecture principle. Consequences: stream-processor\nstate is a changelog persisted to a compacted topic (card 101), so\nfailed nodes rebuild state by replay; a cache is a fold of the source's\nCDC stream rather than a thing you invalidate by guesswork; stream-table\njoins (card 103) are really stream-stream joins where one side folds into\nstate. The slogan worth memorizing: *state is a cache of the log; keep the\nlog and every state is disposable.* That's the load-bearing beam under cards\n95, 100, 101, and 105." },
  { id: 103, section: "Stream processing (DDIA ch. 11)", sectionShort: "I",
    question: "Name the three stream join types and the temporal gotcha in stream-table joins.",
    answer: "Stream–stream: correlate two event streams within a time window\n(searches ↔ subsequent clicks); the processor buffers both sides, keyed,\nwith the window bounding state size. Stream–table: enrich events with\nreference data (clicks ↔ user profiles); the table is held as local state,\nkept current by consuming its changelog — CDC again, so really a\nstream-stream join where one side folds into state (card 102).\nTable–table: both sides arrive as changelogs; the maintained result is a\nmaterialized view whose output is itself a changelog. The gotcha:\n\"stream-table\" joins against state-as-of-processing — replay last\nmonth's events today and they enrich against *today's* profiles, so\nreprocessing isn't deterministic. If that matters (it often does for\ncorrectness audits), you need temporal/versioned tables — join each\nevent against the table *as of the event's timestamp* — at real storage\ncost. Naming that trade-off is the differentiator." },
  { id: 104, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "\"Unbundling the database\" — the pitch and the invoice.",
    answer: "Look inside one database: a write updates the WAL, the heap, B-tree\nindexes, materialized views — many structures kept consistent by one\ninternal, ordered log. Real organizations run those *components* as\nseparate products (OLTP store, search, cache, warehouse) — indexes of the\nsame data with the lockstep mechanism missing. The pitch: restore it —\none ordered change log (CDC from the system of record) that every\nspecialized system consumes; same inputs, same order ⇒ convergence (state\nmachine replication, card 78, at org scale). Views become best-of-breed,\nindependently scaled, *rebuildable by replay*, and failure-isolated (a slow\nwarehouse never blocks checkout). The invoice: views lag — no\ncross-view read-your-writes by default; no transactions across views; the\nlog is now tier-zero infrastructure; and event schemas are a public API\ncarrying chapter-4 evolution duties forever." },
  { id: 105, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "Lambda vs kappa — and the invariant beneath both.",
    answer: "The problem both solve: derived views must be recomputed when logic\nchanges (bug fixes, redefined metrics) while staying current. Lambda:\nrun both modes forever — a batch layer periodically recomputes everything\nfrom the immutable raw store (correct, stale) and a speed layer\nstream-processes the recent tail (fresh, approximate); queries merge the\ntwo. Cost: the *same business logic implemented twice* in two frameworks\nthat drift subtly, plus merge complexity. Kappa: one replayable log with\nlong retention; new logic = start a second job from offset 0, let it rebuild\nthe view in parallel, then switch reads atomically and retire v1.\nLambda made sense when stream processors were lossy; once logs got cheap\nretention and streaming got exactly-once state (card 99), the dual-codebase\ntax stopped buying correctness. The invariant either way — say it —\nimmutable raw input + rebuildable views = the freedom to be wrong and\nrecover." },
  { id: 106, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "Your broker is exactly-once and your DB is ACID — explain how a user still gets double-charged, and the fix.",
    answer: "Walk the layers. The user taps *pay*; the response is lost; the client (or\nhuman) retries — two requests born above every guarantee. TCP deduped\nretransmissions *within each connection* — the retry was a new connection.\nThe load balancer routed it to a different healthy instance. The service\npublished two *distinct* messages; the broker's exactly-once faithfully\ndelivered both (its sequence numbers dedupe only its own resends — card 99).\nEvery layer kept its scoped promise; the duplicate sailed through because it\nwas created above all of them. That's the end-to-end argument\n(Saltzer, Reed & Clark, 1984): functions like duplicate suppression can only\nbe completed at the endpoints, with application knowledge; lower layers can\noptimize, never own. The fix: the client mints an operation ID at the\nmoment of intent; every hop carries it; the final write enforces it —\n`op_id UNIQUE`, insert-or-return-original — making retries safe at every\nlayer. *The request ID is the truth; everything below is transport.*" },
  { id: 107, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "Distinguish timeliness from integrity, and show how the split changes a design.",
    answer: "Two properties hiding inside \"consistency\". Timeliness: readers see\nup-to-date state. Violations are *self-healing* — a stale read fixes itself\nby waiting; products tolerate astonishing amounts of it (your bank statement\nis \"as of yesterday\"). Integrity: the data is *right* — nothing lost,\nnothing double-counted, derived state actually corresponds to its sources.\nViolations are permanent until explicitly repaired, and tolerance is\nnear zero. Design consequence: spend coordination on integrity, relax\ntimeliness as far as the product allows. Example: an analytics pipeline may\nlag minutes (timeliness relaxed, async log) but must never double-count\nrevenue (integrity absolute: exactly-once processing + idempotent sink + end-\nto-end IDs). A pre-trade risk check inverts it — it needs *now*, so that one\npath pays for linearizable reads. The most common over-engineering in system\ndesign is buying timeliness nobody asked for; the most common silent failure\nis gambling integrity to avoid it." },
  { id: 108, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "Enforce \"usernames are unique\" at scale without a distributed lock.",
    answer: "Let a log decide. Partition a `username-claims` topic by\n`hash(username)`: all claims for a given name land in one partition, in\none total order (per-partition order is the cheap guarantee — card 92). A\nsingle-threaded-per-partition processor reads claims in order, grants the\nfirst, rejects the rest, and emits accepted/rejected events the application\nawaits. That's linearizable *for that key* — consensus-grade ordering\nborrowed from the log's own replication (card 78) — while scaling\nhorizontally across keys, with no lock service in the request path. Name\nthe boundary: constraints spanning partitions (transfer between two\naccounts) need either multi-partition transactions or the apologies\npattern — allow the rare violation, detect it from the log, compensate\n(how airlines oversell and banks reconcile). Coordination buys certainty\nbefore the fact; apologies buy availability and absorb the faults\ncoordination can't reach anyway." },
  { id: 109, section: "Architecture, correctness & the future (DDIA ch. 12)", sectionShort: "J",
    question: "How does \"delete this user\" actually work in an immutable-log architecture?",
    answer: "Replay-everything collides head-on with erasure rights (GDPR's storage\nlimitation and right to erasure) unless deletion is *designed as a data-flow\nfeature*. The standard toolkit: crypto-shredding — encrypt each user's\ndata under a per-user key; deletion = destroy the key, instantly rendering\nevery log entry, derived view, *and backup* unreadable without touching\nthem; tombstones on compacted topics (card 101) so current-state\nchangelogs actually drop the keys (retain tombstones long enough for slow\nconsumers); bounded retention on raw topics so history ages out by\npolicy; and deletion events that every derived view must consume and\nhonor — with verification by replay/audit that they did. The interview\npoint: in a log-centric architecture, deletion is propagation with\nacceptance criteria — \"where does this user's data flow, and how do I prove\nit's gone everywhere?\" — not a `DELETE` statement.\n*Bonus drill once the deck is easy: pick any card and answer the standing\nstaff follow-ups — \"what do you monitor for this?\", \"what breaks at 10×?\",\nand \"what would make you choose the other option?\" Then chain cards: trace\none payment from the client tap through retries (63–64), the outbox (96),\nthe log (92–93), exactly-once processing (99), and the end-to-end ID that\nmakes the whole chain safe (106). Being able to walk that chain fluently is\nworth more than any single card.*" },
];

/* ─── Section metadata ─── */
const SECTIONS = [
  { id: "A", label: "Foundations & storage engines (DDIA ch. 1–3)", full: "Foundations & storage engines (DDIA ch. 1–3)", count: 11 },
  { id: "B", label: "Encoding & schema evolution (DDIA ch. 4)", full: "Encoding & schema evolution (DDIA ch. 4)", count: 8 },
  { id: "C", label: "Replication (DDIA ch. 5)", full: "Replication (DDIA ch. 5)", count: 19 },
  { id: "D", label: "Partitioning / sharding (DDIA ch. 6)", full: "Partitioning / sharding (DDIA ch. 6)", count: 10 },
  { id: "E", label: "Transactions (DDIA ch. 7)", full: "Transactions (DDIA ch. 7)", count: 13 },
  { id: "F", label: "The trouble with distributed systems (DDIA ch. 8)", full: "The trouble with distributed systems (DDIA ch. 8)", count: 13 },
  { id: "G", label: "Consistency & consensus (DDIA ch. 9)", full: "Consistency & consensus (DDIA ch. 9)", count: 12 },
  { id: "H", label: "Batch processing (DDIA ch. 10)", full: "Batch processing (DDIA ch. 10)", count: 5 },
  { id: "I", label: "Stream processing (DDIA ch. 11)", full: "Stream processing (DDIA ch. 11)", count: 12 },
  { id: "J", label: "Architecture, correctness & the future (DDIA ch. 12)", full: "Architecture, correctness & the future (DDIA ch. 12)", count: 6 }
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
      <div className="min-h-screen flex flex-col items-center px-4 pt-24 md:pt-32 pb-12 md:pb-16">
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
              <a
                href="/interview-high-level"
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#1c2f37] text-[#8aa6b0] hover:border-[#2a4651] hover:text-[#f2fafc] transition-all"
              >
                High-Level Deck
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
