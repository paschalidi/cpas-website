import React from 'react';
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
} from '../../components/ddia/blocks';
import CodeBlock from '../../components/ddia/CodeBlock';
import KeyRangeVsHash from '../../components/ddia/animations/KeyRangeVsHash';
import HotKeyLab from '../../components/ddia/animations/HotKeyLab';
import RebalancingLab from '../../components/ddia/animations/RebalancingLab';
import RoutingPaths from '../../components/ddia/animations/RoutingPaths';

export default function PartitioningArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          One machine can only hold and serve so much. Partitioning (a.k.a.
          sharding) splits a dataset into pieces so that storage and load spread
          across many machines. The whole chapter boils down to three design
          questions: <em>how do you assign keys to partitions, how do you keep the
          assignment balanced as things change, and how do requests find the right
          partition?</em> Every real system is a particular set of answers.
        </p>

        <H2 id="why-partition">Why split the data at all</H2>
        <p>
          Imagine a library that owns more books than any single building can hold.
          You build more buildings and split the catalog between them. Now every
          decision follows from <em>how</em> you split: by author surname? By a
          random ticket number? The surname split makes browsing one author easy but
          crowds the "S" building; random tickets balance shelf space but
          scatter an author's books across the city.
        </p>
        <p>
          Databases face exactly this trade. A <strong>partition</strong> is one
          slice of the data, small enough for one node to own. The goal is{" "}
          <strong>scalability</strong>: a 10-node cluster should handle ~10× the data
          and ~10× the read/write throughput of one node. That only works if data{" "}
          <em>and load</em> spread evenly — and those are two different things, as
          we'll see.
        </p>
        <Callout type="definition" title="vocabulary">
          <p>
            <strong>Partition / shard:</strong> one slice of the keyspace, owned by
            one node at a time (the same concept is called a <em>region</em> in
            HBase, a <em>tablet</em> in Bigtable, a <em>vnode's range</em> in
            Cassandra). <strong>Skew:</strong> some partitions carrying far more data
            or traffic than others. <strong>Hot spot:</strong> a partition so
            disproportionately loaded it becomes the system's bottleneck.
          </p>
        </Callout>
        <p>
          Partitioning is usually combined with <strong>replication</strong>: each
          partition has copies on several nodes for fault tolerance. The two are
          orthogonal — this page holds replication fixed and asks only how to split.
          A node typically hosts many partitions, some as leader, some as follower.
        </p>

        <H2 id="range-vs-hash">Two ways to carve a keyspace</H2>
        <p>
          <strong>Key-range partitioning</strong> sorts all keys and cuts the sorted
          order into contiguous slices, like encyclopedia volumes: A–F, G–M, N–Z.
          The boundaries don't have to be evenly spaced alphabetically — they
          should be chosen (by an admin or automatically) so each slice holds a
          similar <em>amount of data</em>. Because keys inside a partition stay
          sorted, range scans are cheap: "all readings from sensor 17 in
          March" is one sequential read on one partition.
        </p>
        <p>
          <strong>Hash partitioning</strong> runs every key through a hash function
          and assigns the key by hash value. A decent hash (it doesn't need to
          be cryptographic) turns even highly correlated keys — like timestamps
          marching forward — into uniformly scattered values. You buy even
          distribution and pay with locality: keys that were adjacent are now on
          different machines, so a range query degenerates into asking{" "}
          <em>every</em> partition and merging (scatter–gather).
        </p>

        <KeyRangeVsHash />

        <Callout type="insight">
          <p>
            Hashing is deliberately <em>destroying information</em> — the ordering —
            to gain balance. Every consequence of hash partitioning, good and bad,
            follows from that one act of destruction. If a query needs the ordering
            back, the architecture has to rebuild it somewhere else (a secondary
            index, a sort step, a second table).
          </p>
        </Callout>
        <H3>The hybrid most systems actually use</H3>
        <p>
          Cassandra and ScyllaDB's compound primary key shows you don't
          have to pick one globally: the first column(s) — the{" "}
          <strong>partition key</strong> — are hashed to place the row; the remaining{" "}
          <strong>clustering columns</strong> keep rows sorted <em>within</em> the
          partition. Spread across the cluster, ordered inside each slice.
        </p>
        <CodeBlock
          title="schema.cql — hash across users, sort within a user"
          lang="cql"
          code={`CREATE TABLE messages (
  user_id    uuid,        -- partition key: hashed, spreads users
  sent_at    timeuuid,    -- clustering column: sorted within user
  body       text,
  PRIMARY KEY ((user_id), sent_at)
) WITH CLUSTERING ORDER BY (sent_at DESC);

-- cheap: one partition, sequential read
SELECT * FROM messages
 WHERE user_id = ? AND sent_at > ?;`}
        />
        <p>
          The same idea shows up everywhere once you see it: DynamoDB's
          partition key + sort key, Bigtable/HBase row-key prefixes, Kafka's
          "partition by key, ordered within partition." Designing the key
          is designing the partitioning.
        </p>

        <H2 id="hot-keys">Skew and the celebrity problem</H2>
        <p>
          Hashing balances <em>keys</em>, not <em>traffic</em>. If a million clients
          all read and write the <em>same</em> key — a viral post, a flash-sale SKU,
          today's date as a row key — they all hash to the same partition, and
          no amount of extra hardware helps: the hot key still lives on exactly one
          node. The book's sober conclusion is that the database can't fix
          this for you (most systems still can't); it's the
          application's job.
        </p>

        <HotKeyLab />

        <p>
          The standard application-level fix is <strong>salting</strong> (key
          splitting): append a small random suffix to the hot key so writes fan out
          over N sub-keys on N partitions. The cost lands on reads, which must now
          query all N variants and merge. So you salt only the handful of keys that
          are provably hot, and you keep track of which keys those are. Other levers:
          cache the hot value in front of the database, or redesign the key so the
          hot dimension isn't the partition key at all.
        </p>
        <Callout type="pitfall" title="monotonic keys">
          <p>
            Timestamps or auto-increment IDs as a <em>range</em> partition key
            create a permanently hot "today" partition: all writes land
            on the newest slice while old slices idle. Classic fix: prefix the key
            with something that spreads (sensor ID, tenant ID), then the timestamp —
            you keep time-ordering <em>per sensor</em> and spread load across
            sensors.
          </p>
        </Callout>

        <InTheWild
          title="DynamoDB write sharding"
          sources={[
            {
              label: "AWS DynamoDB docs: write sharding",
              href: "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html",
            },
          ]}
        >
          <p>
            AWS's own best-practice docs tell you to do exactly the salting
            trick from the animation: when one partition key takes too much write
            traffic, append a random or calculated suffix (e.g.{" "}
            <code>2014-07-09.1</code> … <code>2014-07-09.200</code>) to spread writes
            over many partitions — and accept that reads must then query every
            suffix and merge. The docs are also explicit about <em>why</em> the
            ceiling exists: each physical partition has a hard per-partition
            throughput cap, so a single hot key can throttle no matter how big the
            table is.
          </p>
        </InTheWild>

        <InTheWild
          title="Foursquare's 2010 MongoDB outage: skew + full RAM"
          sources={[
            {
              label: "10gen post-mortem (mongodb-user list)",
              href: "https://groups.google.com/g/mongodb-user/c/UoqU8ofp134",
            },
            {
              label: "High Scalability analysis",
              href: "https://highscalability.com/troubles-with-sharding-what-can-we-learn-from-the-foursquare/",
            },
          ]}
        >
          <p>
            Foursquare ran user check-ins on two MongoDB shards sized to fit in
            66 GB of RAM each. Growth across the shards was uneven; one shard
            crossed its RAM budget (~67 GB) and started paging to disk, and the
            site went down for roughly 11 hours. The deeper lesson from the
            post-mortem: adding a third shard mid-incident didn't immediately
            help, because data moved out in small chunks leaving fragmented pages —
            rebalancing under pressure is far harder than rebalancing ahead of it.
          </p>
        </InTheWild>

        <H2 id="secondary-indexes">Secondary indexes: local vs global</H2>
        <p>
          Partitioning by primary key answers "find user 17." It does
          nothing for "find all <em>red</em> cars" — color isn't the
          partition key, so matching rows live everywhere. Secondary indexes in a
          partitioned world come in exactly two shapes, and the choice is a
          read-vs-write trade:
        </p>
        <H3>Local indexes (document-partitioned)</H3>
        <p>
          Each partition indexes <em>only its own rows</em>. Writes stay cheap and
          local: updating one car touches one partition's data and that same
          partition's index. But a query by color must scatter–gather across{" "}
          <em>all</em> partitions, because any partition might hold red cars. Read
          cost grows with partition count and is hostage to the slowest partition
          (tail latency amplification).
        </p>
        <H3>Global indexes (term-partitioned)</H3>
        <p>
          Build one logical index over <em>all</em> the data, and partition the
          index itself by the indexed value: colors a–m on one index partition, n–z
          on another. Now "red cars" is one targeted index read. The bill
          moves to writes: updating one car may touch several index partitions (one
          per indexed column), each on a different node — so in practice global
          indexes are updated asynchronously, and a just-written row may briefly be
          invisible to index queries.
        </p>
        <Callout type="interview">
          <p>
            Crisp framing that interviewers reward: <strong>local index = cheap
            writes, scatter–gather reads. Global index = targeted reads,
            multi-partition (usually async) writes.</strong> DynamoDB's Global
            Secondary Indexes are the canonical example of the second shape —
            eventually consistent by design.
          </p>
        </Callout>

        <H2 id="rebalancing">Rebalancing without tears</H2>
        <p>
          Clusters change: nodes are added for capacity, die, or get replaced.{" "}
          <strong>Rebalancing</strong> moves data so load stays even after the
          change. A good scheme moves <em>no more data than necessary</em> (network
          and disk I/O during a rebalance compete with production traffic) and keeps
          serving reads and writes throughout.
        </p>
        <p>
          The tempting scheme — <code>node = hash(key) mod N</code> — fails this
          test catastrophically. Change N and almost every key's assignment
          changes, so adding one node reshuffles most of the dataset. The animation
          below shows the backfire, then the standard fix: create{" "}
          <strong>many more partitions than nodes, up front</strong>, and rebalance
          by reassigning <em>whole partitions</em> to nodes. The key→partition
          mapping never changes; only the cheap partition→node mapping does.
        </p>

        <RebalancingLab />

        <H3>Three rebalancing schemes you should be able to name</H3>
        <ul>
          <li>
            <strong>Fixed number of partitions:</strong> pick a number high enough
            for future growth (say 1,000 for a 10-node cluster) at creation time;
            moving to a new node means streaming a few whole partitions. Simple and
            predictable; the partition count is hard to change later, and each
            partition must be sized "just right" (too few = huge
            partitions, too many = per-partition overhead). Riak, Elasticsearch and
            Couchbase work this way.
          </li>
          <li>
            <strong>Dynamic partitioning:</strong> start with few partitions and
            split any partition that exceeds a size threshold (merge when it
            shrinks), like a B-tree at cluster scale. Adapts to data volume
            automatically; HBase and MongoDB do this. Caveat: a brand-new table is
            one partition on one node until it grows enough to split, so systems
            allow pre-splitting.
          </li>
          <li>
            <strong>Partitions proportional to nodes:</strong> each node owns a
            fixed count of small ranges ("virtual nodes"); a joining
            node steals slices from many existing nodes. Cassandra's vnodes are
            the canonical example.
          </li>
        </ul>
        <Callout type="pitfall" title="fully automatic rebalancing">
          <p>
            Rebalancing is expensive and slow by design. If failure detection
            triggers it automatically, a node that's merely <em>slow</em> (GC
            pause, hot CPU) can be declared dead, kicking off a mass data move that
            makes the overload worse — a cascade. That's why mature systems put
            a human in the loop or at least heavy dampening on automatic moves.
          </p>
        </Callout>

        <InTheWild
          title="Cassandra vnodes: rebalancing as a non-event"
          sources={[
            {
              label: "DataStax docs: virtual nodes",
              href: "https://docs.datastax.com/en/cassandra-oss/3.0/cassandra/architecture/archDataDistributeVnodesUsing.html",
            },
          ]}
        >
          <p>
            Classic consistent hashing gave each machine one token (one ring
            position); adding capacity meant manually computing and assigning new
            tokens. With virtual nodes, each machine owns many small,
            randomly-scattered token ranges. A node that joins automatically takes an
            even share of slices <em>from every existing node</em>, and a dead
            node's ranges are rebuilt by many peers in parallel instead of
            hammering one neighbor — no manual token math, no rebalancing ceremony.
          </p>
        </InTheWild>

        <H2 id="routing">Finding the data: request routing</H2>
        <p>
          After all this, a client holding a key still has to reach the right node —
          and the answer changes whenever rebalancing moves a partition. The
          question "who owns key K <em>right now</em>?" has exactly three
          architectural answers, and you can place most real systems by which one
          they chose.
        </p>

        <RoutingPaths />

        <p>
          Underneath any of the three, <em>something</em> must hold the
          authoritative partition map and propagate changes. Two common designs: a
          separate <strong>coordination service</strong> (ZooKeeper/etcd) that nodes
          register with and routers subscribe to — HBase and Kafka's older
          architecture work this way — or <strong>gossip</strong> among the data
          nodes themselves, with no extra service to operate, as in Cassandra and
          Riak. Either way the map is small, changes rarely, and is aggressively
          cached; stale caches are handled with redirects plus a refreshed map.
        </p>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Partitioning splits data and load across nodes; it's orthogonal
              to replication. The three design axes: <strong>key→partition
              assignment, rebalancing, routing</strong>.
            </>,
            <>
              <strong>Range partitioning</strong> keeps sort order → cheap range
              scans, risk of hot spots from correlated keys.{" "}
              <strong>Hash partitioning</strong> destroys order → even spread,
              scatter–gather range queries. Compound keys (hash, then sort) give
              both.
            </>,
            <>
              Hashing balances keys, not traffic: a single celebrity key still
              lands on one partition. Fixes are application-level — salting hot keys
              (spread writes, pay with read fan-out), caching, key redesign.
            </>,
            <>
              Never assign with <code>hash mod N</code>. Pre-create many fixed
              partitions (or split dynamically) and rebalance by moving{" "}
              <em>whole partitions</em> — minimum data movement, key mapping never
              changes.
            </>,
            <>
              Secondary indexes: <strong>local</strong> = write-cheap,
              scatter–gather reads; <strong>global</strong> = read-targeted,
              multi-partition async writes. Routing needs an authoritative map —
              coordination service or gossip.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · partitioning strategies"
          head={["Strategy", "Range queries", "Load balance", "Hot-spot risk", "Used by"]}
          rows={[
            [
              "Key range",
              "One partition, sequential ✓",
              "Needs boundary tuning",
              "High (correlated keys)",
              "HBase, Bigtable, MongoDB (range)",
            ],
            [
              "Hash of key",
              "Scatter–gather all partitions ✗",
              "Even by construction",
              "Only single-key celebrities",
              "Cassandra, DynamoDB, Voldemort",
            ],
            [
              "Hash + sort key (compound)",
              "Within one partition ✓",
              "Even across partition keys",
              "Hot partition key still possible",
              "Cassandra/Scylla, DynamoDB",
            ],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · secondary indexes under partitioning"
          head={["Index type", "Write path", "Read path", "Consistency", "Example"]}
          rows={[
            [
              "Local (by document)",
              "1 partition, synchronous",
              "Scatter–gather all partitions",
              "Index in step with data",
              "Cassandra 2i, Elasticsearch shard-local",
            ],
            [
              "Global (by term)",
              "May touch several index partitions, usually async",
              "Targeted: 1 index partition",
              "Often eventually consistent",
              "DynamoDB GSI",
            ],
          ]}
          footnote="Tail-latency note: scatter–gather reads are as slow as the slowest partition you ask — fan-out multiplies your p99 exposure."
        />

        <InterviewQA
          items={[
            {
              q: "How would you partition a time-series workload (IoT sensor readings) and why?",
              a: (
                <p>
                  Compound key: partition by <code>sensor_id</code> (hashed) and
                  sort by <code>timestamp</code> within the partition. Pure
                  timestamp-range partitioning makes "now" a permanent
                  write hot spot; pure hashing of (sensor, timestamp) destroys the
                  time-range scans the workload lives on. The compound key spreads
                  writes across sensors while keeping each sensor's history
                  contiguous. If a few sensors are extremely chatty, salt only
                  those.
                </p>
              ),
            },
            {
              q: "Why is hash mod N a bad rebalancing strategy, and what's used instead?",
              a: (
                <p>
                  Because the assignment of nearly every key depends on N: going
                  from 3 to 4 nodes changes <code>h mod N</code> for ~75% of keys,
                  so one added node triggers a near-total reshuffle. Instead,
                  decouple key→partition (fixed: many partitions created up front,
                  or dynamic splits) from partition→node. Rebalancing then moves a
                  few whole partitions — the theoretical minimum — and the
                  key-to-partition mapping never changes.
                </p>
              ),
            },
            {
              q: "A single product page is getting 100k QPS and melting its partition. Options?",
              a: (
                <p>
                  In rough order: (1) cache it — a hot <em>read</em> key is a CDN /
                  in-memory cache problem; (2) if writes are hot (counters, likes),
                  salt the key into N sub-keys and aggregate on read or in the
                  background; (3) move the hot dimension out of the partition key
                  (e.g. shard counters by user-bucket); (4) if the platform supports
                  it, isolate the key (some systems split a hot partition
                  automatically). Adding nodes alone does nothing — the key still
                  maps to one partition.
                </p>
              ),
            },
            {
              q: "Local vs global secondary index — which would you pick for a read-heavy product-search filter?",
              a: (
                <p>
                  Global (term-partitioned). Read-heavy filtering wants targeted
                  reads: one index partition per term instead of fanning out to
                  every data partition. Accept the costs: writes touch multiple
                  index partitions and the index is typically asynchronously
                  updated, so a freshly listed product may lag in search briefly.
                  If writes dominated and slightly slow filtered reads were fine,
                  local indexes would flip the trade.
                </p>
              ),
            },
            {
              q: "How do requests find the right partition after a rebalance?",
              a: (
                <p>
                  Three patterns: (1) ask any node, nodes forward (gossip-shared
                  map — Cassandra); (2) a routing tier owns the map (MongoDB's
                  mongos); (3) partition-aware clients cache the map and dial
                  directly. All need an authority for the map — a coordination
                  service like ZooKeeper/etcd that watchers subscribe to, or gossip
                  convergence. Stale caches are normal and handled by
                  redirect-plus-refresh, since the map changes rarely.
                </p>
              ),
            },
            {
              q: "Why do scatter–gather queries hurt more than 'N small queries' suggests?",
              a: (
                <p>
                  Latency is set by the slowest responder. If each partition's
                  p99 is 50 ms, a 100-way fan-out hits a 50 ms-or-worse
                  straggler on almost every request — your p50 becomes everyone
                  else's p99 (tail-latency amplification). That's why
                  global indexes, careful key design, and bounding fan-out matter
                  more as partition count grows.
                </p>
              ),
            },
            {
              q: "When would you deliberately choose range partitioning despite hot-spot risk?",
              a: (
                <p>
                  When the dominant queries are range scans over the sort key:
                  time windows, leaderboard slices, prefix lookups. You then manage
                  skew explicitly — choose boundaries by data volume, pre-split
                  known-hot ranges, prefix keys to spread writes. HBase/Bigtable
                  made this choice; their whole design assumes sorted scans matter
                  more than uniform write spread.
                </p>
              ),
            },
            {
              q: "Does adding replicas fix a hot partition?",
              a: (
                <p>
                  For <em>reads</em>, partially — read replicas of the hot
                  partition can share read traffic (at staleness cost on async
                  replication). For <em>writes</em>, no — writes must go through
                  the partition's leader, so the single hot leader remains the
                  bottleneck. Write hot spots need salting, batching/aggregation,
                  or key redesign.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "Hash partitioning means no hot spots.",
              reality: (
                <>
                  It evens out <em>key placement</em>, not <em>per-key traffic</em>.
                  Every request for the same viral key hashes to the same
                  partition. Skewed workloads need application-level fixes:
                  salting, caching, key redesign.
                </>
              ),
            },
            {
              myth: "More nodes = more throughput, always.",
              reality: (
                <>
                  Only if load actually spreads. A workload dominated by one hot
                  key or one hot range gains nothing from extra nodes; and
                  scatter–gather query patterns can get <em>slower</em> as fan-out
                  (and tail-latency exposure) grows.
                </>
              ),
            },
            {
              myth: "Consistent hashing solved rebalancing, end of story.",
              reality: (
                <>
                  The hash-ring idea (don't use mod N) is necessary, not
                  sufficient: one token per node still moves a big contiguous chunk
                  between two neighbors. Real systems add many partitions/vnodes
                  per node so a join/leave shifts many small slices from/to many
                  peers.
                </>
              ),
            },
            {
              myth: "Secondary indexes work the same as on a single node.",
              reality: (
                <>
                  On one node an index is one lookup. Partitioned, you must pick:
                  local indexes (every query fans out) or global indexes (targeted
                  reads, but multi-partition and usually async writes — your index
                  can briefly lie).
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
