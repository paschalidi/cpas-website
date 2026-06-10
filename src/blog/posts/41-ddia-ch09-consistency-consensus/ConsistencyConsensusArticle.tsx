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
import LinearizableVsEventual from '../../components/ddia/animations/LinearizableVsEventual';
import TwoPhaseCommitLab from '../../components/ddia/animations/TwoPhaseCommitLab';
import RaftLab from '../../components/ddia/animations/RaftLab';

export default function ConsistencyConsensusArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <H2 id="linearizability">Linearizability: the single-copy illusion</H2>
        <p>
          Replication's embarrassing secret: with multiple copies, "the
          current value" stops being well-defined — different replicas hold
          different nows. <strong>Linearizability</strong> is the promise that hides
          this: the system behaves <em>as if</em> there were exactly one copy, and
          every operation takes effect atomically at some instant between its start
          and its finish. The observable consequence: once any client reads the new
          value, no client may subsequently read the old one. Watch the violation
          first, then the guarantee:
        </p>

        <LinearizableVsEventual />

        <Callout type="definition" title="linearizability ≠ serializability">
          <p>
            The most-confused pair in interviews. <strong>Serializability</strong>{" "}
            (chapter 7) is about <em>transactions</em>: multi-object groups behave as
            if run in some serial order — which may be reordered relative to real
            time. <strong>Linearizability</strong> is about <em>single objects</em>:
            reads/writes respect real-time order, no grouping. They're
            orthogonal; both together = <em>strict serializability</em> (what
            Spanner sells). A serializable DB can serve you stale data; a
            linearizable register knows nothing about transactions.
          </p>
        </Callout>
        <p>
          Who actually needs it: <strong>locking and leader election</strong> (a
          lock that two nodes both "hold" is not a lock),{" "}
          <strong>uniqueness constraints</strong> (usernames, seat 14B, double-spend
          prevention), and <strong>cross-channel coordination</strong> (the email
          service must agree with the app about whether the order shipped). Who
          doesn't: feeds, like-counters, analytics, caches — most traffic, by
          volume. And note what fails to provide it: read-from-any-replica
          leader/follower setups (the animation), and even Dynamo-style strict
          quorums (w + r &gt; n) without extra read-repair machinery — overlap
          guarantees you <em>touch</em> the newest value, not that the system
          behaves like one copy.
        </p>

        <H2 id="ordering-causality">Ordering, causality, total order</H2>
        <p>
          Linearizability is one big idea — <em>everyone agrees on one timeline</em>{" "}
          — and that idea decomposes. <strong>Causal consistency</strong> keeps only
          the order that <em>matters</em>: if B could have been influenced by A
          (read it, replied to it, happened after it in one session), everyone sees
          A before B. Concurrent events — neither aware of the other — may be seen
          in different orders by different observers. It's the strongest level
          that doesn't require coordination on every operation: replicas can
          keep serving during partitions.
        </p>
        <p>
          How to get order without wall clocks (chapter 8 burned those):{" "}
          <strong>Lamport timestamps</strong> — a counter every node carries, set to{" "}
          <code>max(seen, local) + 1</code> on each event, breaking ties by node ID.
          They guarantee: if A caused B, then ts(A) &lt; ts(B). They give you a
          total order <em>after the fact</em>; what they can't do is tell you,
          at decision time, whether some unseen concurrent operation is about to
          beat you. Two users claim a username "simultaneously" — Lamport
          order will eventually rank the claims, but the loser already got a success
          response. To <em>enforce</em> uniqueness you must know the order is final
          when you answer.
        </p>
        <Callout type="insight">
          <p>
            That requirement has a name: <strong>total order broadcast</strong> —
            messages delivered to every node, in the same order, exactly once,
            reliably. Make all replicas apply a TOB stream and you get state machine
            replication; make "claim username" a TOB message and the
            first claim in the final order wins, decidably. And here is the
            chapter's hinge: <em>total order broadcast is equivalent to
            consensus</em>. Solve either, you've solved both.
          </p>
        </Callout>

        <H2 id="cap">CAP, defanged</H2>
        <p>
          The honest version of CAP is one sentence: <em>when a network partition
          happens, each side must either refuse some operations (stay consistent) or
          answer with possibly-stale data (stay available)</em>. Not "pick two
          of three" — partition tolerance isn't optional (partitions
          happen whether you tolerate them or not), and the choice only exists{" "}
          <em>during</em> a partition. In normal operation the real trade is{" "}
          <strong>latency vs consistency</strong>: linearizable operations pay
          coordination round-trips on every request, partition or no partition.
          That's why systems forgo linearizability mostly for speed, not for
          disaster-tolerance.
        </p>
        <Callout type="interview" title="say this, not 'pick two'">
          <p>
            "CAP only bites during partitions: minority side blocks (CP-ish)
            or serves stale (AP-ish) — and outside partitions the cost of strong
            consistency is latency. I'd choose <em>per operation</em>:
            linearizable for the username claim and the lock; causal/eventual for
            the feed." That answer ages well in any interview.
          </p>
        </Callout>

        <H2 id="atomic-commit">Atomic commit and 2PC</H2>
        <p>
          Different problem, same neighborhood: a transaction touches{" "}
          <em>multiple systems</em> (two shards, a DB and a message broker), and
          must commit everywhere or nowhere. A node that committed can't
          un-commit — so everyone must become certain of the outcome <em>before</em>{" "}
          anyone acts. The classic protocol buys that certainty with a coordinator
          and a promise:
        </p>

        <TwoPhaseCommitLab />

        <p>
          The two ideas worth quoting: a YES vote is a <strong>binding
          promise</strong> (the participant has WAL-ed everything and surrendered
          its right to abort), and the <strong>commit point is one disk write on
          the coordinator</strong> — all the atomicity of the distributed protocol
          reduces to one local append. The flaw follows directly: between
          promise and decision, participants are <em>in doubt</em>, holding locks,
          and the only entity that can release them is the very node that just
          crashed. 2PC achieves atomicity by <em>concentrating</em> failure, not
          eliminating it. XA distributed transactions inherit all of this, which is
          why ops teams flinch at them: stuck in-doubt transactions holding locks
          until a human intervenes.
        </p>

        <H2 id="consensus-raft">Consensus: Raft</H2>
        <p>
          Consensus — several nodes irrevocably agreeing on a value — sounds
          abstract until you list its disguises: total order broadcast (agree on
          the next log entry, repeatedly), leader election (agree who leads),
          atomic commit done right (agree commit-or-abort on a replicated
          coordinator), linearizable CAS (agree which write wins). One algorithm
          family to rule them all; Raft is the one designed to be understood.
          Its full arc, including the part 2PC couldn't do — surviving the
          death of the node in charge:
        </p>

        <RaftLab />

        <Callout type="pitfall" title="three details that separate juniors from seniors">
          <p>
            (1) A leader commits an entry only when a <em>majority</em> holds it —
            and only counts entries <em>from its own term</em>. (2) Reads need care
            too: a deposed leader can serve stale reads unless reads go through the
            log, a read-index check, or a leader lease. (3) Majority means{" "}
            <em>availability requires ⌈(n+1)/2⌉ alive and connected</em> — a
            5-node cluster split 2/3 keeps working on the 3 side; split 2/2/1, it
            stops entirely. Odd cluster sizes exist because 4 nodes tolerate the
            same one failure as 3 while adding coordination cost.
          </p>
        </Callout>

        <InTheWild
          title="Raft: the consensus algorithm designed to be teachable"
          sources={[
            { label: "Ongaro & Ousterhout, \"In Search of an Understandable Consensus Algorithm\" (USENIX ATC '14)", href: "https://raft.github.io/raft.pdf" },
            { label: "raft.github.io — visualizations & ecosystem", href: "https://raft.github.io/" },
          ]}
        >
          <p>
            Raft's explicit design goal was understandability — Paxos was so
            famously hard to implement correctly that the authors made
            decomposition (leader election / log replication / safety) the
            contribution itself, and it won Best Paper at USENIX ATC 2014. The bet
            paid off in adoption: etcd, Consul, CockroachDB, TiKV and many more run
            Raft cores, and the project site lists dozens of implementations across
            languages.
          </p>
        </InTheWild>

        <InTheWild
          title="Kafka replaced ZooKeeper with its own Raft"
          sources={[
            { label: "Confluent Developer: KRaft — Apache Kafka without ZooKeeper", href: "https://developer.confluent.io/learn/kraft/" },
          ]}
        >
          <p>
            For years every Kafka cluster dragged a ZooKeeper ensemble behind it for
            controller election and metadata. KIP-500 replaced that with{" "}
            <strong>KRaft</strong>: cluster metadata becomes an ordinary Kafka log,
            replicated by a Raft quorum of controller nodes — one system to operate
            instead of two, faster controller failover, and metadata changes
            propagated as a log subscription. A tidy real-world proof of the
            chapter's equivalence: "metadata management" was a
            total-order-broadcast problem all along.
          </p>
        </InTheWild>

        <H2 id="coordination-services">ZooKeeper & etcd in practice</H2>
        <p>
          Almost nobody implements Raft at the application layer; you{" "}
          <em>outsource</em> consensus to a coordination service and build on its
          primitives. ZooKeeper and etcd are replicated, linearizable key-value
          stores with the right extras:
        </p>
        <ul>
          <li>
            <strong>Linearizable compare-and-set</strong> — the atom from which
            locks, leases and leader election are built.
          </li>
          <li>
            <strong>Sessions & ephemeral nodes</strong> — keys that vanish when
            a client's heartbeats stop: automatic lock release on crash.
          </li>
          <li>
            <strong>Watches</strong> — be notified on change, no polling.
          </li>
          <li>
            <strong>Total ordering with fencing built in</strong> — every change is
            stamped (ZooKeeper's zxid, etcd's revision), giving you
            chapter 8's fencing tokens for free.
          </li>
        </ul>
        <CodeBlock
          title="leader election via CAS, etcd-style pseudocode"
          lang="pseudo"
          code={`# campaign: create the key only if it doesn't exist (CAS on version 0)
ok, rev = etcd.txn(
    compare = [ create_revision("election/leader") == 0 ],
    success = [ put("election/leader", my_id, lease=session) ],
)
if ok:                 # I'm leader; 'rev' is my fencing token
    lead(fencing_token=rev)
else:
    watch("election/leader")        # blocked until deleted/expired
                                    # (ephemeral: auto-deleted if leader dies)

# every downstream write carries 'rev'; resources reject tokens < max seen`}
        />
        <p>
          Typical uses: distributed locks and leases, leader election, service
          discovery (which nodes are alive, at what address), config that must be
          consistent, and allocating work to partitions. The data is small and
          slow-changing — coordination metadata, not application data — which is
          exactly what a majority-round-trip-per-write system is good for.
        </p>

        <InTheWild
          title="etcd: the consensus core of every Kubernetes cluster"
          sources={[
            { label: "learnkube: Kubernetes control plane architecture", href: "https://learnkube.com/kubernetes-control-plane" },
          ]}
        >
          <p>
            Every Kubernetes cluster is, at its heart, a Raft deployment: all
            cluster state — pods, deployments, config, leases — lives in etcd, and
            the API server is approximately a validating proxy in front of it.
            Controller managers and schedulers do leader election through it;
            kubelets watch it (via the API server) for changes. When people say
            "the control plane is down," remarkably often they mean
            "etcd lost its quorum" — the blast radius of consensus
            unavailability, live in production.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Linearizability = the single-copy illusion with real-time order:
              once anyone reads the new value, nobody reads the old. Needed for
              locks, leadership, uniqueness — not for feeds and counters.
            </>,
            <>
              Linearizability ≠ serializability: real-time single-object recency
              vs transactional ordering. Together = strict serializability.
            </>,
            <>
              CAP's kernel: during a partition, refuse or go stale; the rest
              of the time the trade is latency. Choose per operation, not per
              system.
            </>,
            <>
              2PC gives atomic commit but blocks on coordinator failure
              (in-doubt participants hold locks). It is not fault-tolerant
              consensus.
            </>,
            <>
              Consensus ≡ total order broadcast; Raft = elections by majority +
              terms-as-fencing + log replication. Deploy it via ZooKeeper/etcd:
              linearizable CAS, ephemeral nodes, watches, built-in fencing tokens.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · consistency levels"
          head={["Level", "Promise", "Coordination cost", "Survives partition?", "Use for"]}
          rows={[
            [
              "Linearizable",
              "One copy, real-time order; reads never go backwards",
              "Quorum/leader round-trip per op",
              "Minority side must block",
              "Locks, leader election, uniqueness, balances",
            ],
            [
              "Causal (+ sessions: RYW, monotonic reads)",
              "Cause seen before effect; concurrent events may differ",
              "Metadata (version vectors); no global round-trip",
              "Yes — keeps serving",
              "Social/comment threads, collaborative apps, cross-device sync",
            ],
            [
              "Eventual",
              "Replicas converge...eventually; reads may be stale or reordered",
              "None",
              "Yes",
              "Caches, counters, analytics, feeds",
            ],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · 2PC vs Raft-style consensus"
          head={["", "Two-phase commit", "Raft / consensus"]}
          rows={[
            ["Problem", "Atomic commit across heterogeneous systems", "Agreement among replicas of one system"],
            ["Decider", "Single coordinator", "Elected leader + majority quorum"],
            ["Coordinator/leader dies", "Participants blocked in-doubt, holding locks", "New election (randomized timeouts); progress resumes"],
            ["Votes required", "ALL participants must say yes", "Majority suffices"],
            ["Stale-leader defense", "None inherent", "Terms reject old leaders (fencing)"],
            ["Typical deployment", "XA transactions, DB+broker pairs (decreasingly)", "etcd, ZooKeeper, CockroachDB, Spanner groups, Kafka KRaft"],
          ]}
        />

        <InterviewQA
          items={[
            {
              q: "Linearizability vs serializability — and what's strict serializability?",
              a: (
                <p>
                  Serializability: transactions (multi-object) behave as if
                  executed in <em>some</em> serial order — possibly not real-time
                  order, so stale reads are legal. Linearizability: single-object
                  operations respect real-time — once a read returns the new value,
                  later reads must too; no notion of transactions. Strict
                  serializability = both: serial order consistent with real time.
                  Spanner advertises it (external consistency); PostgreSQL
                  serializable alone does not promise it for reads.
                </p>
              ),
            },
            {
              q: "Why isn't 2PC 'consensus'? Both make nodes agree.",
              a: (
                <p>
                  Consensus must be fault-tolerant and live: a majority should make
                  progress despite node failures. 2PC requires unanimity and routes
                  the decision through one coordinator; if it dies after collecting
                  YES votes, participants can neither commit nor abort — blocked,
                  with locks held. Consensus fixes exactly this by replicating the
                  decision (majority quorum) and electing replacements for the
                  decider. Hence "run the coordinator's decision through
                  Raft" is the standard repair.
                </p>
              ),
            },
            {
              q: "How does Raft prevent split-brain — two leaders at once?",
              a: (
                <p>
                  Per term: each node votes once, a leader needs a majority, and
                  two disjoint majorities can't exist — so at most one leader
                  per term. Across terms: an old leader may linger, but every RPC
                  carries the term; any node (or the old leader itself, on hearing
                  a higher term) rejects/steps down — terms are fencing tokens.
                  Randomized election timeouts make dueling candidates rare, and a
                  candidate must hold all committed entries to win votes.
                </p>
              ),
            },
            {
              q: "Why do quorum reads/writes (w + r > n) still fall short of linearizability?",
              a: (
                <p>
                  Overlap guarantees a read <em>contacts</em> a replica with the
                  newest write, but during an in-flight write different readers can
                  see different states (one sees the new value from replica A, a
                  later reader sees only old values from B and C), and a partially
                  failed write strands a value on a minority. Linearizable behavior
                  needs more: synchronous read-repair before returning, or routing
                  through a leader/consensus. Dynamo-style stores deliberately
                  don't pay this.
                </p>
              ),
            },
            {
              q: "Design username uniqueness across regions.",
              a: (
                <p>
                  Uniqueness is a consensus problem in disguise: the first claim in
                  some agreed total order wins. Options: (a) a linearizable CAS in
                  a consensus store (etcd/ZooKeeper or a Spanner/Cockroach-style
                  DB) — simple, adds a coordination round-trip at claim time only;
                  (b) partition the namespace by hash and make each shard's
                  single leader the decider — consensus per shard, scales
                  horizontally; (c) async reservation with later reconciliation —
                  only if business tolerates "sorry, taken after all"
                  emails. Reads of profiles stay eventual; only the claim needs the
                  strong path.
                </p>
              ),
            },
            {
              q: "Why are coordination clusters 3 or 5 nodes, not 2, 4, or 50?",
              a: (
                <p>
                  Tolerating f failures needs 2f+1 nodes (majority must survive):
                  3 tolerates 1, 5 tolerates 2. Even sizes add cost without
                  tolerance — 4 nodes still tolerate only 1 (majority is 3). Large
                  clusters slow every commit (more acks to await) for tolerance you
                  rarely need; scaling read/cache tiers, not the voting set, is the
                  norm. 5 across 3 zones is the production sweet spot.
                </p>
              ),
            },
            {
              q: "When is eventual consistency simply the right answer?",
              a: (
                <p>
                  When concurrent divergence is cheap to merge or harmless to
                  expose: like counts, view counters, presence, product-page
                  caches, analytics, feeds. Signals: no invariant spans the data,
                  stale reads cost less than added latency would, writes commute
                  or merge (CRDT-ish). The pro move is naming the session
                  guarantees you still want — read-your-writes, monotonic reads —
                  which are cheap and fix the most embarrassing artifacts.
                </p>
              ),
            },
            {
              q: "What do teams actually use ZooKeeper/etcd for, and what should never go in them?",
              a: (
                <p>
                  In: leader election, distributed locks/leases, service discovery,
                  cluster membership, small consistent config, partition→node
                  assignment maps — kilobytes that change rarely but must be agreed
                  on, with fencing tokens (zxid/revision) attached. Out:
                  application data, anything high-throughput or large — every write
                  is a majority round-trip and the whole store typically lives in
                  RAM. Treat it as the cluster's tiny brainstem, not its
                  memory.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "CAP means every system picks two of C, A, and P.",
              reality: (
                <>
                  Partitions aren't optional, and the C/A choice exists only{" "}
                  <em>while</em> one is happening. Day-to-day, strong consistency
                  costs latency, not availability. The useful question is per
                  operation: which calls need linearizability?
                </>
              ),
            },
            {
              myth: "Two-phase commit is how distributed systems do consensus.",
              reality: (
                <>
                  2PC solves atomic commit and does it without fault tolerance:
                  unanimous votes, single deciding coordinator, blocking in-doubt
                  state. Consensus (Raft/Paxos) needs only majorities and survives
                  the decider's death — which is why modern systems embed it
                  instead.
                </>
              ),
            },
            {
              myth: "If w + r > n, my reads are linearizable.",
              reality: (
                <>
                  Quorum overlap ≠ single-copy behavior: concurrent and
                  partially-failed writes let readers flicker between old and new.
                  Without synchronous read repair or leader-routed reads, strict
                  quorums remain non-linearizable — by design, for latency.
                </>
              ),
            },
            {
              myth: "Once a Raft leader is elected, its writes and reads are safe.",
              reality: (
                <>
                  A deposed-but-unaware leader can still serve <em>stale reads</em>;
                  writes are fenced by terms, reads need read-index checks or
                  leases. And an entry is committed only once a majority of the{" "}
                  <em>current term</em> has it — election alone proves nothing
                  about new writes.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
