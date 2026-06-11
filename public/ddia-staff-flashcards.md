# DDIA Staff-Engineer Flashcards (Expanded Edition)

109 question/answer cards distilled from *Designing Data-Intensive Applications*,
weighted toward what staff-level interviews actually probe: trade-offs, failure
modes, guarantees-vs-folklore, and production judgment. Answers are written to
**teach**, not just test — each one gives the intuition, the mechanism, and the
trade-off, and most end with a *Go deeper* link to a primary source (paper,
official docs, or a canonical engineering post) so any gap can be closed
immediately. Every link was verified to be real. Standalone file — no
dependency on anything else.

## How to use this deck

- **Active recall:** read the question, answer *out loud in interview voice*,
  then check. Speaking the answer is rehearsal for the real thing; rereading
  answers is not studying.
- **Spaced repetition:** review misses the next day, passes at growing
  intervals (1 → 3 → 7 → 14 → 30 days). A Leitner box on paper or Anki both
  work — this file converts trivially (Q = front, everything below = back,
  section = tag).
- **One idea per card:** prompts are atomic; answers are deliberately richer
  than classic flashcards because staff loops grade trade-off *narratives*.
  Treat the **bolded terms** as must-say keywords and the rest as connective
  tissue. If a long answer won't stick, split the card.
- **Interleave:** shuffle across sections rather than drilling one topic —
  mixed practice transfers better to interviews, which jump topics freely.
- **Grade honestly, then re-derive:** on a miss, don't reread — re-derive from
  first principles (what fails? who pays?) and re-test tomorrow. Use the *Go
  deeper* link only when the re-derivation exposes a real gap.
- **Escalate to scenarios:** once a card is easy, ask the standing staff
  follow-ups: "what do I monitor for this?", "what breaks at 10×?", "what
  would make me choose the other option?"

---

## A. Foundations & storage engines (DDIA ch. 1–3)

