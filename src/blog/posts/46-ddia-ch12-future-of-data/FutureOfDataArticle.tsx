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
import UnbundledDatabase from '../../components/ddia/animations/UnbundledDatabase'
import LambdaVsKappa from '../../components/ddia/animations/LambdaVsKappa'
import EndToEndDedup from '../../components/ddia/animations/EndToEndDedup'

export default function FutureOfDataArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          The book&apos;s closing chapter stops adding tools and starts
          composing them. Its claim: no single database will ever fit a serious
          application, so the interesting engineering is in the{" "}
          <em>connections</em> — flows of derived data, kept trustworthy by
          ordering, replayability, and end-to-end thinking. It ends, unusually
          for a systems text, by asking what we owe the people inside the data.
          These notes follow that arc.
        </p>

        <H2 id="data-integration">Data integration &amp; derived state</H2>
        <p>
          Accept the premise — specialized systems, plural — and the central
          question becomes: <strong>how do all these copies stay
          trustworthy?</strong> The book&apos;s answer assembles three earlier
          ideas into one architecture. From chapter 11: route every change
          through a <em>log</em>, so there is one authoritative order (within
          each partition) instead of dual-write chaos. From chapter 10/11:
          treat every downstream system as <em>derived state</em> — a
          materialized view that consumes the log and can always be rebuilt from
          it. From chapter 9, quietly: an ordered log applied deterministically{" "}
          <em>is</em> state machine replication — the same mathematics that made
          consensus replicas agree now makes your search index agree with your
          database.
        </p>
        <Callout type="insight">
          <p>
            Batch and stream stop being rivals here: both are &ldquo;derive
            outputs from immutable inputs&rdquo; — batch over a bounded slice,
            streaming over the unbounded rest. A system that keeps its raw events
            can use either engine on the same data, which is why the
            reprocessing section below is an architecture question, not a
            framework war.
          </p>
        </Callout>

        <H2 id="unbundling">Unbundling the database</H2>
        <p>
          Here is the chapter&apos;s most quoted idea, best seen by looking{" "}
          <em>inside</em> a database first:
        </p>

        <UnbundledDatabase />

        <InTheWild
          title="The talk that named it"
          sources={[
            {
              label: "Martin Kleppmann — Turning the database inside-out (talk page)",
              href: "https://martin.kleppmann.com/2015/11/05/database-inside-out-at-oredev.html",
            },
            {
              label: "Transcript at Confluent — Turning the database inside out with Apache Samza",
              href: "https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/",
            },
          ]}
        >
          <p>
            The author&apos;s own &ldquo;turning the database inside-out&rdquo;
            talk is this section in 45 minutes: replication logs, secondary
            indexes, caches, and materialized views are things databases already
            do internally — unbundling re-implements them <em>between</em> systems,
            with a durable log where the WAL used to be. Watching it after
            chapters 5–11 is a satisfying experience: every component he names is
            one you&apos;ve now seen animated.
          </p>
        </InTheWild>

        <H2 id="reprocessing">Reprocessing: lambda vs kappa</H2>
        <p>
          Derived views fail in a way replication can&apos;t fix: the{" "}
          <em>code</em> that derives them changes. Schema migrations, bug fixes,
          redefined metrics — all demand recomputing history while the present
          keeps arriving. Two architectures answered:
        </p>

        <LambdaVsKappa />

        <Callout type="interview">
          <p>
            When this comes up, anchor on the invariant rather than the Greek
            letters: <em>keep raw input immutable; make every view rebuildable
            from it</em>. Lambda achieves that with parallel batch + stream
            codebases and a query-time merge; kappa achieves it with one
            replayable log and parallel job <em>versions</em>. Then name the real
            kappa prerequisites — long log retention (or tiered storage),
            operational room to run two jobs during migration, sinks that can
            switch atomically — and you&apos;ve given the answer that survives
            follow-ups.
          </p>
        </Callout>

        <H2 id="correctness">Correctness, end to end</H2>
        <p>
          The book&apos;s sharpest late-chapter argument: reliable components do
          not compose into reliable <em>operations</em>. TCP is reliable, your
          broker is exactly-once, your database is ACID — and a user can still be
          charged twice, because the duplicate was created above every layer that
          promised otherwise:
        </p>

        <EndToEndDedup />

        <H3>Timeliness vs integrity</H3>
        <p>
          The chapter&apos;s most useful decomposition of
          &ldquo;consistency&rdquo;: <strong>timeliness</strong> — readers see
          up-to-date state (violations heal by waiting; an out-of-date read fixes
          itself) — versus <strong>integrity</strong> — the data is not corrupt,
          nothing is lost or double-counted, derived state actually corresponds
          to its sources (violations are <em>permanent</em> until explicitly
          repaired). Most products tolerate soft timeliness astonishingly well
          (your bank statement is &ldquo;as of yesterday&rdquo;) and tolerate
          integrity violations not at all. Streams exploit exactly this:
          asynchronous, lagging — weak timeliness — while exactly-once
          processing, fencing, and end-to-end IDs guard integrity. Spending
          coordination (consensus, transactions) on timeliness that the product
          doesn&apos;t need is the most common over-engineering in system design.
        </p>
        <H3>Constraints without coordination</H3>
        <p>
          Even classic &ldquo;requires a transaction&rdquo; constraints often
          don&apos;t. Uniqueness: route all claims for a username through one log
          partition — the log&apos;s order decides the winner, no lock service
          involved. Cross-entity rules (account can&apos;t go negative): validate
          in a single-partition processor, or accept the constraint{" "}
          <em>apologetically</em> — allow rare overdrafts, detect via the log,
          compensate — which is how airlines, banks, and warehouses have always
          actually operated. Coordination buys certainty <em>before</em> the
          fact; apologies buy availability and handle the faults coordination
          can&apos;t reach anyway.
        </p>

        <InTheWild
          title="The 1984 paper that predicted your bug"
          sources={[
            {
              label: "Saltzer, Reed & Clark — End-to-End Arguments in System Design (MIT)",
              href: "https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf",
            },
            { label: "CRDT.tech — conflict-free replicated data types", href: "https://crdt.tech/" },
          ]}
        >
          <p>
            The end-to-end argument predates the web: using file transfer (and,
            yes, duplicate suppression) as examples, it argues such functions can
            only be implemented completely at the application endpoints — lower
            layers may optimize, never own. Forty years later it explains why
            &ldquo;exactly-once broker&rdquo; doesn&apos;t end duplicate payments.
            The companion link collects CRDTs — data types whose merges are
            mathematically conflict-free — one research thread trying to move
            integrity-without-coordination from pattern to primitive (the future
            chapter 5&apos;s sibling merges were waiting for).
          </p>
        </InTheWild>

        <H2 id="ethics">Doing the right thing</H2>
        <p>
          The chapter ends by widening the lens: every dataset is partly{" "}
          <em>about people</em>, and systems built from this book&apos;s tools
          make decisions about them — rankings, prices, risk scores. Three
          engineering-adjacent obligations follow. <strong>Predictive systems
          inherit their inputs</strong>: models trained on biased histories
          launder bias into objective-looking outputs, and feedback loops amplify
          (deny credit → thinner file → deny credit). Treat &ldquo;the algorithm
          decided&rdquo; as a smell — someone chose the data, the objective, and
          the threshold. <strong>Data is liability, not just asset</strong>:
          the replay-everything architectures this book celebrates also mean
          personal data propagates into logs, views, and backups — so deletion,
          retention, and purpose-limitation must be <em>designed</em> (crypto-
          shredding, per-purpose topics, TTLs), not bolted on.{" "}
          <strong>Consent decays</strong>: data collected for one purpose,
          derived and joined for another, exits the bargain users struck.
          Minimal collection is the only privacy mechanism that survives every
          future breach and acquisition.
        </p>

        <InTheWild
          title="The regulation that made this section load-bearing"
          sources={[
            {
              label: "Regulation (EU) 2016/679 (GDPR) — official text",
              href: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
            },
          ]}
        >
          <p>
            GDPR turned several of this section&apos;s principles into law with
            real teeth: purpose limitation, data minimisation, storage
            limitation, and erasure rights map directly onto architecture
            decisions — what goes in the log, how long topics retain, whether
            &ldquo;delete user&rdquo; can actually reach every derived view and
            backup. Immutable-log architectures and erasure rights coexist, but
            only if you design for it (keys-per-user + crypto-shredding is the
            standard move). Compliance, it turns out, is a systems-design
            problem.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              No single store fits a serious app; integration is the real design.
              One ordered log of changes + derived, rebuildable views = the
              database unbundled, with the log as the organization&apos;s WAL.
            </>,
            <>
              Same order everywhere ⇒ convergence — total order broadcast and
              state machine replication, recycled as data integration.
              Asynchrony is the price: views lag; cross-view transactions
              don&apos;t exist.
            </>,
            <>
              Reprocessing is a first-class requirement. Lambda = batch + speed
              layers with duplicated logic; kappa = one replayable log, parallel
              job versions, atomic view switch. Invariant: immutable raw input,
              rebuildable everything.
            </>,
            <>
              Reliable layers don&apos;t compose into reliable operations — the
              end-to-end argument. Exactly-once requires an operation ID minted
              at the source and enforced at the destination (unique constraint /
              idempotent apply).
            </>,
            <>
              Split &ldquo;consistency&rdquo; into timeliness (heals with time)
              vs integrity (permanent until repaired); spend coordination on
              integrity, tolerate lag on timeliness, and remember the data is
              about people — minimization, deletion, and bias are design inputs.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · lambda vs kappa"
          head={["", "Lambda", "Kappa"]}
          rows={[
            ["Codebases", "two (batch + stream) implementing the same logic", "one stream codebase"],
            ["History lives in", "immutable batch store (lake)", "long-retention / tiered log"],
            ["Serving", "query-time merge of batch view + speed view", "current view from the live job"],
            ["Reprocessing", "next batch run (built-in, slow cadence)", "new job replays from offset 0, then atomic switch"],
            ["Failure surface", "logic drift between layers + merge bugs", "retention costs, dual-job ops during migration"],
            ["Choose when", "stream engine can't hold exact state; org already batch-centric", "replayable log + exactly-once streaming available (the modern default)"],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · timeliness vs integrity"
          head={["", "Timeliness", "Integrity"]}
          rows={[
            ["Promise", "readers see recent state", "no loss, no duplication, no corruption; derived = f(sources)"],
            ["Violation feels like", "stale read, lagging dashboard", "money double-counted, rows vanished, index disagrees with DB"],
            ["Heals by…", "waiting (it's self-correcting)", "explicit repair — it never self-heals"],
            ["Typical tolerance", "high (seconds–hours, per product)", "near zero"],
            ["Bought with", "sync replication, linearizable reads, coordination", "atomic commit, fencing, exactly-once pipelines, end-to-end IDs"],
            ["Streaming stance", "relaxed (async, lagging)", "guarded jealously — the whole design centers it"],
          ]}
          footnote="The cheapest correct system relaxes timeliness as far as the product allows while never gambling integrity."
        />

        <InterviewQA
          items={[
            {
              q: "What does 'unbundling the database' mean, and what's the catch?",
              a: (
                <p>
                  Run the components a monolithic database hides — storage,
                  indexes, caches, materialized views — as separate specialized
                  systems, glued by an ordered change log instead of internal
                  lockstep: writes hit a system of record, CDC publishes its
                  commits, every other system consumes the same sequence. Wins:
                  best-of-breed parts, views added/rebuilt by replay, failure
                  isolation. Catch: the lockstep was load-bearing — views now
                  lag (no cross-view read-your-writes by default), no cross-view
                  transactions, the log becomes tier-zero infrastructure, and
                  event schemas become a public API with chapter-4 evolution
                  duties.
                </p>
              ),
            },
            {
              q: "Why did kappa largely displace lambda — and when is lambda still right?",
              a: (
                <p>
                  Lambda existed because early stream processors were lossy and
                  approximate, so a nightly batch recompute supplied correctness.
                  Once logs offered cheap long retention and stream engines
                  gained checkpointed state with effectively-once output, the
                  same code could serve both live processing and historical
                  replay — eliminating lambda&apos;s defining cost, duplicated
                  logic that drifts. Lambda-shaped designs still make sense when
                  the heavy recompute genuinely wants a batch engine (huge joins,
                  ML training) or the org&apos;s gravity is a data lake; even
                  then, share the logic via one framework or generated code
                  rather than two hand-built paths.
                </p>
              ),
            },
            {
              q: "Your broker has exactly-once semantics. Can users still get double-charged? Walk the failure.",
              a: (
                <p>
                  Yes. The user&apos;s client retries after a lost response — two
                  requests born above every guarantee. TCP deduped only within
                  each connection; the LB routed the retry to another instance;
                  the service published two distinct messages, which the broker
                  faithfully (and exactly-once-ly) delivered both of. Hop-local
                  guarantees are scoped to their hop; the duplicate is an
                  application-level fact. The fix is end-to-end: client mints an
                  operation ID at intent time, every layer carries it, the final
                  write enforces it (unique key / idempotent upsert), retries
                  everywhere become safe.
                </p>
              ),
            },
            {
              q: "Distinguish timeliness from integrity, and show how it changes a design.",
              a: (
                <p>
                  Timeliness: how current the visible state is — violations are
                  stale reads that heal by waiting. Integrity: whether the data
                  is right — violations (lost writes, double counts,
                  source/derived mismatch) persist until someone repairs them.
                  Design consequence: an analytics pipeline can lag minutes
                  (timeliness relaxed) but must never double-count revenue
                  (integrity absolute) → async log + exactly-once processing +
                  idempotent sink, no synchronous coordination anywhere. A
                  trading risk check inverts it: it needs <em>now</em>, so you
                  pay for linearizable reads on that one path. Naming which
                  property each requirement needs is the skill.
                </p>
              ),
            },
            {
              q: "Enforce 'usernames are unique' at scale without a distributed lock.",
              a: (
                <p>
                  Make the log decide: partition a claims topic by
                  hash(username); all claims for a name land in one partition in
                  one order; a single-threaded-per-partition processor grants the
                  first and rejects the rest, emitting accepted/rejected events
                  the application awaits. Linearizable <em>for that key</em> via
                  ordering, scaling horizontally across keys, no lock service.
                  Mention the boundary: constraints spanning partitions
                  (transfer between accounts) need either multi-partition
                  transactions or the apology pattern — detect violations from
                  the log and compensate — which is how the physical world has
                  always handled overbooking.
                </p>
              ),
            },
            {
              q: "How does 'delete this user' work in an immutable-log architecture?",
              a: (
                <p>
                  Replay-everything collides with erasure rights unless designed
                  for. Standard moves: <em>crypto-shredding</em> — encrypt each
                  user&apos;s data under a per-user key; deletion = destroy the
                  key, turning every log entry, view, and backup into ciphertext
                  simultaneously. Plus: compacted topics where a tombstone
                  removes the latest-per-key state; bounded retention on raw
                  topics so history ages out; deletion events that downstream
                  views must honor (and prove it — audit by replay). The
                  interview point: deletion is a <em>data-flow feature</em> with
                  acceptance criteria, not a DELETE statement.
                </p>
              ),
            },
            {
              q: "Where does coordination actually need to be spent in a modern data architecture?",
              a: (
                <p>
                  Surprisingly few places: leader election / log ordering itself
                  (consensus inside the broker and the system of record),
                  per-key serialization where integrity demands it (the unique
                  username partition, the payment&apos;s idempotency check), and
                  fencing so zombie processes can&apos;t corrupt state. Almost
                  everything else — view maintenance, analytics, search, caches —
                  rides asynchronous ordered logs with integrity protected by
                  exactly-once processing and end-to-end IDs, tolerating lag.
                  The anti-pattern is global synchronous coordination for
                  timeliness nobody asked for; the failure mode of avoiding it
                  badly is integrity bugs. Say both.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "Event-driven architecture means we no longer need ordering or transactions anywhere.",
              reality: (
                <>
                  It <em>relocates</em> them: ordering concentrates in the log
                  (per partition — consensus-backed), and transactional thinking
                  concentrates at the edges (outbox writes, exactly-once
                  processing, idempotent sinks). Remove those and you have
                  dual-writes with extra steps.
                </>
              ),
            },
            {
              myth: "If every component guarantees exactly-once / reliability, the system does too.",
              reality: (
                <>
                  Guarantees are scoped to their layer; duplicates and losses
                  born above a layer pass straight through it. Operation-level
                  correctness only exists end-to-end — an ID minted at intent,
                  enforced at the destination. That&apos;s the 1984 paper, still
                  undefeated.
                </>
              ),
            },
            {
              myth: "Eventual consistency means the data might be wrong.",
              reality: (
                <>
                  It means the data might be <em>late</em> — a timeliness
                  statement. Integrity is a separate, orthogonal property that
                  well-built async systems protect absolutely (no loss, no double
                  counts) while letting freshness float. Conflating the two leads
                  to both over-engineering and misplaced trust.
                </>
              ),
            },
            {
              myth: "Ethics and compliance are a policy layer, separate from system design.",
              reality: (
                <>
                  Retention, purpose limitation, deletion, and bias live in
                  schemas, topic design, key management, and training data —
                  concrete artifacts of this book&apos;s chapters. A system that
                  can&apos;t enumerate where personal data flows or make deletion
                  reach backups isn&apos;t missing a policy; it&apos;s missing a
                  feature.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  )
}
