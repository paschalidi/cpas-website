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
import LogVsQueue from '../../components/ddia/animations/LogVsQueue'
import CdcOutbox from '../../components/ddia/animations/CdcOutbox'
import EventTimeWindows from '../../components/ddia/animations/EventTimeWindows'

export default function StreamProcessingArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          Batch processing (chapter 10) assumed the input was <em>finished</em>.
          It never is — data arrives continuously, and waiting for midnight to
          learn what happened at noon is a choice, not a law. Stream processing
          keeps batch&apos;s best ideas (immutable inputs, derived outputs,
          rerunnable logic) and removes the artificial boundary. The price of
          admission: you must now take <em>messaging</em>, <em>state</em>, and
          especially <em>time</em> seriously.
        </p>

        <H2 id="messaging">Messaging: queues and logs</H2>
        <p>
          A stream is an unbounded sequence of <strong>events</strong> — small,
          immutable, timestamped facts: &ldquo;player 81 scored 4,200 at
          10:02:13&rdquo;. Producers write them; consumers react. Between the two
          sits a broker, and brokers come in two philosophies with very different
          consequences:
        </p>

        <LogVsQueue />

        <Callout type="definition">
          <p>
            <strong>Partitioned log</strong>: an append-only sequence of records,
            split across partitions for parallelism. Within a partition, order is
            total and offsets are dense integers; across partitions, no order is
            promised. A consumer group assigns each partition to one member;
            progress is just the per-partition offset, which makes checkpointing,
            recovery, and replay almost embarrassingly simple. Keyed routing
            (same key → same partition) is what turns &ldquo;per-partition
            order&rdquo; into the useful guarantee &ldquo;per-<em>entity</em>{" "}
            order&rdquo;.
          </p>
        </Callout>

        <InTheWild
          title="The essay that reframed the field"
          sources={[
            {
              label: "Jay Kreps — The Log: What every software engineer should know…",
              href: "https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying",
            },
          ]}
        >
          <p>
            Written by Kafka&apos;s co-creator out of LinkedIn&apos;s data-integration
            pain, this essay argues the append-only log is the unifying
            abstraction beneath databases (WAL), replication (leader→follower
            shipping), and integration (streams between systems). Reading it, you
            can watch chapter 5&apos;s replication log and chapter 11&apos;s event
            stream collapse into the same object — which is precisely the
            intellectual move this chapter is built on.
          </p>
        </InTheWild>

        <H2 id="db-and-streams">Databases meet streams: CDC &amp; event sourcing</H2>
        <p>
          Here is the chapter&apos;s sharpest practical lesson, because almost
          every real architecture contains the bug it names. The same fact lives
          in several systems — database, search index, cache, warehouse — and
          something must keep them agreeing:
        </p>

        <CdcOutbox />

        <CodeBlock
          title="what a CDC event looks like (Debezium-style, simplified)"
          lang="json"
          code={`{
  "source": { "table": "products", "lsn": 884213 },   // position in the DB log
  "op": "u",                                          // c=create, u=update, d=delete
  "before": { "id": 31, "price": 30.00 },
  "after":  { "id": 31, "price": 25.00 },
  "ts_ms": 1718100000000
}
// keyed by products.id → all changes to product 31 share a partition,
// so every consumer sees them in the same (commit) order`}
        />

        <H3>Event sourcing, and state as a changelog</H3>
        <p>
          CDC derives events from state changes; <strong>event sourcing</strong>{" "}
          flips the arrow — store the <em>intents</em> (&ldquo;item added to
          cart&rdquo;, &ldquo;coupon applied&rdquo;) as the immutable truth, and
          compute current state by folding over them. You gain a perfect audit
          trail, time-travel debugging, and the freedom to derive views you
          haven&apos;t imagined yet; you take on event-schema design, replay
          cost (mitigated by snapshots), and the discipline of never
          &ldquo;fixing&rdquo; history — corrections are new events. Both
          patterns rest on one identity worth memorizing:{" "}
          <em>state is what you get by folding the changelog; the changelog is
          how state got here</em>. Keep the log and every view becomes
          disposable, rebuildable, and therefore fearless.
        </p>

        <InTheWild
          title="CDC as an open-source commodity"
          sources={[{ label: "Debezium — change data capture platform", href: "https://debezium.io/" }]}
        >
          <p>
            Debezium made the &ldquo;pose as a replica, publish the WAL&rdquo;
            trick a product: connectors for Postgres, MySQL, MongoDB and friends
            read each database&apos;s replication protocol and emit ordered change
            events (with initial snapshotting for bootstrap). That a whole
            ecosystem exists for this is the tell that dual writes failed at
            industrial scale — teams kept needing the database&apos;s own ordering
            exported, not re-invented in application code.
          </p>
        </InTheWild>

        <H2 id="time">Time: events, windows, watermarks</H2>
        <p>
          Batch jobs could ignore time — the input was complete, so
          &ldquo;when&rdquo; was a column, not a problem. Streams never complete,
          so every aggregation must decide what &ldquo;the 10:02 window&rdquo;
          even means, and when to stop waiting for it:
        </p>

        <EventTimeWindows />

        <Callout type="pitfall">
          <p>
            The quiet failure mode: frameworks default to <em>processing-time</em>{" "}
            semantics because they require no thought — and dashboards built on
            them faithfully record every deploy, retry storm, and consumer lag as
            if it were user behavior. If a metric is about the <em>world</em>{" "}
            (signups per minute, fraud per region), it needs event time plus a
            lateness policy. If it&apos;s about your <em>pipeline</em> (ingest
            rate), processing time is honest. Confusing the two produces graphs
            that lie most confidently during incidents — exactly when you read
            them.
          </p>
        </Callout>

        <InTheWild
          title="The paper behind modern streaming time"
          sources={[
            {
              label: "Akidau et al. — The Dataflow Model (VLDB 2015)",
              href: "https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf",
            },
          ]}
        >
          <p>
            Google&apos;s Dataflow paper systematized this section: it cleanly
            separates <em>what</em> is computed, <em>where</em> in event time
            (windows), <em>when</em> results are emitted (triggers/watermarks),
            and <em>how</em> corrections refine earlier outputs. Its vocabulary —
            watermarks, late data, accumulating vs discarding triggers — became
            the shared language of Flink, Beam, and the rest. If you read one
            primary source for streaming, read this one.
          </p>
        </InTheWild>

        <H2 id="processing">Processing streams: joins &amp; fault tolerance</H2>
        <H3>Three joins, three uses of state</H3>
        <p>
          <strong>Stream–stream</strong>: correlate two event streams within a
          time window — searches joined to subsequent clicks. The processor
          buffers recent events from both sides, keyed and windowed; the window
          bounds the state. <strong>Stream–table</strong>: enrich events with
          reference data — clicks joined to user profiles. The table is held as
          local state, kept current by consuming its changelog (CDC again — the
          join input is a stream too). <strong>Table–table</strong>: maintain a
          materialized view of two joined tables — both sides arrive as
          changelogs, the output is itself a changelog. Notice the pattern: every
          join is &ldquo;keep some state, update it from a stream&rdquo; — and
          because the state is fed by logs, it can always be rebuilt by replay.
          One subtlety worth naming: if the enrichment table changes over time,
          joining <em>today&apos;s</em> events against <em>today&apos;s</em> table
          state silently differs from what was true when old events occurred —
          deterministic reprocessing may need temporal (versioned) tables.
        </p>
        <H3>Fault tolerance: replayability + idempotence</H3>
        <p>
          The strategy inherits batch&apos;s soul: inputs are immutable logs, so a
          failed processor can rewind to its last <strong>checkpoint</strong>{" "}
          (offsets + state snapshot) and recompute. The hazard is the
          <em> output</em>: recomputed work must not double-publish. Two industrial
          answers: make the sink <strong>idempotent</strong> (write keyed by a
          deterministic ID, so duplicates collapse), or make output{" "}
          <strong>transactional</strong> — publish results and commit consumer
          offsets atomically, with readers ignoring uncommitted data. The second
          is what &ldquo;exactly-once&rdquo; means in practice: not magical
          single delivery, but <em>effectively-once processing</em> — duplicates
          exist in the plumbing and are made invisible at the boundaries.
        </p>

        <InTheWild
          title="Exactly-once, as shipped"
          sources={[
            {
              label: "Confluent — Exactly-once semantics in Apache Kafka (0.11)",
              href: "https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/",
            },
          ]}
        >
          <p>
            Kafka 0.11&apos;s exactly-once work is the canonical implementation of
            this section: an idempotent producer (sequence numbers per partition
            dedupe broker-side retries) plus transactions (atomic writes across
            partitions <em>and</em> the consumer-offsets topic, with
            read-committed consumers). Note the careful framing in the
            announcement itself — the guarantee is end-to-end <em>within</em> the
            Kafka consume-process-produce loop; the moment results leave for an
            external system, you&apos;re back to idempotent sinks. That caveat is
            chapter 12&apos;s opening argument.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Queues delete on ack (tasks); logs retain with per-consumer offsets
              (events). Replay, fan-out to many groups, and per-key ordering are
              log superpowers — choose by whether history has value.
            </>,
            <>
              Dual writes to multiple systems have no shared order and no
              atomicity → silent divergence. Make one system the writer-of-record
              and derive the rest from its change log (CDC), or use a
              transactional outbox.
            </>,
            <>
              State is a fold over the changelog; keep the log and every derived
              view is rebuildable. Event sourcing stores intents as truth; CDC
              extracts changes from state — same identity, opposite directions.
            </>,
            <>
              Event time ≠ processing time. Event-time windows need a watermark
              to close and a policy for stragglers (drop / update / sideline);
              processing-time metrics measure your pipeline, not the world.
            </>,
            <>
              Stream fault tolerance = replayable inputs + checkpoints +
              non-duplicating outputs (idempotent or transactional sinks).
              &ldquo;Exactly-once&rdquo; means effectively-once effects, scoped to
              a boundary.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · queue vs log"
          head={["", "Message queue (AMQP-style)", "Partitioned log (Kafka-style)"]}
          rows={[
            ["Unit of work", "task to complete", "event that happened"],
            ["After consumption", "deleted on ack", "retained; consumer advances an offset"],
            ["Load balancing", "per message, any free worker", "per partition, within a consumer group"],
            ["Ordering", "weak (redelivery reorders)", "total per partition → per key with keyed routing"],
            ["New consumer sees", "future only", "any offset — full replay"],
            ["Slow consumer", "queue backs up, broker pressure", "lags visibly; others unaffected"],
            ["Sweet spot", "job dispatch, RPC-ish work", "event streams, integration, analytics feeds"],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · the three notions of time"
          head={["Clock", "Definition", "Use for", "Failure mode if misused"]}
          rows={[
            [
              "Event time",
              "when it happened (source timestamp)",
              "metrics about the world; windowed aggregates",
              "must handle lateness: watermarks + straggler policy",
            ],
            [
              "Processing time",
              "when your processor handled it",
              "pipeline health, ingest rates",
              "deploys/retries paint fake spikes into 'user' metrics",
            ],
            [
              "Ingestion time",
              "when the broker first logged it",
              "compromise stamp when sources are untrusted",
              "hides source delay; still not when it happened",
            ],
          ]}
          footnote="Watermark = a moving claim that all events ≤ T have arrived; it closes event-time windows and is always a calibrated bet."
        />

        <InterviewQA
          items={[
            {
              q: "Kafka-style log vs RabbitMQ-style queue — how do you choose?",
              a: (
                <p>
                  Ask three questions. Does history have value (replay, new
                  consumers, audit)? Logs retain it; queues destroy it. Does
                  per-entity ordering matter (account events, order lifecycle)?
                  Logs give it via keyed partitions; queues reorder on redelivery.
                  Is the workload independent expensive tasks needing per-message
                  ack, retry, and fair dispatch? That&apos;s the queue&apos;s home
                  turf. Rule of thumb: integration and analytics pipelines → log;
                  job execution → queue; and using a log <em>as</em> a job queue
                  is awkward exactly where per-message acks would have helped
                  (head-of-line blocking within a partition).
                </p>
              ),
            },
            {
              q: "Why are dual writes broken, and what are the two standard fixes?",
              a: (
                <p>
                  Two destinations, no shared serialization: concurrent updates
                  can apply in different orders at each system (permanent
                  divergence), and a crash between writes leaves one updated and
                  one stale — no cross-system transaction exists to prevent
                  either, and no error surfaces. Fix 1: CDC — the database
                  remains sole writer; a connector publishes its commit log; all
                  other systems consume in that single order. Fix 2:
                  transactional outbox — business row + event row committed in
                  one local transaction; a relay publishes the outbox. Both reduce
                  to one principle: there must be exactly one place where order is
                  decided.
                </p>
              ),
            },
            {
              q: "Design the pipeline that keeps a search index consistent with the primary DB.",
              a: (
                <p>
                  Writes go only to the DB. Debezium-style CDC tails the WAL and
                  emits change events keyed by document ID into a log topic
                  (per-key order preserved). An indexer consumer group upserts
                  into the search engine, idempotently (the event&apos;s log
                  position as a version — reject older). Bootstrap a new index by
                  snapshot-then-stream, or from a compacted topic holding
                  latest-per-key. Monitoring: consumer offset lag = staleness
                  bound. Failure recovery is just resume-from-offset; full
                  rebuilds are replay. Mention the caveat: search visibility lags
                  commits by the pipeline&apos;s latency — read-your-writes on
                  search needs separate handling.
                </p>
              ),
            },
            {
              q: "Your 'signups per minute' dashboard shows a spike at 10:07 after a mobile network outage. What happened?",
              a: (
                <p>
                  The pipeline windows by processing time. Events created during
                  the outage (event time 10:02–10:06) were buffered on devices and
                  all arrived at 10:07 — the dashboard recorded delivery, not
                  behavior, showing a dip-then-spike that users never produced.
                  Fix: window by the event&apos;s source timestamp, close windows
                  with a watermark calibrated to observed lateness, and choose a
                  straggler policy (update-and-correct for business metrics; drop
                  for rough ops dashboards). Keep a separate processing-time chart
                  for pipeline health — both clocks are useful, for different
                  questions.
                </p>
              ),
            },
            {
              q: "What is a watermark, really — and what happens when it's wrong?",
              a: (
                <p>
                  A watermark is a flowing, heuristic assertion — &ldquo;no events
                  with timestamp ≤ T remain in flight&rdquo; — typically derived
                  from observed event-time progress minus an allowed-lateness
                  slack. It exists because arrival order proves nothing about
                  completeness, yet windows must eventually emit. Too aggressive:
                  stragglers arrive after firing → results undercount unless you
                  re-emit corrections or sideline late events. Too conservative:
                  every result waits for the slowest plausible phone in a tunnel.
                  It&apos;s a latency/completeness dial, and mature pipelines
                  expose it per-job rather than pretending lateness away.
                </p>
              ),
            },
            {
              q: "How does a stream–table join work when the 'table' is also changing?",
              a: (
                <p>
                  The table is materialized as local state in the processor, kept
                  current by consuming the table&apos;s changelog (CDC) alongside
                  the event stream — so the join is really stream–stream, where
                  one stream happens to be a changelog folded into state. Each
                  event looks up the current state for its key. The subtlety:
                  &ldquo;current&rdquo; means current-as-of-processing — replaying
                  last month&apos;s events against today&apos;s table gives
                  different enrichment than the original run. Deterministic
                  reprocessing needs versioned/temporal state (look up the value
                  as-of the event&apos;s timestamp), which costs storage and is
                  worth calling out as a trade-off.
                </p>
              ),
            },
            {
              q: "What does Kafka's 'exactly-once' actually guarantee, and where does it stop?",
              a: (
                <p>
                  Two mechanisms: an idempotent producer (per-partition sequence
                  numbers let brokers drop duplicate retries) and transactions
                  (atomically publish output messages and commit input offsets;
                  consumers in read-committed skip aborted data). Result:
                  effectively-once <em>within</em> a Kafka
                  consume-process-produce loop — a crash-and-retry can&apos;t
                  double-count, because reprocessed output and offset commit abort
                  together. It stops at the boundary: a write to an external
                  database, an email, an HTTP call are outside the transaction —
                  those need idempotent application of results (deterministic keys,
                  upserts) or the duplicate returns. Saying that boundary out loud
                  is the senior-engineer move.
                </p>
              ),
            },
            {
              q: "When is event sourcing the right call — and what are its honest costs?",
              a: (
                <p>
                  Right when the domain&apos;s history <em>is</em> the product:
                  audit-heavy flows (payments, compliance), debugging-by-replay,
                  multiple evolving read models from one truth, undo/temporal
                  queries. Costs: event schema design becomes a public, versioned
                  API (chapter 4 with higher stakes); current-state queries need
                  maintained projections; replays grow with history (snapshots
                  mitigate); and immutability is a discipline — corrections are
                  compensating events, never edits, which some teams find
                  culturally hard. For CRUD-shaped domains with no audit need,
                  it&apos;s ceremony without payoff.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "Streaming replaces batch processing.",
              reality: (
                <>
                  Streaming removes the artificial &ldquo;wait for the day to
                  end&rdquo; boundary; it doesn&apos;t delete batch&apos;s virtues.
                  The convergence runs the other way: modern streaming{" "}
                  <em>adopted</em> batch&apos;s principles — immutable inputs,
                  rerunnable derivations — and chapter 12&apos;s reprocessing story
                  needs both modes. Plenty of workloads (model training, monthly
                  closes) remain natively batch.
                </>
              ),
            },
            {
              myth: "Exactly-once delivery means each message physically arrives once.",
              reality: (
                <>
                  Networks duplicate; that&apos;s physics (chapter 8). The real
                  guarantee is exactly-once <em>effects</em>: duplicates exist in
                  transit and are neutralized by sequence numbers, transactions,
                  and idempotent sinks. Vendors&apos; fine print says
                  &ldquo;effectively once&rdquo;; interviews reward saying it
                  unprompted.
                </>
              ),
            },
            {
              myth: "Kafka is a message queue.",
              reality: (
                <>
                  It&apos;s a replicated, partitioned <em>log</em>: consumption is
                  non-destructive, ordering is per-partition, parallelism is
                  partition-granular, and replay is native. Treating it as a queue
                  leads to mis-designs — expecting per-message acks, competing
                  consumers on one partition, or deleting-by-consuming.
                </>
              ),
            },
            {
              myth: "Late events are rare edge cases we can ignore.",
              reality: (
                <>
                  Mobile offline buffers, retries, GC pauses, cross-region
                  transfer, and consumer lag make lateness <em>routine</em> — and
                  correlated with incidents, when correct metrics matter most.
                  Every event-time aggregation needs an explicit lateness policy;
                  &ldquo;we drop them&rdquo; is acceptable, &ldquo;we never
                  thought about it&rdquo; is not.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  )
}
