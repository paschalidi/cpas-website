import React from "react";
import DDIAThemeProvider from '../../components/ddia/DDIAThemeProvider'
import {
  H2,
  H3,
  Callout,
  InTheWild,
  KeyTakeaways,
  CheatTable,
  InterviewQA,
  Misconceptions,
} from '../../components/ddia/blocks'
import CodeBlock from '../../components/ddia/CodeBlock'
import MapReduceWordCount from '../../components/ddia/animations/MapReduceWordCount'
import BatchJoins from '../../components/ddia/animations/BatchJoins'
import PipelineVsMaterialize from '../../components/ddia/animations/PipelineVsMaterialize'

export default function BatchProcessingArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          Everything so far asked "what happens when a request arrives?"
          Batch processing asks a calmer question: given a <em>bounded, immutable
          mountain</em> of input, produce derived output — search indexes,
          recommendation models, reports — with throughput, not latency, as the
          score. The chapter's arc: Unix pipes scaled up to MapReduce, then
          refined into dataflow engines; the design instincts (immutability, pure
          stages, explicit dataflow) carry straight into stream processing and
          modern data platforms.
        </p>

        <H2 id="unix-philosophy">Unix: the original batch engine</H2>
        <p>
          Start small. Top 5 most-visited URLs from a web server log, no database in
          sight:
        </p>
        <CodeBlock
          title="a batch pipeline in one line"
          lang="bash"
          code={`cat access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -n 5
#    read         extract URL      group  count    rank        take 5`}
        />
        <p>
          Four design decisions hide in that line, and all of them reappear at
          cluster scale. <strong>Uniform interface:</strong> every stage reads and
          writes the same thing (lines of text), so arbitrary programs compose.{" "}
          <strong>Pure stages:</strong> no program modifies the input file —{" "}
          <code>access.log</code> is immutable; you can rerun endlessly while
          experimenting. <strong>Explicit dataflow:</strong> the pipe operator is
          the architecture diagram. <strong>Sort as the workhorse:</strong>{" "}
          <code>sort</code> spills sorted runs to disk and merges them, so the
          pipeline gracefully handles data far larger than RAM — grouping equal
          keys by sorting, not by hashing in memory.
        </p>
        <Callout type="insight">
          <p>
            MapReduce is best understood as this pipeline made distributed:{" "}
            <code>awk</code> becomes your mapper, <code>sort</code> becomes the
            shuffle (performed by the framework, always), <code>uniq -c</code>{" "}
            becomes your reducer. The single biggest limitation it fixes: a Unix
            pipe runs on one machine; the shuffle is a sort that spans a thousand.
          </p>
        </Callout>

        <H2 id="mapreduce-model">MapReduce: the model</H2>
        <p>
          The programming contract: you supply two pure callbacks.{" "}
          <strong>map(record) → list of (key, value)</strong> — extract and tag;{" "}
          <strong>reduce(key, values) → output</strong> — aggregate one group. The
          framework owns everything between: scheduling mappers near their data,
          partitioning by key, sorting, shuffling, retrying failed tasks. Watch the
          full journey of seven little key-value pairs:
        </p>

        <MapReduceWordCount />

        <CodeBlock
          title="word count, the whole program you write"
          lang="pseudo"
          code={`def map(_, line):
    for word in tokenize(line):
        emit(word, 1)

def reduce(word, counts):          # counts arrive grouped, via sorting
    emit(word, sum(counts))

# optional combiner (runs on mappers, must be assoc. + commutative):
combiner = reduce`}
        />
        <p>
          Fault tolerance is refreshingly blunt: tasks are pure functions of
          immutable input, so a failed task is simply <em>re-run elsewhere</em> —
          no transactions, no apologies. Mapper output is materialized to local
          disk before reducers consume it, bounding how much work a crash can
          destroy. This retry-everything stance is also why MapReduce tolerated
          running as the lowest-priority tenant on shared clusters: preemption is
          just another failure.
        </p>

        <InTheWild
          title="The 2004 paper that named the pattern"
          sources={[
            {
              label: "Dean & Ghemawat, \"MapReduce: Simplified Data Processing on Large Clusters\" (OSDI '04)",
              href: "https://www.usenix.org/conference/osdi-04/mapreduce-simplified-data-processing-large-clusters",
            },
          ]}
        >
          <p>
            Google's OSDI 2004 paper framed the contribution as an{" "}
            <em>interface</em>: hundreds of internal jobs — index building, log
            analysis, graph computations — rewritten as just map and reduce, with
            one runtime handling parallelization, locality, and failures across
            thousands of commodity machines. The open-source echo (Hadoop) defined
            a decade of data infrastructure, and the shuffle architecture survives
            inside every engine that replaced it.
          </p>
        </InTheWild>

        <H2 id="joins">Joins and the skew problem</H2>
        <p>
          Real analyses correlate datasets: clicks with users, orders with
          products. In batch there are no index lookups — querying a remote
          database from a mapper would be slow and non-reproducible — so a join is
          a <em>physical meeting</em> of matching records, arranged one of two
          ways:
        </p>

        <BatchJoins />

        <Callout type="pitfall" title="the straggler that ate the job">
          <p>
            Skew deserves its own alarm. Hash partitioning sends each key to
            exactly one reducer — so one viral user/product/url turns into one
            reducer doing 100× the work while the cluster idles. Standard moves:
            salt the hot keys (spread, then re-aggregate — chapter 6's trick),
            broadcast-join the side that contains the hot keys, or use a
            skew-aware join that samples key frequencies first. If a batch job is
            mysteriously slow, check the partition sizes before anything else.
          </p>
        </Callout>

        <H2 id="outputs">Outputs: build, don't mutate</H2>
        <p>
          Batch jobs rarely end in row-by-row writes to a live database — that
          would be slow (network round-trip per record), risky (a half-failed job
          leaves the DB half-updated), and unkind to the serving workload. The
          batch-native pattern: <strong>build a complete, immutable output, then
          swap it in atomically.</strong> Search indexes are the canonical case:
          crunch documents → write index files → flip a symlink. Need key-value
          serving? Build the store's files <em>inside</em> the job and bulk-load
          them.
        </p>
        <p>
          The payoff is what the chapter memorably calls human fault tolerance:
          deploy a buggy job, get a bad output — and recovery is{" "}
          <em>point back at yesterday's output and rerun</em>. Inputs were
          immutable; nothing precious was overwritten. Compare a buggy service that
          spent the afternoon mutating production rows. Minimizing
          irreversibility, it turns out, is a feature you can architect.
        </p>
        <Callout type="interview" title="say the pattern out loud">
          <p>
            "The batch job writes a <em>new versioned artifact</em>; serving
            atomically switches to it; rollback is switching back." This
            sentence upgrades almost any design-interview answer involving derived
            data — recommendations, feature stores, search.
          </p>
        </Callout>

        <H2 id="beyond-mapreduce">Beyond MapReduce: dataflow</H2>
        <p>
          MapReduce's simplicity has a tax: every job ends in a full,
          replicated write of its output, and real pipelines are <em>chains</em> of
          jobs. The successor generation (Spark, Tez, Flink) keeps the shuffle but
          removes the forced materialization between stages:
        </p>

        <PipelineVsMaterialize />

        <CodeBlock
          title="the same pipeline, dataflow style"
          lang="pseudo"
          code={`result = read("logs/2026-06-10/*")
    .map(parse)                      ┐ narrow deps —
    .filter(r -> r.status == 200)    ┘ pipelined in memory
    .join(users, on="user_id")       ← wide dep: shuffle happens here
    .groupBy("country").count()      ← wide dep: and here
    .write("clicks_by_country/v=42") # immutable, versioned output

# engine sees the WHOLE graph → plans shuffles, pipelines the rest;
# lost partitions recomputed from lineage, not from temp files`}
        />
        <p>
          Keep the vocabulary precise: <strong>narrow dependencies</strong>{" "}
          (map, filter — each output partition needs one input partition) are
          pipelined; <strong>wide dependencies</strong> (joins, group-bys — need
          repartitioning by key) still shuffle, because sorting/regrouping is
          fundamental to the <em>problem</em>, not to MapReduce. Fault tolerance
          swaps files for <strong>lineage</strong>: recompute lost partitions from
          their deterministic recipe, checkpointing occasionally so the recipe
          never gets too long. Determinism becomes a correctness requirement, not
          just good style.
        </p>

        <InTheWild
          title="Spark's RDD paper: lineage instead of replication"
          sources={[
            {
              label: "Zaharia et al., \"Resilient Distributed Datasets\" (NSDI '12)",
              href: "https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/zaharia",
            },
            { label: "Apache Spark research page", href: "https://spark.apache.org/research.html" },
          ]}
        >
          <p>
            The NSDI 2012 RDD paper made the case that you can keep working sets in
            memory <em>and</em> stay fault-tolerant by logging the coarse-grained
            transformations (the lineage) rather than the data — losing a partition
            means re-deriving it, not restoring a replica. The headline numbers
            targeted exactly MapReduce's weak spot: iterative algorithms that
            reread HDFS every pass. Spark's subsequent dominance of the batch
            world traces back to this one design swap.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Batch = bounded immutable input → derived output; optimize
              throughput. The Unix instincts scale up: pure stages, immutable
              inputs, explicit dataflow, sort as the grouping engine.
            </>,
            <>
              MapReduce contract: map extracts & tags, the shuffle is a
              distributed sort-by-key (the framework's half), reduce
              aggregates per group. Fault tolerance = re-run pure tasks.
            </>,
            <>
              Joins are physical meetings: reduce-side sort-merge (general, pays
              full shuffle) vs map-side broadcast/partitioned-hash (fast, needs
              preconditions). Skew from hot keys is the #1 real-world slowdown —
              salt or broadcast.
            </>,
            <>
              Outputs are built, not mutated: complete immutable artifact, atomic
              swap, instant rollback — "human fault tolerance".
            </>,
            <>
              Dataflow engines = same shuffle, minus forced materialization:
              narrow deps pipeline in memory, wide deps shuffle, lineage replaces
              temp files for recovery. Iterative workloads benefit most.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · batch join strategies"
          head={["Strategy", "How", "Requires", "Cost profile"]}
          rows={[
            [
              "Reduce-side sort-merge",
              "Map both inputs by join key; shuffle co-locates & sorts; reducer streams U-then-Cs",
              "Nothing — fully general",
              "Full shuffle of all inputs; skew-sensitive",
            ],
            [
              "Map-side broadcast hash",
              "Small table copied into every mapper's RAM; join inline while streaming the big input",
              "One side fits in memory (after filtering)",
              "No shuffle of big input; cost = broadcast × mappers",
            ],
            [
              "Map-side partitioned hash (bucketed)",
              "Both inputs pre-partitioned (and ideally sorted) identically; join matching buckets mapper-side",
              "Same partitioning/bucketing on both sides — plan ahead",
              "No shuffle at join time; pays at write time",
            ],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · MapReduce vs dataflow engines"
          head={["", "MapReduce", "Dataflow (Spark/Tez/Flink)"]}
          rows={[
            ["Unit of work", "Single map→shuffle→reduce job; pipelines = chained jobs", "Whole DAG of operators in one job"],
            ["Between stages", "Materialize to DFS, replicated", "Pipeline narrow deps in memory; shuffle only wide deps"],
            ["Failure recovery", "Re-run task; reread temp files", "Recompute lost partitions via lineage (+ checkpoints)"],
            ["Stragglers", "Stage barrier: next job waits for slowest task", "Pipelining softens; barriers only at shuffles"],
            ["Sweet spot", "Huge one-pass jobs; hostile/shared clusters; simplicity", "Multi-stage pipelines, iterative ML/graphs, interactive"],
            ["Determinism", "Helpful", "Required for lineage correctness"],
          ]}
        />

        <InterviewQA
          items={[
            {
              q: "Walk through how MapReduce computes a group-by without ever holding a hash table of all keys.",
              a: (
                <p>
                  Grouping is done by <em>sorting</em>, not hashing: mappers
                  partition each pair by hash(key) mod R, sort their per-partition
                  output, and spill sorted runs to local disk; reducers pull their
                  partition from every mapper and k-way merge the sorted runs.
                  Equal keys become adjacent, so reduce just streams: detect key
                  change, finish group. Memory stays O(merge buffers), which is
                  why it scales to inputs vastly larger than RAM — same trick as
                  Unix <code>sort | uniq -c</code>.
                </p>
              ),
            },
            {
              q: "Design a daily job: join 10 TB of clicks with a 2 GB user table, count per country.",
              a: (
                <p>
                  Broadcast join: 2 GB (likely ~hundreds of MB after projecting to
                  user_id+country) fits in each worker's RAM, so ship it to
                  all mappers, stream the 10 TB once, join inline, then a small
                  shuffle only on (country) for the count — with a combiner/partial
                  aggregation so each mapper emits ~200 country partials rather
                  than billions of rows. Avoid the reduce-side join entirely: it
                  would shuffle 10 TB to join against 2 GB. Output: versioned
                  immutable file, atomic swap.
                </p>
              ),
            },
            {
              q: "Your job's 999 reducers finish in 5 minutes; one runs for 6 hours. Diagnose and fix.",
              a: (
                <p>
                  Classic hot-key skew: one key (celebrity user, null/default ID,
                  bot URL) hashed to that reducer. Confirm by sampling key
                  frequencies or reading partition-size counters. Fixes: filter
                  garbage keys (nulls!) first; salt the hot keys into N sub-keys
                  and re-aggregate; broadcast-join the dimension side so the hot
                  key never shuffles; or a skew-join mode that handles heavy
                  hitters specially. Also check the combiner is enabled — it
                  collapses duplicates before the wire.
                </p>
              ),
            },
            {
              q: "Why do batch jobs write new output directories instead of updating the database in place?",
              a: (
                <p>
                  Three compounding reasons. Performance: bulk-building files
                  (e.g., SSTables, index segments) is orders faster than per-row
                  writes through a live DB. Atomicity: a job that dies mid-run
                  leaves either the old complete output or nothing — never a
                  half-state. Reversibility: outputs are versioned and inputs
                  immutable, so a buggy deploy is fixed by re-pointing at
                  yesterday's artifact and rerunning — human fault tolerance.
                  In-place mutation forfeits all three.
                </p>
              ),
            },
            {
              q: "What exactly does Spark's lineage buy over MapReduce's materialization — and what does it cost?",
              a: (
                <p>
                  Buys: no replicated temp datasets between stages, pipelined
                  narrow dependencies (lower latency, less I/O), and surgical
                  recovery — recompute only the lost partitions by replaying their
                  recipe. Costs: transformations must be deterministic (a
                  nondeterministic stage makes recomputed partitions inconsistent
                  with surviving ones), long lineages need periodic checkpoints to
                  bound recovery time, and memory pressure becomes a first-class
                  operational concern.
                </p>
              ),
            },
            {
              q: "When is plain MapReduce-style processing still a defensible choice?",
              a: (
                <p>
                  Single-pass jobs over enormous data where stage pipelining buys
                  little; extremely unreliable or heavily shared environments
                  (frequent preemption favors materialize-and-retry — the design
                  assumption it was born with); when intermediate datasets are
                  themselves valuable to keep; and when operational simplicity
                  beats speed. The concept also survives as the <em>floor</em>:
                  every dataflow engine still contains its shuffle.
                </p>
              ),
            },
            {
              q: "How does the same job rerun safely if half of it already ran yesterday and failed?",
              a: (
                <p>
                  Idempotence by construction: inputs are immutable, tasks are
                  pure, and outputs go to a temp location that's atomically
                  renamed/committed only on success — so a rerun overwrites
                  nothing and double-runs produce identical artifacts. The
                  output-commit step (rename a directory, flip a pointer) is the
                  batch world's tiny consensus moment. This is chapter
                  8's retry-safety lesson wearing a data-engineering hat.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "The shuffle was MapReduce's design flaw, and modern engines eliminated it.",
              reality: (
                <>
                  Repartitioning-by-key is inherent to grouping and joining;
                  Spark and friends shuffle too. What they removed is the{" "}
                  <em>forced materialization of every stage boundary</em> —
                  pipelining narrow dependencies and keeping wide ones.
                </>
              ),
            },
            {
              myth: "Joins in batch work like database joins — look up the matching row when needed.",
              reality: (
                <>
                  Random lookups against a remote store would crater throughput
                  and make runs non-reproducible. Batch joins relocate data so
                  matches meet locally: shuffle both sides to reducers, or
                  broadcast the small side to mappers. Choosing which is the
                  design decision.
                </>
              ),
            },
            {
              myth: "Spark is fast because 'it's in-memory and MapReduce is on disk'.",
              reality: (
                <>
                  Half-true and misleading: Spark still spills and still shuffles
                  via disk/network. The structural wins are whole-DAG planning, no
                  replicated temp datasets between stages, pipelined narrow deps,
                  and lineage-based recovery — memory residency for iterative
                  working sets is one benefit, not the mechanism.
                </>
              ),
            },
            {
              myth: "If a batch job fails halfway, you've corrupted your outputs.",
              reality: (
                <>
                  A correctly built pipeline can't: inputs immutable, temp
                  outputs quarantined, final outputs committed atomically (rename
                  / pointer swap). Failure leaves the old version intact; rerun
                  from scratch is always safe. If a halfway failure <em>can</em>{" "}
                  corrupt state, the job was mutating shared state — the
                  anti-pattern itself.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