**1. Why do we report p95/p99 latency instead of the average?**
Because the average hides exactly the users who are suffering. Latency
distributions are heavily skewed: most requests are fast, a few are very slow
(GC pauses, page faults, queueing, a cold cache), and the mean gets dragged
around by neither group informatively. Worse, modern pages **fan out**: one
user action touches dozens of backend calls, so the probability of hitting at
least one slow call approaches certainty — the service's p99 becomes the
*user's typical experience*. This is **tail latency amplification**. So SLOs
are written against percentiles (p95/p99/p999), capacity planning targets the
tail, and tail-tolerant techniques exist specifically for it: hedged requests,
request replication to the fastest replica, and tied requests.
*Go deeper:* [Dean & Barroso — The Tail at Scale (CACM 2013)](https://cacm.acm.org/research/the-tail-at-scale/)

**2. Design question: push vs pull for a social feed (the fan-out problem)?**
The question is *when* you pay the join between "people I follow" and "their
posts". **Push (fan-out on write):** when someone posts, insert it into every
follower's precomputed timeline — reads are a cheap single lookup; writes cost
O(followers), which is catastrophic for a 50M-follower account (one post = 50M
inserts). **Pull (fan-out on read):** store posts once; build the timeline at
read time by querying everyone you follow — writes are O(1), reads are
expensive and hit hot accounts constantly. The staff answer is the **hybrid**:
push for ordinary users (bounded follower counts), but flag celebrity accounts
and merge their posts in at read time. This is a general pattern: precompute
for the common case, special-case the power law's head, and accept that the
boundary needs tuning and monitoring.

**3. B-tree vs LSM-tree: core trade-off?**
Two philosophies of "where do writes go". **B-trees** update fixed-size pages
**in place**: reads are predictable (one tree descent), each key lives in
exactly one place (easier transactional locking), and decades of tuning back
them — but random writes mean random I/O, and every page touch may rewrite a
whole page. **LSM-trees** never update in place: writes land in an in-memory
**memtable**, get flushed as sorted immutable files (**SSTables**), and
background **compaction** merges files and discards overwritten values.
Sequential writes give much higher write throughput and better compression
(no half-empty pages) — but reads may consult several files, and compaction
competes with live traffic for disk bandwidth, causing latency spikes when
mis-tuned (or, worse, falling behind until disk fills). Rule of thumb:
write-heavy / append-mostly → LSM (Cassandra, RocksDB); read-heavy with strong
transactional needs → B-tree (Postgres, MySQL/InnoDB). Measure on *your*
workload — the crossover is real but workload-dependent.

**4. What is write amplification and why does a staff engineer care?**
One logical write becoming multiple physical writes. B-trees: changing one row
rewrites its whole page (and possibly parents on splits) plus the WAL.
LSM-trees: the same value is rewritten every time compaction moves it down a
level — easily 10–30× over its lifetime. Why care: physical write bandwidth is
a hard resource, so amplification is often the *hidden ceiling* on sustained
write throughput — the reason "the disk is at 100% but we're only doing 5k
writes/sec" — and on SSDs it directly burns device endurance. It's also a
tuning lever: LSM compaction strategy choices (card 9) trade write
amplification against read amplification and space amplification. When someone
proposes "just log everything", this is the number to ask about.

**5. Every index you add does what to your write path?**
Slows it, permanently. Each write must now also update every index — more
structures, more pages or SSTable entries, more write amplification, more lock
or latch work. Indexes also consume cache/RAM that data pages wanted.
The framing that lands in interviews: an index is a **read optimization
purchased with write cost and storage**, i.e. a derived data structure the
database maintains synchronously. So: derive them from real query patterns
(not speculation), audit and drop unused ones like dead code, and on
write-hot tables treat each additional index as a capacity decision. The same
logic, scaled out, becomes chapter 12's "derived views" — a search index is
just this trade-off made asynchronous and distributed.

**6. Normalize or denormalize at scale?**
**Normalize** to keep each fact in one place: updates are cheap and can't
miss a copy; joins reconstruct what you need. **Denormalize** to co-locate
data with its reads: fewer joins, fewer round-trips, better cache behavior —
at the price of duplicated facts that must be updated everywhere, every time.
The staff insight is that at scale this stops being a schema debate and
becomes a **derived-data pipeline problem**: you usually keep a normalized
source of truth *and* denormalized read-optimized copies (caches,
materialized views, search documents), and the real engineering is keeping
the copies in sync — which is exactly the dual-writes/CDC territory of cards
94–96. Denormalization without a sync strategy is how data quietly forks.

**7. "Schemaless" databases — what actually happened to the schema?**
It didn't disappear; it moved, unenforced, into every reader. This is
**schema-on-read**: the database stores whatever shape arrives, and each
consumer carries implicit assumptions about field names, types, and presence.
Validation failures shift from explicit write-time errors to runtime
surprises in consumers — often months later, in a different team's code.
That's a legitimate trade for genuinely heterogeneous or rapidly evolving
data (it's also how data lakes work, card 91's cousin), but it must be chosen
knowingly: pair it with validation at boundaries, versioned event/document
schemas, and tolerant readers. "Schemaless" is best pronounced "schema moved
to the readers".

**8. Walk the read path of an LSM-tree. What keeps it from being slow?**
A key might be in the memtable, or any SSTable, so the read checks **newest to
oldest**: memtable → most recent SSTable → older ones, returning the first
hit (newest value wins; deletes are **tombstone** markers found the same way).
Unbounded, that's many file probes per read — so three mechanisms bound it:
**Bloom filters** per SSTable (a tiny probabilistic "definitely not here /
maybe here" check that skips most files with ~1% false positives), **sparse
in-file indexes** (SSTables are sorted, so a small index plus binary search
finds the block), and **compaction** (merging files keeps the count of places
to look small). Staff-level connection: a read-heavy workload on an LSM store
lives or dies by Bloom-filter memory and compaction keeping up — "reads got
slow" is often "compaction fell behind".

**9. Size-tiered vs leveled compaction — what's being traded?**
Compaction strategy decides *when* overlapping SSTables get merged, trading
the three amplifications against each other. **Size-tiered**: collect several
similar-sized SSTables, merge into a bigger one. Cheap on writes (each value
is rewritten few times) but reads may consult many overlapping files and disk
usage spikes during merges (space amplification) — good for write-heavy,
read-tolerant workloads. **Leveled**: organize into levels of
non-overlapping, fixed-size runs; a key lives in at most one SSTable per
level. Reads check few files (low read amplification) and space overhead is
small, but values are rewritten at every level — high write amplification —
good for read-heavy workloads. The interview move is naming the triangle:
**write amp vs read amp vs space amp; compaction strategy picks your corner.**

**10. Why does column-oriented storage dominate analytics?**
Analytical queries read **few columns of very many rows** ("sum revenue by
region for 2 years"), while row stores fetch entire wide rows to use two
fields. Storing each column contiguously means: only the needed columns are
read from disk; values within a column are self-similar, so **compression is
dramatic** (run-length, dictionary, bitmap encodings); and CPUs chew through
compressed columnar blocks with **vectorized** execution. Writes get harder —
updating one "row" touches many column files — which is why column stores
ingest in batches/buffered loads (often LSM-style) rather than OLTP-style
updates. One sentence to carry: *row stores optimize for retrieving an
entity; column stores optimize for scanning an attribute.*

**11. OLTP vs OLAP — and why do they end up as separate systems?**
**OLTP**: many small, low-latency, index-driven reads/writes of individual
records — the application's live state, availability-critical. **OLAP**: few
huge scan-and-aggregate queries over history, run by analysts and pipelines.
They conflict on every axis — access pattern (point vs scan), storage layout
(row vs column, card 10), tuning, and blast radius: one analyst's
table-scan can flatten the latency of checkout. Hence the **data warehouse**:
a separate analytical store fed by ETL/ELT or CDC from production systems,
modeled for scans (star schemas: fact table + dimension tables). The staff
follow-up to anticipate: *how* it's fed and how fresh it is — nightly batch vs
streaming CDC — which is exactly the chapter 11 material (cards 94–95).

---

## B. Encoding & schema evolution (DDIA ch. 4)

**12. Define backward and forward compatibility, and explain why a rolling upgrade needs both.**
**Backward:** new code can read data written by old code. **Forward:** old
code can read data written by new code. You need both because of two facts.
First, deploys roll: during any upgrade, versions N and N+1 run
*simultaneously*, and each is sometimes writer and sometimes reader — via
database rows, RPC responses, and queued messages. Second, **data outlives
code**: rows written five years ago are still read today, so backward
compatibility is effectively forever, and old code lingers (mobile clients
update on the user's schedule, sometimes never), so forward compatibility
lasts years too. The practical corollary: every schema change must be safe in
*both* directions on the day it ships, not after the fleet converges —
because the fleet never fully converges.

**13. How does an old Protobuf reader survive a field it has never seen?**
Every encoded field starts with a tag byte combining the **field number** and
a **wire type**. The old reader doesn't recognize the number, but the wire
type tells it mechanically how to **skip**: varint → read until the
terminator bit; length-delimited → read the length, jump that many bytes. So
parsing continues unharmed — that skip rule *is* forward compatibility in
tagged formats. One subtlety worth saying out loud: a well-behaved
implementation **preserves** unknown fields when it re-serializes, otherwise
an old service doing read-modify-write silently erases data that newer code
wrote (a real production bug class, especially with ORMs that map rows to
fixed structs).
*Go deeper:* [Protocol Buffers — Language Guide (proto3)](https://protobuf.dev/programming-guides/proto3/)

**14. Why is reusing a retired Protobuf field number catastrophic, and what's the safeguard?**
The field number is the wire contract — names never appear in the bytes.
Historical data where tag 3 meant `team: string` still exists in databases,
queues, backups, and on devices. If a new schema reuses tag 3 as
`score: int32`, every old record decodes those string bytes as an integer:
**silent garbage**, no exception, possibly persisted onward and spread by
pipelines. "Silent" is the operative horror — fresh test data never triggers
it. Safeguard: when deleting a field, declare `reserved 3;` (and reserve the
name) so the compiler rejects any future reuse; same logic behind "never
change a field's type" and why proto3 removed `required` (a new required
field makes all historical data unreadable — a backward-compat landmine).
*Go deeper:* [Protocol Buffers — Proto Best Practices: Dos and Don'ts](https://protobuf.dev/best-practices/dos-donts/)

**15. Why do APIs ship 64-bit IDs as strings in JSON?**
JSON has one number type, and JavaScript backs it with an IEEE-754 double:
integers are exact only up to **2⁵³ − 1** (9,007,199,254,740,991).
Snowflake-style 64-bit IDs exceed that, so an ID round-tripped through a JS
client can come back silently off by a few — the client then references a
*different entity*, which is a corruption bug, not a display bug. Hence the
industry convention: serialize large integers as strings (or send both
`id` and `id_str`). General lesson for the interview: textual formats have
quietly lossy type systems (no int/float distinction, no binary without
Base64), and these gaps cause real incidents, not just inefficiency.
*Go deeper:* [MDN — Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)

**16. What does a schema registry actually enforce, and when?**
Two jobs. **Delivery:** stream messages are tiny, so embedding a schema per
message is absurd — instead each message carries a small **schema ID**;
producers register schemas and get IDs; consumers fetch-and-cache the
writer's schema by ID and resolve it against their own. **Enforcement:** the
registry is configured with a compatibility mode per subject (backward,
forward, full) and **rejects an incompatible schema at registration time** —
turning what would be a 3 a.m. consumer crash (or worse, silent
misparsing) into a failed CI step for the producer team. That shift-left is
the strategic point: compatibility becomes a property *checked by
infrastructure at publish time*, not a hope distributed across consumer
teams.

**17. Avro matches fields by name; Protobuf by number. What does each buy you?**
**Numbers (Protobuf/Thrift):** the wire stays tiny and stable, names are free
to change — but humans must allocate field numbers and guard them forever
(card 14). Perfect for hand-maintained service contracts. **Names (Avro):**
no tags on the wire at all — just values in schema order — so decoding
requires the **writer's schema**, which the reader *resolves* against its own
reader schema: fields matched by name, writer-only fields skipped,
reader-only fields filled from declared **defaults** (no default ⇒ that's
precisely an incompatible change). The payoff: with no number bookkeeping,
schemas can be **machine-generated** — e.g. from a database table's columns
on every export — making Avro the natural format for data pipelines that
dump evolving relational data. The cost: renames break compatibility unless
aliased, and the writer's schema must travel (file header for big files,
registry ID for streams).
*Go deeper:* [Apache Avro specification — schema resolution](https://avro.apache.org/docs/1.11.1/specification/)

**18. Name the three dataflow modes data passes through, and where compatibility bites in each.**
**Through databases:** the writer is your past, the reader your future. Old
rows aren't rewritten when columns are added — reads fill defaults — and the
trap is old code doing read-modify-write and dropping fields it doesn't know.
Data here outlives code by *years*, the longest compatibility horizon.
**Through services (REST/RPC):** servers usually deploy before clients — and
mobile clients lag for years — so servers need forward-compatible request
parsing and clients need backward-compatible response parsing.
**Through async messages:** a queue is a time capsule — messages written
before a deploy are consumed after it, and dead-letter replays resurrect the
truly ancient; consumers effectively face an archive, not a peer. That's why
schema registries with enforced compatibility matter most exactly here.
Interview framing: *every boundary where bytes outlive or outrun code is an
evolution boundary.*

**19. RPC looks like a local function call. Why is that abstraction dangerous, and what do modern frameworks do about it?**
A local call either returns or throws, takes predictable time, and passes
references. A network call can **time out with unknown outcome** (the request
may have executed — chapter 8's ambiguity), duplicate on retry, reorder,
and must serialize everything. Pretending these away is how systems end up
with double-charges and hangs. Modern RPC (gRPC on Protobuf) keeps the
convenient syntax but surfaces the network: explicit **deadlines** propagated
through call chains, cancellation, streaming, and retry policies you must
configure — plus schema-driven evolution so old and new clients coexist
(cards 13–14). The staff answer treats RPC as "a convenient codec + transport
with the network's failure modes intact", and designs idempotency and
timeouts as part of the API, not an afterthought.
*Go deeper:* [gRPC — grpc.io](https://grpc.io/)

---

## C. Replication (DDIA ch. 5)

**20. What is semi-synchronous replication and why is it the standard compromise?**
Fully synchronous replication (leader waits for *every* follower) means any
one follower being slow or dead blocks all writes — availability hostage to
the weakest node. Fully asynchronous means an acknowledged write may exist
only on the leader — durability hostage to one disk. **Semi-synchronous**:
exactly one follower is synchronous (the leader waits for its ack before
confirming), the rest are async. Every acknowledged write is guaranteed on
≥2 nodes; if the sync follower slows, *swap which follower is sync* rather
than stopping the world. PostgreSQL exposes this directly via
`synchronous_commit` and `synchronous_standby_names` — even per-transaction,
so you can pay the sync tax only for writes that deserve it.
*Go deeper:* [PostgreSQL docs — warm standby / streaming replication](https://www.postgresql.org/docs/current/warm-standby.html)

**21. What can be lost in an async-replication failover, and why is "discard the divergent writes" more radical than it sounds?**
The promoted follower may lack writes the old leader **acknowledged** —
clients were told "committed". Common practice discards the old leader's
divergent tail so it can rejoin as a follower. That quietly *revokes
durability*: if anything external consumed those writes — an email sent, a
cache warmed, an ID handed out, another system's counter — the outside world
now permanently disagrees with the database. GitHub's October 2018 incident
is the canonical case study: a ~43-second network partition led to writes on
two sides that could not be trivially reconciled, and a day of degraded
service while data was repaired. Staff takeaways: monitor what your sync
guarantee actually is; reconciliation of acked-but-lost writes is an
*application-level* problem; and cross-system invariants need end-to-end IDs
(card 106), not faith in failover.
*Go deeper:* [GitHub — October 21 post-incident analysis](https://github.blog/2018-10-30-oct21-post-incident-analysis/)

**22. What is split brain, and what actually prevents it?**
Two nodes simultaneously believing they're the leader and accepting writes —
typically after a partition or a botched failover — producing divergent,
possibly unmergeable histories. Prevention is never "the old leader will
notice": a partitioned or paused node *can't* notice (card 67). Real
defenses: **epochs/terms** (each election increments a number; replicas and
storage reject messages from older epochs), **quorum-based election** (a new
leader requires a majority, and majorities overlap, so the old leader can no
longer assemble one), and **fencing** at shared resources (card 68). Some
stacks add STONITH ("shoot the other node in the head") as a blunt backstop.
The principle: leadership must be *enforced where the writes land*, not
believed where the leader runs.

**23. Why is the failover timeout a trap in both directions?**
Failure detection is just a timeout (card 62), so you're tuning a guess. Too
short: a load spike, GC pause, or transient network blip looks like leader
death → spurious failover → cold caches, client reconnections, possible
lost-write reconciliation — *additional load and risk precisely when the
system is already stressed*, sometimes cascading into failover ping-pong. Too
long: real outages extend by your timeout. There is no correct constant —
only a trade-off tuned to your failure modes — which is why many mature
operations keep a human approving failover, automate everything *around* the
decision (detection, runbooks, traffic shift), and rate-limit automatic
failovers. Saying "I'd make failover automatic and fast" without this caveat
is a classic mid-level tell.

**24. A user posts a comment, reloads, and it's gone. Name the anomaly and the standard fixes.**
**Read-your-writes (read-after-write) violation**: the write went to the
leader; the immediate read was load-balanced to a follower still behind by
the replication lag. To the author it looks like data loss — far worse than
generic staleness. Fixes, cheapest first: route reads of *content the user
can edit* (own profile, own comments) to the leader; or track each user's
last-write position (log sequence number) and serve them only from replicas
that have applied past it, waiting or falling through to the leader
otherwise; or sticky-route the user's session to one sufficiently fresh
replica. Note the scope: this is a **session guarantee** — a per-user
promise, vastly cheaper than global consistency, and usually all the product
needs.

**25. Why does read-your-writes get harder across devices, and what's the fix?**
The user posts on their phone and immediately checks on their laptop. Any
per-connection trick — sticky sessions, a client-remembered timestamp — fails
because the second device shares none of that state, and with multi-DC
routing the two devices may not even hit the same datacenter. The fix is to
make the tracking **server-side and user-centric**: on each write, record the
user's last-write position centrally; on each read from *any* device, pick a
replica caught up past it (or wait/leader-read). Plus routing discipline:
pin the user (not the device) to a home region so the metadata and data
converge somewhere. The deeper lesson generalizes: session guarantees are
per-*user* promises, so the state that implements them must live where all
the user's sessions can see it.

**26. A live scoreboard shows 1–0, then 0–0 on refresh. Anomaly and fix?**
**Monotonic reads violation.** Successive reads were load-balanced to
replicas with *different* lag — the second one further behind — so the user
moved backwards in time; a goal "un-happened". This is more disorienting
than uniform staleness, and it breaks client logic that assumes state only
advances. The standard fix is one line of routing: make each user's reads
**sticky** — `hash(user_id) → replica` — so every user rides a single
timeline that may pause but never rewinds. Mind the failover edge: if the
pinned replica dies, its replacement must be at least as fresh, or you carry
a read-position token to enforce monotonicity explicitly. Weaker than
linearizability, stronger than plain eventual consistency — and almost free.

**27. In a sharded chat, an observer sees the answer before the question. Anomaly and fix?**
**Consistent-prefix violation.** The question went to partition 1, the reply
to partition 2; each partition replicates at its own pace, and the reply's
partition synced to the observer's region first — so causality appears
inverted (effect before cause). Single-partition systems get prefix ordering
for free from the shared log; sharding removes the shared log and the free
ordering with it. Fixes: write causally related events to the **same
partition** (one conversation → one shard — usually the right modeling
anyway, and it restores per-conversation order, card 44); or carry explicit
causal dependencies ("this reply depends on message 17") and have readers
delay display until dependencies arrive. Full causal consistency machinery
exists (cards 84), but the partition key is the 90% fix.

**28. When is multi-leader replication actually justified, and what's the bill?**
Justified when writes must succeed *locally* despite WAN distance or
disconnection: **multi-region** apps (cross-ocean write latency is physics;
a region must survive losing its peers), **offline-first** clients (a phone's
local DB is a leader that syncs later), and **collaborative editing** (every
cursor is a writer). The bill: the same record can now legally be written in
two places concurrently, so you owe a **convergence story** (card 29) for
every write path, plus operational complexity (replication topologies,
conflict monitoring). Netflix's active-active architecture is the canonical
field report — note how heavily it leans on routing users to a home region
and tolerating eventual consistency, i.e. *designing conflicts out* rather
than merging them heroically.
*Go deeper:* [Netflix Tech Blog — Active-Active for Multi-Regional Resiliency](https://medium.com/netflix-techblog/active-active-for-multi-regional-resiliency-c47719f6685b)

**29. Two datacenters concurrently rename the same record. Walk the three honest resolutions.**
There's no shared queue, so neither write is "later" — they're concurrent,
and you must choose: **(1) Last-write-wins:** attach timestamps, keep the
max, everywhere. Converges, but silently destroys an acknowledged write, and
the clocks deciding "last" skew (card 30). Fine for caches and telemetry;
negligent for data you promised to keep. **(2) Keep both + merge:** detect
concurrency with **version vectors** (card 31), store conflicting values as
*siblings*, and have application code or the user merge. Lossless and
honest; someone must write and maintain merge logic (CRDTs, when the data
type fits, make the merge automatic and provably convergent —
[crdt.tech](https://crdt.tech/)). **(3) Avoid:** route all writes for a given
record to one *home* leader — per-record single-leader; conflicts only
resurface on re-homing. Whatever you choose must be **deterministic and
identical at every replica**, or replicas diverge forever.

**30. Why is last-write-wins dangerous beyond "you lose a write"?**
Three compounding reasons. The loss is **silent** — no error, no log entry,
no metric; the discarded value simply ceases to exist, so you can't even
audit how often it happens. The ordering is a **lie**: "last" is decided by
timestamps from clocks that skew (card 65), so the surviving write may
actually be the older one — LWW doesn't even reliably implement its own
semantics. And it converts *acknowledged* writes into casualties: the client
was told "OK". Acceptable when the data is overwrite-by-nature (latest
sensor reading, cache entries); for user data, the interview-grade answer is
version vectors + explicit merge, or conflict avoidance — and if you must use
LWW, generate timestamps in one place (the storage node, not clients) to at
least bound the damage.

**31. What question do version vectors answer that timestamps and plain version numbers can't?**
Whether two writes are **causally ordered or concurrent** — which is the
only fact that tells you if an overwrite is safe. Mechanism: one counter per
writer (replica/leader); each write increments its own slot and carries the
vector. Compare two vectors: if A ≥ B in every slot, B *happened-before* A —
overwriting B is safe, no information lost. If each wins somewhere
({EU:4,US:7} vs {EU:3,US:8}), they're **concurrent** — keep both as siblings
for merging. A single timestamp or counter collapses many timelines into one
number and thus *guesses*; a vector makes causality computable. This is also
the honest answer to "how does Dynamo/Riak know to keep siblings" and the
foundation under card 29's option 2.

**32. What does w + r > n actually guarantee — and what doesn't it?**
Setup: leaderless replication, n replicas, writes succeed on w acks, reads
query r nodes and keep the newest version. If **w + r > n**, any read quorum
*overlaps* any successful write quorum in ≥1 node — so every read sees at
least one copy of the latest fully-acknowledged write (version numbers pick
it). That's the guarantee: **overlap**. Not guaranteed: **linearizability**
(concurrent and partially-failed writes interleave so that one client sees
new data and a *later* client sees old — card 75's definition fails), and
**bounded staleness** (sloppy quorums, card 33, and writes that died at 1 of
2 acks leak staleness past the math — note there's no rollback: "failed"
writes linger on whichever replicas took them). The phrase that lands:
*quorums give overlap, not ordering.*
*Go deeper:* [Amazon Dynamo paper (SOSP 2007)](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)

**33. What is a sloppy quorum with hinted handoff, and what does it cost?**
During a partition, a client may reach w nodes — just not the *home* nodes
for the key. A **sloppy quorum** accepts the write on substitute nodes, each
storing a **hint**: "this belongs to node C; deliver when it's back." You
rescue write availability and durability (the bytes live on w disks
somewhere). The cost: w acks no longer guarantee overlap with the home set,
so a read quorum against the proper replicas can miss the write entirely
until handoff completes — the w+r>n math silently stops applying. It's
"durable now, consistent later". Dynamo-family systems make this a
per-operation choice; the staff answer is knowing it's *on by default* in
some systems and saying which of your reads can tolerate the gap.

**34. Read repair vs anti-entropy — why do you need both?**
Two healing mechanisms for leaderless systems (where there's no leader log
to replay). **Read repair:** a quorum read that observes a stale replica
writes the newest value back to it — free, immediate, but only touches keys
that *get read*. **Anti-entropy:** a background process compares replicas —
**Merkle trees** make "what differs?" cheap by comparing hash trees instead
of all data — and syncs differences, covering keys nobody reads. Read repair
alone means "node was down an hour" becomes "rarely-read keys are wrong for
months, discovered during an audit"; anti-entropy alone heals hot keys too
slowly. Together: hot path self-heals instantly, cold data converges in the
background. Monitoring hook: anti-entropy backlog is a real health metric.

**35. Replication lag jumps from 50 ms to 4 minutes. What breaks first, and what do you do?**
Order of breakage: **read-your-writes** (users' fresh actions vanish on
reload — support tickets begin), then **monotonic reads** (load balancing
across unevenly lagged replicas makes state flap), then any business logic
that read replicas assuming freshness — fraud checks, inventory displays,
"did they already pay?" lookups. Response, in order: shift critical-path
reads to the leader (mind its capacity); enforce a **max-lag threshold that
ejects replicas from the read pool** (serving fewer, fresher replicas beats
many stale ones); shed or degrade non-essential read features; then find the
cause — usually a long-running transaction holding back the apply position, a
schema migration, a bulk load, or an under-provisioned follower. The
prepared-engineer tell: you already had per-replica lag alerting and a
documented threshold before the incident.

**36. How do you add a new follower (or recover a crashed one) without downtime?**
Never by naively copying live data files — they're changing underneath you.
The standard dance: take a **consistent snapshot** of the leader (without
locking writes; databases support this), note the snapshot's exact **position
in the replication log** (Postgres: LSN; MySQL: binlog coordinates), restore
the snapshot on the new node, then **replay the log from that position**
until caught up — at which point it streams live like any follower. A crashed
follower recovers the same way from its own last-applied position. Two
operational gotchas worth naming: the leader must *retain* log segments long
enough to cover snapshot transfer (retention vs disk pressure), and initial
catch-up consumes leader I/O and network — schedule big follower builds off
peak.

**37. Statement-based vs WAL shipping vs logical (row-based) replication — why does the choice matter?**
**Statement-based** ships SQL text: compact, but nondeterminism breaks it —
`NOW()`, `RANDOM()`, auto-increments, and triggers can evaluate differently
on replicas, silently diverging them. **Physical WAL shipping** ships the
exact byte-level changes: deterministic and fast, but it couples replicas to
the *same storage engine version* — you can't run mixed versions, which
blocks zero-downtime major upgrades. **Logical (row-based)** ships "row X in
table Y changed from A to B": version-tolerant (upgrade replicas first, then
fail over), engine-independent, and — the strategic payoff — *consumable by
external systems*, which is exactly what change-data-capture taps (card 95).
Staff framing: logical replication is the bridge from "database internals"
to "data integration".

**38. What does "eventual consistency" actually promise, and how do you operate a system built on it?**
A deliberately weak promise: *if writes stop, replicas converge* — with **no
bound on when**, and no guarantees about what reads see meanwhile. The term
names the absence of timeliness guarantees, not a quality bar (Werner
Vogels' essay — which also coined the session-guarantee vocabulary of cards
24–27 — frames these as explicit, purchasable consistency levels). Operating
it well means: **measure the lag** (leader-vs-replica apply positions in
seconds and bytes; in leaderless systems, proxy metrics like read-repair
rates and anti-entropy backlog, since there's no log to lag behind);
**alert on thresholds tied to product promises** ("profile edits visible
within 5 s"); and design the few flows that can't tolerate the window onto
session guarantees or leader reads, on purpose, with the cost stated.
*Go deeper:* [Werner Vogels — Eventually Consistent](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html)

---

## D. Partitioning / sharding (DDIA ch. 6)

**39. Key-range vs hash partitioning: the core trade?**
**Key-range** assigns contiguous key spans to partitions: preserves sort
order, so range scans ("all events for March") hit one or few partitions —
but real-world keys are skewed, and *sequential* keys (timestamps,
auto-increment IDs) hammer the newest partition while old ones idle.
**Hash** partitioning scatters keys uniformly: load spreads beautifully, but
adjacency dies — range queries become scatter-gather across everything. The
production pattern is the **compound key**: hash a coarse component to
spread load, range-sort within it — `(user_id, timestamp)` spreads users
across partitions while keeping each user's history contiguous and
scannable. Lead with that hybrid; it shows you've actually modeled a
workload.

**40. Why is `hash(key) mod N` a rebalancing disaster, and what's used instead?**
Because N appears in every key's address: change node count by one and
almost **every key remaps** → a full-cluster data migration on every scale
event, saturating disks and networks exactly when you're trying to add
capacity. Alternatives move only what must move: **fixed logical
partitions** — create many more partitions than nodes (say 1,000 for 10
nodes) and rebalance by reassigning *whole partitions* to new nodes (the
mapping changes; the data within a partition doesn't re-shuffle); or
**consistent hashing / token ranges** (card 46). Either way, adding a node
moves ~1/N of the data, not all of it. The deeper rule: never bake the
cluster size into the key-to-location function.

**41. One celebrity key is melting a partition. Mitigations, and what each costs?**
First diagnose: hot *key* (one ID) vs hot *partition* (bad key choice — card
44). For a genuinely hot key: **salt it** — append a small random suffix
(`key#0..key#15`) so writes spread over 16 partitions; reads must now
scatter-gather all suffixes and merge, so salt only the identified hot keys
and keep a registry of them. **Special-case the head of the power law**:
route known-hot entities to dedicated capacity or a different path (e.g.
celebrity fan-out handled pull-side, card 2). **Cache aggressively** in front
for read-hot keys. Costs to say out loud: salting sacrifices per-key
ordering and single-key atomic ops; special-casing adds a second code path;
caching adds invalidation. Hot keys are a *data property* — no rebalancer
fixes them, because the load is indivisible by key.

**42. Local vs global secondary indexes?**
**Local (document-partitioned):** each partition indexes only its own rows.
Writes stay single-partition (index updated in the same place, even
transactionally) — but a query by the indexed field must **scatter-gather
every partition** and merge, with tail latency set by the slowest (card 47).
**Global (term-partitioned):** the index itself is partitioned by the
indexed *value*, so a lookup hits exactly the right index partition — but a
single row write must now update index entries on *other* partitions, which
is done asynchronously in practice (synchronous would need a distributed
transaction), so **the index lags the data**. Decision rule: write-heavy
with occasional filtered queries → local; read-heavy lookups on the indexed
field → global, with the staleness window stated as a product fact.

**43. How does a request find the right partition? The three routing options.**
(1) A **routing tier** — proxies that consult an authoritative
partition-assignment store (classically ZooKeeper) and forward; simple
clients, extra hop, the assignment store must be highly available.
(2) **Partition-aware clients** — the client library holds the assignment
map and connects directly; lowest latency, but every client must learn about
rebalances (gossip, metadata refresh, "moved" redirects). (3) **Any-node
forwarding** — send anywhere; nodes know the map and forward (Cassandra-style
coordinators); simplest clients, occasional extra hop. All three reduce to
the same hard sub-problem: *someone* must hold the truth about
partition→node assignment and propagate changes promptly — which is why a
consensus-backed metadata service usually sits underneath (card 79).

**44. What makes a good partition key?**
Three properties, in tension: **even distribution** of both data volume and
request load (beware low-cardinality keys, time, and power-law entities);
**access-pattern alignment** — the dominant queries should be answerable
within one partition (key by `conversation_id` so a chat loads from one
shard, not by `message_id` which scatters every conversation); and
**co-location of what must be ordered or transactional together**, since
per-partition order and single-partition atomicity are the cheap guarantees
(cards 27, 109's uniqueness trick). Classic failures: keying time-series by
timestamp (one white-hot "now" partition — card 48's fix), keying by country
(US partition melts), keying by `user_id` when one user is a bot doing 90%
of traffic. Always state the follow-up: "and I'd monitor per-partition load
to catch skew early."

**45. Why is automatic rebalancing dangerous during incidents?**
Rebalancing is itself a heavy workload — bulk data movement consuming disk
and network. The danger pattern: overload or a network blip makes nodes
*look* dead to the failure detector → the autobalancer declares them lost
and starts re-replicating/moving their partitions → the movement adds load →
more nodes look dead → **cascade**. The cure is friction: rate-limit
rebalancing, require sustained (not instantaneous) failure signals, cap
concurrent movements, and gate large-scale rebalances behind human
confirmation. Same family as card 23's failover trap — automation that
reacts to timeouts must be tuned for the false-positive case, because its
corrective action is expensive precisely when false positives spike.

**46. Explain consistent hashing and why systems add virtual nodes.**
Map both nodes and keys onto a hash ring; each key belongs to the next node
clockwise. Adding or removing a node only remaps keys in its arc — ~1/N of
data moves, solving card 40's problem. Two raw-ring defects, both fixed by
**virtual nodes**: with one point per physical node, load between nodes is
uneven (random arc sizes) and a node's departure dumps its entire arc on one
neighbor. Giving each physical node many vnodes (tokens) scattered around
the ring evens out arc ownership statistically and spreads a failed node's
load across *many* successors — also letting heterogeneous hardware take
proportionally more vnodes. Worth saying: Dynamo-style stores use the ring;
plenty of other systems (Kafka, many SQL shardings) instead use fixed
partitions + an assignment map (card 40) — consistent hashing is one tool,
not the definition of sharding.

**47. Why does scatter-gather over many partitions wreck tail latency, and what mitigates it?**
A fan-out query is as slow as its **slowest** shard, and slow shards aren't
rare events at fan-out scale: if each shard is slow (GC, compaction, queue
spike) just 1% of the time, a 100-shard query hits at least one slow shard
~63% of the time — the component p99 becomes the query's *median*. This is
tail amplification applied to partitioning. Mitigations: reduce fan-out
(better partition keys so queries are single-shard — card 44; global indexes
— card 42), **hedged requests** (send the straggling sub-request to a
replica after a short delay, take the first answer; cheap because only the
slowest few percent are duplicated), partial results with timeouts where the
product tolerates it, and relentless work on per-shard variance (compaction
tuning, GC, isolation from batch work).
*Go deeper:* [Dean & Barroso — The Tail at Scale](https://cacm.acm.org/research/the-tail-at-scale/)

**48. How do you partition time-series data so "now" doesn't melt one shard?**
Pure time-range partitioning sends *all* current writes to the newest
partition — one hot shard, N−1 idle ones. The standard fix is a **compound
key: (source, time window)** — e.g. `(sensor_id, day)` or
`(tenant, hour)` — so concurrent writes spread across sources while each
source's recent data stays contiguous for range scans. Queries for one
source over a window touch few partitions; cross-source aggregations
scatter-gather (acceptable for analytics). Bonus operational win: old time
windows become immutable, so they can be compressed hard, tiered to cheap
storage, and dropped wholesale for retention — deleting a partition beats
deleting rows. If a single source is itself too hot, salt within the window
(card 41). This pattern composes cards 39, 41, and 44 — say it as a worked
example.

---

## E. Transactions (DDIA ch. 7)

**49. What does the A in ACID actually mean? (Common trap.)**
**Abortability**, not "atomic with respect to other threads". Atomicity
promises that a transaction's writes are all-or-nothing *in the face of
faults*: if it can't complete (crash, constraint violation, disconnect),
every partial write is rolled back as if nothing happened — which is what
makes **safe retries** possible. Guarantees about what *concurrent*
transactions see belong to **Isolation**. The trap exists because "atomic"
means the concurrency thing in atomic-CPU-instruction land. Interview
delivery: "A is about crashes, I is about concurrency — A gives me clean
retries, I gives me sane interleavings."

**50. What does the C in ACID stand for, and why is it the odd one out?**
**Consistency** here means *application-defined invariants hold* (accounts
balance, foreign keys resolve) — and unlike A, I, D, it isn't something the
database can provide alone. The database supplies tools (constraints,
atomicity, isolation); the *application* must write transactions that take
the data from one valid state to another. Joe Hellerstein's quip, quoted in
DDIA, is that C was tossed in to make the acronym work. Also keep it
distinct from CAP's C, which means linearizability (card 76) — three
different "consistencies" share one word, and interviewers probe exactly
that confusion.

**51. What does read committed prevent, and what does it still allow?**
Prevents **dirty reads** (you never see uncommitted data — implemented by
returning the old committed value while a writer holds the new one) and
**dirty writes** (you never overwrite uncommitted data — row-level write
locks). It's the default in PostgreSQL, Oracle, and SQL Server. Still
allowed: **read skew** (card 52), **lost updates** (card 54), **write skew**
(card 55), **phantoms** (card 56) — i.e. nearly every interesting
concurrency bug. The staff habit: name your database's *actual* default
isolation level in designs, because most engineers assume more protection
than read committed gives.
*Go deeper:* [PostgreSQL docs — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

**52. What is read skew, and which mechanism fixes it?**
A transaction reads several rows while another transaction commits *between
those reads*, so it observes a mixture of before-and-after — a state that
never existed at any instant. Canonical: you check account A ($500), a
transfer commits, you check account B ($400) — the $100 seems to have
vanished. Harmless for some UIs; fatal for **backups** (restoring a
mixed-state backup makes the anomaly permanent) and long **analytics
queries**. The fix is **snapshot isolation**: every transaction reads from a
consistent snapshot of the database as of its start, implemented with MVCC
(card 53). One sentence: *read committed protects each read; snapshot
isolation protects the relationship between reads.*

**53. How does MVCC work, and what's the headline benefit?**
Multi-Version Concurrency Control: writers never overwrite — they append a
**new version** of the row stamped with their transaction ID, and the old
version remains. Each transaction gets a snapshot rule: "see versions
committed before I started; ignore later ones and uncommitted ones." Visible
effects: **readers never block writers and writers never block readers** —
long reads (reports, backups) coexist with OLTP traffic — and consistent
snapshots are nearly free. The operational bill: old versions accumulate and
must be garbage-collected (Postgres VACUUM); a long-running transaction pins
the oldest visible snapshot, blocking cleanup — which is the classic root
cause behind "table bloat" and replication-apply stalls (card 35's culprit).

**54. Two clients read a counter at 40 and both write 41. Name the anomaly and four defenses.**
**Lost update** — concurrent read-modify-write cycles where one clobbers the
other. Defenses, in order of preference: **(1) atomic write operations** —
push the modification into the database (`UPDATE counters SET n = n + 1`),
eliminating the client-side gap entirely; **(2) explicit locking** —
`SELECT … FOR UPDATE` serializes the cycle (works, costs blocking);
**(3) compare-and-set** — `UPDATE … WHERE n = 40` and retry on zero rows
(beware: under snapshot isolation the WHERE may read the snapshot — know
your engine); **(4) automatic detection** — some snapshot-isolation engines
abort a transaction whose read was stale at write time; retry on abort. In
leaderless/multi-leader stores none of these exist locally — you're back to
version vectors and merges (card 31).

**55. Define write skew, give the canonical example, and the fix.**
Generalized lost update: two transactions **read an overlapping set** to
check an invariant, then **write disjoint rows** — each write fine alone,
the pair violating the invariant. Canonical: hospital rule "≥1 doctor on
call"; Alice and Bob, both on call, each query `COUNT(on_call) = 2`,
conclude it's safe, and *each removes themself* — different rows, zero
doctors. Snapshot isolation permits it (no write-write conflict to detect).
Fixes: true **serializability** (SSI detects the dangerous read-write
pattern and aborts one; 2PL blocks it); or **materialize the conflict** —
create a row both must lock (the on-call-shift row, `FOR UPDATE`); or a
database **constraint** when expressible. The detection skill: any
"check-then-act on a condition others can change" is write-skew-shaped.

**56. What's a phantom, and why can't row locks stop it?**
Your transaction's *search condition* ("any booking for room 12,
2–3 pm?") is invalidated by a row that **didn't exist** when you ran it —
another transaction inserts the conflicting booking after your check. You
can't lock a row that isn't there, so plain row locking is structurally
helpless. Remedies: **predicate locks** (lock the condition itself —
expensive) approximated in practice by **next-key/gap locks** on index
ranges (lock the gap where matching rows *would* land); SSI's read-tracking
catches phantoms too; or materialize the resource — pre-create a row per
bookable slot so the conflict becomes an ordinary row lock/unique constraint.
Phantoms are write skew's insert-shaped sibling, and booking systems are
their natural habitat.

**57. Name the three practical routes to serializability and when each fits.**
**(1) Actual serial execution:** run transactions one at a time on a single
core — trivially serializable, viable since RAM-resident data made
transactions microsecond-fast (VoltDB lineage; Redis scripts are this
spirit). Requires short, non-interactive transactions (stored procedures —
no waiting on the client mid-transaction) and throughput bounded by one
core per partition; cross-partition transactions get hard. **(2) Two-phase
locking:** readers and writers take shared/exclusive locks held to commit —
the classic; safe but blocking, deadlock-prone, fragile latency under
contention. **(3) Serializable Snapshot Isolation:** optimistic — run on
snapshots, detect dangerous read-write dependency patterns at commit, abort
one party; great when contention is low, retry-stormy when it isn't. Staff
add-on: "and per-partition serial execution via a log is how stream
processors sneak serializability in" (card 108).

**58. 2PL vs SSI — how do they fail differently under contention?**
Same guarantee, opposite temperaments. **2PL is pessimistic:** conflicts
manifest as *waiting* — lock queues, blocked readers behind writers,
deadlocks resolved by victim-killing; under a hot row, latency stretches and
throughput collapses, but no work is wasted on doomed transactions. **SSI is
optimistic:** conflicts manifest as *aborts at commit* — transactions run
full speed on snapshots, then some discover their reads went stale and must
retry; under low contention it's near-free, under a hot row you burn CPU
re-executing the same losers (retry storms) and need backoff. Decision lens:
contention rate × transaction length. Long transactions are poison to both —
they hold locks (2PL) or widen the conflict window (SSI) — so the real fix
for a hot spot is often restructuring the conflict (card 54's atomic ops,
sharded counters), not switching CC algorithms.

**59. Why is two-phase commit (2PC) painful at scale, and what do people do instead?**
2PC makes commit atomic across participants via a coordinator: prepare
(everyone votes, **promises**, and holds locks) then commit. The pain: after
voting yes, a participant is **in doubt** — it cannot unilaterally commit or
abort — so a crashed coordinator strands participants holding locks,
stalling unrelated traffic until recovery; plus extra round-trips and fsyncs
per transaction, and an availability product of all participants. It also
doesn't compose across heterogeneous systems well (XA is operationally
grim). Alternatives by case: keep transactions **single-partition** (choose
keys so they can be — card 44); **idempotent multi-step flows / sagas** with
compensation; **outbox + log** for "update DB and publish event" (card 96);
and where atomic multi-node commit is truly required, consensus-based commit
(the coordinator's decision in a replicated log) removes the
single-coordinator blocking flaw.

**60. When do you actually pay for serializable isolation?**
When an invariant spans data that concurrent transactions *read* to make a
decision and then write disjointly — the write-skew/phantom family:
double-booking, "balance never below zero" enforced via check-then-debit,
quota and capacity enforcement, uniqueness under race. The discipline is to
**inventory transactions, not flip a global switch**: most traffic
(reads, single-row updates, atomic increments) is safe at snapshot
isolation/read committed; the handful of invariant-bearing transactions get
serializable (or a materialized lock / constraint). Saying "I'd enumerate
which transactions carry invariants and protect exactly those, then load-test
the abort/lock rate" is the staff-shaped answer; "turn on serializable
everywhere" reads as never having paid the latency bill.

**61. When is single-object atomicity enough — and what does that imply for data modeling?**
Databases give strong guarantees cheaply *within* one object/row/document:
atomic single-key updates, per-document transactions, atomic compare-and-set.
If every invariant you care about lives **inside one object**, you don't need
multi-object transactions at all — which is the design bet document stores
made: model the aggregate (order + its line items) as one document, update it
atomically, scale without cross-document coordination. The implication runs
both ways: *modeling can buy you out of distributed transactions* (co-locate
what must change together — same row, same document, same partition), and
conversely, scattering one logical change across many rows/services is what
*creates* the need for 2PC/sagas. In design interviews, reach for "can I
re-model so the invariant is single-object/single-partition?" before
reaching for transaction machinery.

---

## F. The trouble with distributed systems (DDIA ch. 8)

**62. Why are timeouts the only failure detector — and what can't they tell you?**
In an asynchronous network there is **no upper bound on delay**: packets
queue, links congest, GC pauses intervene. So the only available evidence of
failure is *silence for longer than expected* — a timeout. What it cannot
distinguish: dead node vs slow node vs dead link vs slow link vs a node that
received the request and is still working. Critically, it can't tell you
whether the request **was executed** before the silence — the foundation of
card 63. Consequences: failure detection is probabilistic (tune timeouts to
measured latency distributions, not vibes); actions taken on timeout
(retry, failover) must be safe under false positives; and "the node is
down" should be spoken as "the node looks down *to me, right now*."

**63. Why does "retry on timeout" require idempotency?**
Because a lost **response** is indistinguishable from a lost request. If the
request executed but the ack died, your retry executes it *again*:
double-charge, duplicate email, two shipments. Safe retries need
**idempotency**: the operation can be applied many times with the effect of
once. Naturally idempotent ops (set x = 5) are fine as-is; for the rest, the
client mints an **idempotency key** (a unique operation ID) per logical
action, sends it on every attempt, and the server deduplicates — typically a
unique-keyed insert that returns the original result on conflict. Note the
scope rule that becomes card 106: the key must be minted at the *source of
intent* and survive every hop, or a layer above the dedupe point can still
duplicate.

**64. Your dependency starts timing out. How do clients retry without making it worse?**
Naive retries triple traffic into a service that's drowning — a retry storm
that converts a brownout into an outage. The toolkit: **exponential
backoff** (space attempts out so the dependency can recover), **jitter**
(randomize the backoff — otherwise all clients retry in synchronized waves),
a **retry budget / token bucket** (retries allowed only while tokens last,
so retry traffic is capped at a fraction of base traffic — built into the
AWS SDK), **retry at one layer only** (stacked retries multiply: 3 layers ×
3 attempts = 27 calls), and **circuit breakers** used carefully (they add
modal behavior; budgets are gentler). Plus card 63's prerequisite: only
retry what's idempotent, and only errors worth retrying (not 4xx).
*Go deeper:* [AWS Builders' Library — Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

**65. How does clock skew turn last-write-wins into data loss?**
LWW orders writes by wall-clock timestamps, but every node's clock is wrong
by some unknown amount — NTP sync is best-effort (milliseconds when healthy,
unbounded when not: VM pauses, network issues, misconfiguration, leap-second
handling). So a write stamped by a fast clock beats a *genuinely later*
write stamped by a slow clock: the newest data is silently discarded, with
no error, on a healthy system. And the loss is invisible — nothing logs "I
dropped the real latest value." Mitigations: don't order cross-node events
by time-of-day clocks at all — use logical sequence (per-partition log
order, version vectors); if timestamps are unavoidable, generate them at one
place (the storage node); and treat clock skew as a *monitored* failure mode
with alerts, since few teams watch it.

**66. Time-of-day vs monotonic clocks — when must you use which?**
**Time-of-day (wall) clocks** answer "what time is it?" — synchronized via
NTP, which means they can **jump**, including backwards (step corrections),
and freeze or smear around leap seconds. Never use them to measure elapsed
time or order events across nodes. **Monotonic clocks** answer "how long
has it been?" — guaranteed to move forward, ideal for timeouts and duration
measurement, but their absolute value is meaningless and incomparable
*across machines*. The bug this card prevents: `deadline = wallclock() + 30s`
misfires when NTP steps the clock — every timeout in that process fires
early or late at once. Rule: durations → monotonic; calendar moments →
wall clock; cross-node ordering → neither (logical clocks, card 84).

**67. What is a process pause, and why does it break lease-based code?**
The whole process can freeze for seconds *between any two instructions*:
stop-the-world GC, VM live-migration, host hypervisor steal, swapping/page
faults, even laptop lid-close in dev. The killer pattern: code checks "my
lease is still valid," passes, *then pauses*; the lease expires, another
node legitimately takes over, the original thread wakes and writes anyway —
a **zombie writer** corrupting state while believing it holds exclusivity.
No amount of re-checking the clock helps: the pause can land between the
check and the write. Consequences: any safety property must be enforced
*outside* the pausable process (fencing — card 68), and lease durations must
dwarf worst-case pauses you've actually measured (GC logs are evidence).

**68. Explain fencing tokens.**
The fix for zombie writers: make the *resource* reject stale authority
instead of trusting clients to know they're stale. The lock/lease service
issues a **monotonically increasing token** with every grant (epoch, term,
or counter). Clients include the token on each write; the protected
resource records the highest token seen and **rejects anything lower**. Now
the paused old holder wakes, writes with token 33, and storage — having seen
34 — refuses. Requirements worth naming: the resource must be able to check
and persist tokens (a dumb resource needs a gateway that can), and token
issuance must be linearizable (which is why this lives next to
consensus-backed lock services, card 81). This is Kleppmann's celebrated
critique of Redlock distilled: a lock without fencing protects only against
polite failures.
*Go deeper:* [Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

**69. Is "exactly-once delivery" possible? What's the achievable version?**
Delivery: **no** — over a lossy network you must retry to guarantee
delivery, and retries can duplicate; you can have at-most-once or
at-least-once, pick. Achievable: **exactly-once *effects*** (effectively-
once processing): duplicates exist in transit and are *neutralized* at
boundaries — idempotent application (card 63), sequence numbers that let
receivers discard replays, and transactional sinks that commit output and
progress atomically (card 99). The interview answer in one breath:
"impossible at the delivery layer, engineered at the effect layer — and the
dedupe must live at the layer where the *operation's identity* is known,
which is the end-to-end argument" (card 106).

**70. Crash-stop vs Byzantine faults — what do most systems assume, and why?**
**Crash-stop/crash-recovery:** nodes fail by halting (possibly returning
with stable storage intact); they never lie. **Byzantine:** nodes may do
anything — corrupt data, send contradictory messages, act maliciously.
Tolerating f Byzantine nodes needs 3f+1 replicas and expensive protocols
(BFT consensus), so inside a single organization's trust perimeter,
infrastructure (Raft, ZooKeeper, databases) assumes non-Byzantine and spends
the budget where real risks are: **checksums** end-to-end (disks and memory
do corrupt bits — a weak Byzantine reality), **auth between services**, and
**input validation** at trust boundaries (clients are Byzantine by
definition). Byzantine-tolerant protocols earn their cost in
multi-organization settings — blockchains, some aerospace.

**71. Why must any node's "I'm the only writer" belief be enforced somewhere else?**
Because every ingredient of that belief is falsifiable without the node
knowing: it can be **paused** (card 67) past its lease, **partitioned** from
the majority that already elected a successor, or de-elected while its
notification is in flight. Local state about global authority is always
potentially stale — "the truth is defined by the majority/the resource, not
by the node's memory of being chosen." So safety must be checked where
writes land: fencing tokens at storage (card 68), epoch numbers on every
replication message (card 80), conditional writes keyed on a leader
generation. A clean staff phrasing: *leadership is a claim; the resource
verifies claims.*

**72. Sketch the system models: what do "partially synchronous" and "crash-recovery" buy you as a designer?**
Models are the assumptions proofs and protocols rest on. **Timing:**
*synchronous* (bounded delays — unrealistic for real networks), *asynchronous*
(no timing assumptions at all — brutally pessimistic; FLP lives here, card
85), and **partially synchronous** — the realistic middle: the system behaves
asynchronously in bad periods but eventually delivers within bounds. **Node
faults:** crash-stop, **crash-recovery** (nodes return, stable storage
survives — the model real databases target), Byzantine (card 70). Why care:
algorithms are correct *relative to a model* — Raft is safe in partial
synchrony with crash-recovery nodes; deploy it where assumptions break
(unbounded pauses treated as crashes without fencing) and "proven correct"
stops applying. It's also the vocabulary for whittling vague reliability
talk into checkable claims.

**73. "The network is reliable inside our datacenter." What does production evidence say?**
Partitions and partial failures are routine, and they're rarely clean
binary splits: **asymmetric** links (A reaches B, B can't reach A),
one-way packet loss, a congested or misconfigured switch isolating a rack,
flapping links that heal and re-fail, and gray failures where a NIC drops a
percentage of packets. The GitHub October 2018 incident began with ~43
seconds of partition between sites — enough for both sides to make
irreconcilable progress and cost a day of recovery. Design consequences:
every safety mechanism must survive *partial and asymmetric* connectivity
(quorums and epochs do; "ping it to check" doesn't), failure detection is
per-observer (card 62), and partition response is a designed behavior, not
an exception path.
*Go deeper:* [GitHub — October 21 post-incident analysis](https://github.blog/2018-10-30-oct21-post-incident-analysis/)

**74. How does Spanner's TrueTime make clocks safe to use — and what's the universal lesson?**
Google's Spanner doesn't pretend clocks are accurate; it makes their
**uncertainty explicit**. TrueTime returns an interval [earliest, latest]
guaranteed to contain the true time (GPS + atomic clocks keep it a few ms
wide). For ordering guarantees, a transaction **commit-waits**: it holds
its commit until the uncertainty interval has fully passed, so its timestamp
is unambiguously in the past before effects are visible — buying external
consistency (real-time ordering) from clocks. The universal lesson, usable
without Google hardware: never trust a point timestamp across nodes; either
use logical ordering (cards 65, 84) or *quantify* clock error and design
waits/conflict-windows around the bound. "Confidence intervals on time" is
the idea; commit-wait is the price.

---

## G. Consistency & consensus (DDIA ch. 9)

**75. Define linearizability in one sentence, then state its price.**
The system behaves as if there were **one copy** of the data and every
operation took effect **atomically at some instant between its invocation
and its response** — so once any client's read returns a value, every later
read returns that value or newer; recency is guaranteed in real time. The
price: every operation needs coordination — cross-node round-trips on the
critical path (latency), throughput capped by the coordinating group,
and **forced unavailability during partitions** (the minority side must
refuse rather than serve stale data). That's why card 82's answer is to buy
it only where invariants demand it.
*Go deeper:* [Jepsen — Consistency models map](https://jepsen.io/consistency)

**76. State CAP precisely — and why sophisticated engineers lean on it less than juniors do.**
Precise form: **when a network partition occurs**, a system must choose
between *linearizable consistency* (refuse some requests rather than serve
non-linearizable results) and *availability* (serve everyone, sacrificing
linearizability). No partition → no forced choice. Why it underwhelms at
staff level: it covers exactly one consistency level (linearizability) and
one fault (partitions) — nothing about latency, which dominates real
designs even when the network is healthy; many systems are *neither* C nor A
by its strict definitions; and real systems make different choices per
operation, so "is X CP or AP?" is usually a category error. Use it as a
reminder that partitions force trade-offs; use richer vocabulary
(linearizable / causal / session guarantees; timeliness vs integrity, card
107) for actual design.
*Go deeper:* [Kleppmann — Please stop calling databases CP or AP](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html)

**77. Linearizability vs serializability — disentangle them.**
Orthogonal axes that share a syllable. **Serializability** (isolation, ch.
7): *multi-object transactions* behave as if executed in **some** serial
order — but that order may disagree with real time (a serializable system
may legally let you read stale data, as long as the whole history is
equivalent to some serial one). **Linearizability** (ch. 9): *single-object
operations* respect **real-time** recency — no transactions implied.
Combine them and you get **strict serializability**: a serial order that
also matches real time. Concrete probe to keep handy: serializable-but-not-
linearizable = snapshot-based serializable engine serving a stale-but-
consistent snapshot; linearizable-but-not-serializable = a linearizable
key-value register with no multi-key transactions at all.
*Go deeper:* [Jepsen — Consistency models map](https://jepsen.io/consistency)

**78. Why is total order broadcast equivalent to consensus?**
**Total order broadcast (TOB)** = all nodes deliver the same messages in the
same order, exactly once, reliably. Deciding "what is entry #N of the
shared log?" is precisely a consensus decision; run consensus repeatedly,
once per slot, and you've built TOB — run TOB and you can implement
consensus (propose; first message delivered wins). So "replicated log" and
"consensus" are one machine in two vocabularies — which is why Raft is
described as replicated-log management. The payoff identity: **TOB + applying
entries deterministically = state machine replication** — every replica,
fed the same ordered inputs, computes the same state. That identity is also
why a Kafka-style partition (a durable total order per partition) can stand
in for coordination in card 108's uniqueness trick.

**79. Where does consensus actually run in a typical stack?**
Fewer places than people think, and they're load-bearing: **leader election
and log ordering** inside replicated systems (Raft in etcd and many modern
databases; Kafka's metadata/controller quorum; ZooKeeper's ZAB);
**cluster metadata** — membership, partition assignments (card 43's truth),
configuration, feature flags that must not glitch; **distributed locks and
leases with fencing** (cards 68, 81); and **atomic commit** when the commit
decision itself is consensus-replicated to fix 2PC's blocking coordinator
(card 59). Everything else — replication fan-out, derived views, caches —
deliberately *rides on top of* those few ordered, agreed points. Staff
phrasing: "consensus is expensive, so architecture concentrates it into a
small control plane and keeps the data plane mostly coordination-free."
*Go deeper:* [etcd](https://etcd.io/) · [Apache ZooKeeper](https://zookeeper.apache.org/)

**80. Why do consensus protocols need both quorums and epochs?**
Each solves the failure the other can't. **Epochs/terms** order leaders
*across time*: every election increments the epoch; participants reject
proposals from older epochs — so a deposed, paused, or partitioned old
leader can't overwrite the new regime (the protocol-level fencing token,
card 68). **Quorums** make that enforceable and elections decisive: any two
majorities **overlap**, so a candidate gathering a majority is guaranteed to
contact at least one node that knows about any later epoch or any committed
entry — stale leadership is detected, and committed data survives into the
new term (Raft additionally only elects candidates with up-to-date logs).
One line: *epochs say who's newest; quorum overlap guarantees somebody in
the room remembers.*

**81. What do ZooKeeper/etcd actually give an application developer?**
Outsourced consensus, packaged as a tiny linearizable kernel: **atomic
compare-and-set** on small keys (the primitive under elections and locks),
**ephemeral nodes / leases** — keys bound to a client session that vanish
when the session dies, giving automatic cleanup and liveness detection;
**total ordering** of all updates (zxid / revision — usable directly as
fencing tokens, card 68); and **watches** — notifications on change, so
clients react without polling. From these you assemble leader election,
locks with fencing, service discovery, membership, and config — without
writing consensus. Two usage rules that mark experience: keep the data tiny
and low-churn (it's a coordination kernel, not a database), and treat
*watch-then-read* races and session expiry as first-class code paths.

**82. Why not make the whole system linearizable and be done with it?**
Because you'd pay consensus prices on every operation: cross-node
round-trips on each read/write (tail latency multiplies — and this cost is
paid even when the network is perfectly healthy, the thing CAP doesn't
mention), throughput capped by the ordering group, and minority-side
unavailability during partitions. Most product flows don't need real-time
recency — they need session guarantees (cards 24–27) or mere integrity
(card 107). The staff design move is an **inventory**: linearizability for
the handful of operations whose invariants demand it — uniqueness claims,
lease grants, ledger appends, config flips — implemented via the
coordination kernel (card 79); everything else explicitly, comfortably
weaker. "Strong everywhere" is how you build a slow system that still has
outages.

**83. How do you get a linearizable read from a Raft-style leader — and what's the trap?**
The trap is the obvious approach: "read from the leader." A leader can be
**deposed and not know it** (partition, pause); serving reads from its local
state then returns stale data — non-linearizable — while a new leader
commits writes elsewhere. Correct options: **read-index** — the leader
confirms leadership with a quorum round-trip (cheaper than a log write),
then serves the read at or past its commit index; **lease reads** — the
leader serves locally during a clock-bounded lease granted by the quorum
(fast, but correctness now leans on bounded clock drift — card 66's
caveats); or push the read through the log like a write (slowest, simplest).
This card is the bridge between "we run Raft" and "our reads are actually
linearizable" — many deployments quietly aren't.

**84. Lamport timestamps vs version vectors — both "logical clocks"; what's the difference that matters?**
**Lamport timestamps** (counter, bumped on events and to max+1 on message
receipt, ties broken by node ID) give a **total order consistent with
causality**: if A happened-before B, L(A) < L(B). But the converse fails —
from two timestamps you *cannot tell* whether the events were causally
related or concurrent; the order between concurrent events is arbitrary.
**Version vectors** (card 31) preserve exactly that information: comparing
vectors tells you ordered-vs-**concurrent**. So: need a single agreed
sequence (and don't care that concurrency is hidden)? Lamport-style numbers
— though note they order *after the fact* and can't alone enforce
uniqueness-at-decision-time, which needs TOB/consensus (card 78). Need to
*detect conflicts* to merge them (multi-leader, leaderless)? Version
vectors. One hides concurrency; the other exposes it.

**85. What does the FLP result say, and why do real consensus systems work anyway?**
FLP (Fischer–Lynch–Paterson, 1985): in a **fully asynchronous** model — no
clocks, no timing bounds — no deterministic protocol can guarantee consensus
termination if even one node may crash; there's always a schedule that
delays a decision forever. It's a statement about that pessimistic model,
not a ban: real systems escape by adding exactly what the model forbids —
**timeouts and failure detectors** (partial synchrony: Raft's randomized
election timers), or randomness. The mature reading: **safety holds
unconditionally** in good protocols (never two decisions, regardless of
timing), while **liveness is conditional** on the network behaving
eventually — so consensus systems can *stall* during pathological periods
but won't *corrupt*. That safety/liveness split is the right frame for most
distributed guarantees.

**86. Sketch Raft in 60 seconds: components and the safety property.**
Three pieces. **Leader election:** randomized election timeouts; a follower
that hears no heartbeat becomes a candidate in a new **term**, wins with a
majority of votes; voters refuse candidates whose logs are behind theirs.
**Log replication:** all writes go through the leader, which appends and
replicates entries; an entry is **committed** once a majority stores it,
then applied by all state machines in log order (state machine replication,
card 78). **Safety:** at most one leader per term (majority votes + term
checks), and the election restriction means a new leader already holds every
committed entry — so committed entries are never lost or reordered, across
any sequence of crashes and elections. Designed explicitly to be teachable —
the paper is genuinely readable, and the site has a live visualization.
*Go deeper:* [The Raft Consensus Algorithm — raft.github.io](https://raft.github.io/) · [the paper (PDF)](https://raft.github.io/raft.pdf)

---

## H. Batch processing (DDIA ch. 10)

**87. Why do batch frameworks insist on immutable inputs and deterministic tasks?**
Because it makes fault tolerance *structural* instead of protocolic: any
failed task can be re-executed anywhere from the same input and produce the
identical output — so the scheduler retries freely, speculative duplicates
of stragglers are harmless, and partial failures never corrupt state. The
underrated second benefit is **human fault tolerance**: a buggy job is fixed
by editing code and re-running on the same untouched input — the original
data was never mutated, so there's nothing to un-break. This pair —
immutable input, re-derivable output — is the philosophical core the rest of
the book reuses: streams inherit it via replayable logs (card 100's rewind),
and chapter 12's "rebuildable views" (card 105) is the same idea at
architecture scale.

**88. Reduce-side vs map-side joins?**
**Reduce-side** is the general-purpose join: map both datasets emitting the
join key, let the shuffle bring all records with the same key to the same
reducer, join there. Always works, no assumptions — at the cost of a full
**sort/shuffle** of both inputs across the network, usually the job's
dominant expense. **Map-side** joins skip the shuffle when structure allows:
**broadcast** join — one side is small enough to ship in full to every
mapper as an in-memory lookup table; **partitioned/sorted-merge** join —
both inputs are already partitioned (and ideally sorted) by the join key
from a previous job, so each mapper joins its aligned slice locally.
Interview framing: join strategy = "what do I know about my inputs?" —
nothing → shuffle; one side tiny → broadcast; both pre-partitioned → merge
in place. (Card 89 covers when the key itself betrays you.)

**89. One key has 100× the records and stalls the whole join. What do you do?**
That's **skew**: shuffle-by-key sends every record for the hot key
("celebrity user", null IDs, a default value) to one reducer, which runs for
hours while peers idle — the job is as slow as its hottest key. Remedies:
**detect first** (sample key frequencies — engines and a quick pre-job both
work); **broadcast-join** the small side so the big side never shuffles at
all; **salt the hot keys** — split them across many reducers with a random
suffix, replicating the matching small-side rows to each, then merge;
isolate known-hot keys into a dedicated path. Also audit for *garbage* hot
keys (nulls/defaults) you can filter or handle separately. Same disease as
card 41 — skew is a data property; parallelism can't divide an indivisible
key, so the *plan* must change.

**90. MapReduce writes everything to disk between stages; Spark/Flink-style engines don't. What's the actual trade?**
MapReduce **fully materializes** each job's output to the distributed
filesystem (replicated!) before the next job starts. Costs: enormous I/O,
and a pipeline of N jobs pays N round-trips through storage with dead time
between. Benefits: stages are durable checkpoints — a failure resumes from
the last boundary, and intermediate outputs are inspectable/reusable.
**Dataflow engines** model the whole pipeline as one operator DAG and
**stream records between operators** (memory/local disk, no replication):
massively faster, no waiting for stage completion — but a failure now loses
in-flight state, so they need their own recovery machinery: recompute lost
partitions from lineage, or periodic **checkpoints** of operator state.
The trade in one line: *materialization buys cheap recovery and debuggability
with expensive I/O; pipelining buys speed and owes you a recovery story.*

**91. Why should batch jobs be side-effect-free, with outputs written all-or-nothing?**
Because retries and speculative execution mean any task **may run more than
once** — a task that sends emails or mutates an external database mid-job
duplicates those effects on every retry, and a half-failed job leaves the
world half-mutated with no rollback. Discipline: tasks compute **pure
outputs**; the framework writes them to a staging location and **atomically
publishes** on success (rename/commit), so downstream consumers see either
the complete old output or the complete new one — never a torn mix; failed
runs leave the previous output untouched (instant rollback = repoint).
External effects, if truly needed, happen *after* commit, idempotently
(card 63). This is exactly the discipline streaming re-derives as
"idempotent or transactional sinks" (card 99) — batch just gets it almost
for free.

---

## I. Stream processing (DDIA ch. 11)

**92. Log vs queue: what's the decision rule?**
Two philosophies of what a message *is*. A **queue** (AMQP-style) treats it
as a **task**: deliver to exactly one worker, delete on ack; per-message
acknowledgment, redelivery, and fair dispatch across workers — ideal for
independent, expensive jobs (encode this video). History is gone by design,
and redelivery reorders. A **log** (Kafka-style) treats it as an **event** —
a fact that happened: append-only, retained regardless of consumption;
consumers are just **offsets** advancing through partitions, so you get
per-key ordering (card 93), many independent consumer groups reading the
same stream, and **replay** — the superpower that makes derived views
rebuildable (cards 100, 105). Decision rule: does history have value, and
does per-entity order matter? → log. Independent tasks needing per-message
ack/retry? → queue. Using a log *as* a job queue buys head-of-line blocking
inside partitions — name that cost.
*Go deeper:* [Jay Kreps — The Log](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)

**93. How do consumer groups, offsets, and lag relate — and why is the design so operationally pleasant?**
A **consumer group** divides the topic's **partitions** (not individual
messages) among its members: each partition has exactly one reader per
group, so per-partition order survives consumption, and parallelism scales
to the partition count (more consumers than partitions = idle consumers —
size partition counts generously up front). Progress is one **committed
offset per partition** — crash recovery is "resume from offset," no broker
bookkeeping per message, no in-flight ack matrix. **Lag** = log head minus
committed offset: a single, per-partition staleness metric that tells you
whether consumers keep up, how stale derived views are, and how close you
are to retention loss (card 100). Rebalances (membership changes
reassigning partitions) are the operational sharp edge — pauses and
duplicate-processing windows — worth mentioning unprompted.

**94. Why are dual writes (app writes DB + search + cache) broken?**
Two independent failure modes, both silent. **Race:** concurrent updates
reach the destinations in different orders — DB applies $30 then $25; the
search index, on its own network schedule, applies $25 then $30. Final
states disagree *permanently*, and nothing errors — there's no shared
serialization point to even notice. **Partial failure:** the app writes the
DB, then crashes before the cache call; no transaction spans Postgres,
Elasticsearch, and Redis (2PC across heterogeneous systems is rarely
available and operationally grim — card 59), so one copy is stale until
luck intervenes. Root cause in one sentence: **multiple destinations, no
single place where order is decided**. The fixes are exactly cards 95
(derive everything from the DB's own log) and 96 (make the event's creation
atomic with the write).

**95. How does change data capture (CDC) fix what dual writes break?**
Appoint the database the **sole writer-of-record**; everything else becomes
a *derived* copy fed from the DB's own ordered history. Mechanism: a
connector poses as a replica and tails the **logical replication log**
(card 37) — every committed change, in commit order — publishing events into
a durable log, partitioned by key so per-key order survives. All consumers
(search indexer, cache filler, warehouse loader) apply **the same sequence
in the same order** → convergence; a crashed consumer resumes at its offset;
a brand-new consumer bootstraps from an initial snapshot + the log, or from
a **compacted topic** (card 101). The order problem and the atomicity
problem both dissolve because order is decided exactly once — inside the
database's commit — and merely *propagated* everywhere else.
*Go deeper:* [Debezium — change data capture platform](https://debezium.io/)

**96. Explain the transactional outbox pattern and the problem it solves.**
The problem: "update the database **and** publish an event, atomically" —
dual writes in miniature, since the app crashing between the two leaves
state changed but the event unsent (or vice versa). The pattern: within
**one local ACID transaction**, write the business row *and* insert an
event row into an `outbox` table — a single database commit, so both happen
or neither. A relay then publishes outbox rows to the stream (polling, or
better, CDC on the outbox table itself) and marks them sent; consumers
dedupe by event ID since the relay is at-least-once. Atomicity is borrowed
from the only place it's cheap — a single database — no 2PC. Choose outbox
over raw CDC when you want **intent-level events** ("OrderPlaced", richer
than row diffs) or can't tail the DB log; they compose fine.

**97. When is event sourcing the right call — and what are its honest costs?**
Event sourcing stores the **intents** ("ItemAdded", "CouponApplied") as the
immutable source of truth; current state is a *fold* over them. Right when
history is the product: audit-heavy domains (payments, compliance),
debugging-by-replay, temporal queries ("what did the account look like on
March 3?"), and many independently evolving read models derived from one
truth. Honest costs: event **schemas become a versioned public API** —
chapter 4's rules with higher stakes, forever; current-state queries need
maintained projections; replay time grows with history (mitigate with
**snapshots**: fold once, checkpoint, replay only the tail); and
immutability is a discipline — corrections are **compensating events**,
never edits, which audits love and some teams culturally hate. For
CRUD-shaped domains with no audit need: ceremony without payoff — say so.

**98. Event time vs processing time — and what is a watermark, really?**
**Event time** = when the thing happened (source timestamp); **processing
time** = when your pipeline handled it. They diverge routinely — offline
mobile buffers, retries, consumer lag — so windowing by processing time
records *your pipeline's hiccups as user behavior*: a deploy paints a fake
traffic dip-then-spike. Event-time windows are honest but raise a new
question: when is the 10:02 window *complete*, given arrival order proves
nothing? Enter the **watermark**: a flowing, heuristic assertion — "we
believe all events with timestamp ≤ T have arrived" — calibrated from
observed lateness; when it passes the window's end, the window fires.
It's a **latency/completeness dial**, and it will sometimes be wrong, so
every event-time aggregation owes an explicit **straggler policy**: drop
(cheap, slightly wrong), update (re-emit corrected results; downstream
must handle revisions), or sideline to a late-output for reconciliation.
*Go deeper:* [Akidau et al. — The Dataflow Model (VLDB 2015)](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf)

**99. What does Kafka's "exactly-once" actually guarantee, and where does it stop?**
Two mechanisms. **Idempotent producer:** per-partition sequence numbers let
brokers detect and drop duplicate *resends* of the same batch (retries
after lost acks). **Transactions:** a consume-process-produce loop publishes
its output messages and commits its input **offsets atomically**;
`read_committed` consumers skip aborted data. Net effect:
**effectively-once processing within the Kafka loop** — a crash-and-retry
can't double-count, because reprocessed output and the offset commit abort
or land together. Where it stops: the moment results leave for an
**external system** — a database write, an email, an HTTP call is outside
the transaction — those need their own idempotency (deterministic keys,
upserts, card 63). Naming that boundary unprompted is the senior tell; it's
also card 106's opening move.
*Go deeper:* [Confluent — Exactly-once semantics in Apache Kafka](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/)

**100. A consumer is permanently slower than its producer. What happens, and what do you do?**
On a log, the broker doesn't suffer — *you* do, on a timer: **lag grows
monotonically**, your derived views go increasingly stale, and when lag
exceeds **retention**, the consumer's next read finds the data already
deleted — silent, permanent loss of unprocessed events. Responses, in
order: **scale consumers** — bounded by partition count, so you may need to
repartition (an operation to plan, not improvise); make processing cheaper
(batching, async I/O, remove per-event round-trips — the usual culprit);
**shed or sample** if the use case tolerates it; raise retention to buy
runway (storage cost). The non-negotiable: alert on **lag-vs-retention
headroom** ("hours until data loss"), not just absolute lag — the second
number is the one that pages someone in time.

**101. What is log compaction, and what does a compacted topic give you?**
Background compaction keeps, for each **key**, only the **latest** value
(and drops keys whose latest value is a *tombstone* — the deletion marker).
The topic stops being "everything that ever happened" and becomes "current
state of every key, expressed as a log" — bounded in size by the keyspace,
not by time. What that buys: a **bootstrappable changelog** — a new consumer
(fresh cache, new search index, recovering stream-processor state) reads the
compacted topic from the beginning and arrives at full current state, no
separate snapshot system needed; Kafka Streams persists its state stores
exactly this way. Limits to name: intermediate history is gone (event
sourcing wants full retention, possibly tiered); tombstones must be retained
long enough for slow consumers to see deletions; compaction is asynchronous,
so recent duplicates per key still appear.

**102. "A table is a view of a stream; a stream is the changelog of a table." Unpack the duality.**
Fold a changelog (insert/update/delete events) and you get the table's
current state; record every change to a table and you get a stream — each
is derivable from the other, which is why this is called **stream-table
duality**. It's the WAL idea (every database already *is* a table fed by a
log) promoted to an architecture principle. Consequences: stream-processor
**state is a changelog** persisted to a compacted topic (card 101), so
failed nodes rebuild state by replay; a **cache is a fold** of the source's
CDC stream rather than a thing you invalidate by guesswork; stream-table
joins (card 103) are really stream-stream joins where one side folds into
state. The slogan worth memorizing: *state is a cache of the log; keep the
log and every state is disposable.* That's the load-bearing beam under cards
95, 100, 101, and 105.
*Go deeper:* [Jay Kreps — The Log](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)

**103. Name the three stream join types and the temporal gotcha in stream-table joins.**
**Stream–stream:** correlate two event streams within a time window
(searches ↔ subsequent clicks); the processor buffers both sides, keyed,
with the window bounding state size. **Stream–table:** enrich events with
reference data (clicks ↔ user profiles); the table is held as local state,
kept current by consuming its **changelog** — CDC again, so really a
stream-stream join where one side folds into state (card 102).
**Table–table:** both sides arrive as changelogs; the maintained result is a
materialized view whose output is itself a changelog. The gotcha:
"stream-table" joins against state-as-of-**processing** — replay last
month's events today and they enrich against *today's* profiles, so
reprocessing isn't deterministic. If that matters (it often does for
correctness audits), you need **temporal/versioned tables** — join each
event against the table *as of the event's timestamp* — at real storage
cost. Naming that trade-off is the differentiator.

---

## J. Architecture, correctness & the future (DDIA ch. 12)

**104. "Unbundling the database" — the pitch and the invoice.**
Look inside one database: a write updates the WAL, the heap, B-tree
indexes, materialized views — many structures kept consistent by one
internal, ordered log. Real organizations run those *components* as
separate products (OLTP store, search, cache, warehouse) — indexes of the
same data with the lockstep mechanism missing. **The pitch:** restore it —
one ordered change log (CDC from the system of record) that every
specialized system consumes; same inputs, same order ⇒ convergence (state
machine replication, card 78, at org scale). Views become best-of-breed,
independently scaled, *rebuildable by replay*, and failure-isolated (a slow
warehouse never blocks checkout). **The invoice:** views lag — no
cross-view read-your-writes by default; no transactions across views; the
log is now tier-zero infrastructure; and event schemas are a public API
carrying chapter-4 evolution duties forever.
*Go deeper:* [Kleppmann — Turning the database inside-out](https://martin.kleppmann.com/2015/11/05/database-inside-out-at-oredev.html) · [talk transcript at Confluent](https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/)

**105. Lambda vs kappa — and the invariant beneath both.**
The problem both solve: derived views must be **recomputed** when logic
changes (bug fixes, redefined metrics) while staying current. **Lambda:**
run both modes forever — a batch layer periodically recomputes everything
from the immutable raw store (correct, stale) and a speed layer
stream-processes the recent tail (fresh, approximate); queries merge the
two. Cost: the *same business logic implemented twice* in two frameworks
that drift subtly, plus merge complexity. **Kappa:** one replayable log with
long retention; new logic = start a second job from offset 0, let it rebuild
the view in parallel, then **switch reads atomically** and retire v1.
Lambda made sense when stream processors were lossy; once logs got cheap
retention and streaming got exactly-once state (card 99), the dual-codebase
tax stopped buying correctness. The invariant either way — say it —
**immutable raw input + rebuildable views = the freedom to be wrong and
recover.**

**106. Your broker is exactly-once and your DB is ACID — explain how a user still gets double-charged, and the fix.**
Walk the layers. The user taps *pay*; the response is lost; the client (or
human) retries — **two requests born above every guarantee**. TCP deduped
retransmissions *within each connection* — the retry was a new connection.
The load balancer routed it to a different healthy instance. The service
published two *distinct* messages; the broker's exactly-once faithfully
delivered both (its sequence numbers dedupe only its own resends — card 99).
Every layer kept its scoped promise; the duplicate sailed through because it
was created **above all of them**. That's the **end-to-end argument**
(Saltzer, Reed & Clark, 1984): functions like duplicate suppression can only
be completed at the endpoints, with application knowledge; lower layers can
optimize, never own. The fix: the client mints an **operation ID at the
moment of intent**; every hop carries it; the final write enforces it —
`op_id UNIQUE`, insert-or-return-original — making retries safe at every
layer. *The request ID is the truth; everything below is transport.*
*Go deeper:* [Saltzer, Reed & Clark — End-to-End Arguments in System Design (PDF)](https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf)

**107. Distinguish timeliness from integrity, and show how the split changes a design.**
Two properties hiding inside "consistency". **Timeliness:** readers see
up-to-date state. Violations are *self-healing* — a stale read fixes itself
by waiting; products tolerate astonishing amounts of it (your bank statement
is "as of yesterday"). **Integrity:** the data is *right* — nothing lost,
nothing double-counted, derived state actually corresponds to its sources.
Violations are **permanent until explicitly repaired**, and tolerance is
near zero. Design consequence: spend coordination on integrity, relax
timeliness as far as the product allows. Example: an analytics pipeline may
lag minutes (timeliness relaxed, async log) but must never double-count
revenue (integrity absolute: exactly-once processing + idempotent sink + end-
to-end IDs). A pre-trade risk check inverts it — it needs *now*, so that one
path pays for linearizable reads. The most common over-engineering in system
design is buying timeliness nobody asked for; the most common silent failure
is gambling integrity to avoid it.

**108. Enforce "usernames are unique" at scale without a distributed lock.**
Let a **log decide**. Partition a `username-claims` topic by
`hash(username)`: all claims for a given name land in **one partition, in
one total order** (per-partition order is the cheap guarantee — card 92). A
single-threaded-per-partition processor reads claims in order, grants the
first, rejects the rest, and emits accepted/rejected events the application
awaits. That's linearizable *for that key* — consensus-grade ordering
borrowed from the log's own replication (card 78) — while scaling
horizontally across keys, with no lock service in the request path. Name
the boundary: constraints **spanning** partitions (transfer between two
accounts) need either multi-partition transactions or the **apologies
pattern** — allow the rare violation, detect it from the log, compensate
(how airlines oversell and banks reconcile). Coordination buys certainty
before the fact; apologies buy availability and absorb the faults
coordination can't reach anyway.

**109. How does "delete this user" actually work in an immutable-log architecture?**
Replay-everything collides head-on with erasure rights (GDPR's storage
limitation and right to erasure) unless deletion is *designed as a data-flow
feature*. The standard toolkit: **crypto-shredding** — encrypt each user's
data under a per-user key; deletion = destroy the key, instantly rendering
every log entry, derived view, *and backup* unreadable without touching
them; **tombstones on compacted topics** (card 101) so current-state
changelogs actually drop the keys (retain tombstones long enough for slow
consumers); **bounded retention** on raw topics so history ages out by
policy; and **deletion events** that every derived view must consume and
honor — with verification by replay/audit that they did. The interview
point: in a log-centric architecture, deletion is propagation with
acceptance criteria — "where does this user's data flow, and how do I prove
it's gone everywhere?" — not a `DELETE` statement.
*Go deeper:* [Regulation (EU) 2016/679 (GDPR) — official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

---

*Bonus drill once the deck is easy: pick any card and answer the standing
staff follow-ups — "what do you monitor for this?", "what breaks at 10×?",
and "what would make you choose the other option?" Then chain cards: trace
one payment from the client tap through retries (63–64), the outbox (96),
the log (92–93), exactly-once processing (99), and the end-to-end ID that
makes the whole chain safe (106). Being able to walk that chain fluently is
worth more than any single card.*
