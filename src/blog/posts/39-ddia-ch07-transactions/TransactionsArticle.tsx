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
import AnomalyPlayground from '../../components/ddia/animations/AnomalyPlayground';
import MvccVisualizer from '../../components/ddia/animations/MvccVisualizer';
import TwoPlVsSsi from '../../components/ddia/animations/TwoPlVsSsi';

export default function TransactionsArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          A transaction groups several reads and writes into one all-or-nothing
          unit so your application can pretend that crashes and concurrency
          don't exist — within the group. The interesting part is the fine
          print: <em>isolation</em> comes in levels, each level permits specific,
          nameable corruptions, and most databases don't default to the
          strongest one. This page is a field guide to those corruptions and the
          machinery that stops them.
        </p>

        <H2 id="acid">What ACID actually promises</H2>
        <p>
          Unpack the acronym carefully, because two of the four letters are routinely
          misread:
        </p>
        <ul>
          <li>
            <strong>Atomicity</strong> — all-or-nothing under <em>failure</em>, not
            under concurrency. If a transaction dies halfway, its partial writes are
            rolled back and it can be safely retried. A better word would have been{" "}
            <em>abortability</em>.
          </li>
          <li>
            <strong>Consistency</strong> — your invariants (accounts balance, seats
            aren't double-sold) hold before and after. This is mostly the{" "}
            <em>application's</em> property: the database gives you tools
            (constraints, isolation, atomicity) but can't know your business
            rules. The C is famously the odd one out.
          </li>
          <li>
            <strong>Isolation</strong> — concurrent transactions don't step on
            each other. The textbook meaning is <em>serializability</em>: the outcome
            equals <em>some</em> serial order. In practice almost everyone runs
            weaker levels — that gap is this whole chapter.
          </li>
          <li>
            <strong>Durability</strong> — once committed, data survives crashes:
            write-ahead logs, fsync, replication. Never absolute (disks and data
            centers fail together sometimes), only engineered probability.
          </li>
        </ul>
        <Callout type="insight">
          <p>
            Atomicity and isolation answer different questions about the same
            half-finished transaction. Atomicity: "what if it <em>dies</em>{" "}
            midway?" (undo it). Isolation: "what if someone <em>looks</em>{" "}
            midway?" (they shouldn't see it). Keeping these separate
            instantly clarifies most exam-style questions.
          </p>
        </Callout>
        <p>
          Single-object writes (one row, one document) are atomic and isolated in
          essentially every serious store — a crash mid-write never leaves you half a
          JSON document. Transactions earn their keep on{" "}
          <strong>multi-object</strong> operations: several rows, several tables, a
          row plus its index entries — anywhere a foreign key, a denormalized copy,
          or a read-modify-write spans more than one thing.
        </p>

        <H2 id="anomalies">The bestiary: five races</H2>
        <p>
          Weak isolation levels are defined by which <em>anomalies</em> they permit.
          Interviewers love these because each one is a tiny, concrete horror story.
          Step through all five — each tab ends with the level or technique that
          kills it:
        </p>

        <AnomalyPlayground />

        <Callout type="interview">
          <p>
            The five in one breath: <strong>dirty read</strong> (saw uncommitted
            data), <strong>read skew</strong> (my reads straddled someone's
            commit), <strong>lost update</strong> (concurrent read-modify-write
            clobbered), <strong>write skew</strong> (we each invalidated the
            other's premise by writing different rows),{" "}
            <strong>phantom</strong> (a write changed the result of my earlier
            search). Dirty <em>writes</em> — overwriting someone's uncommitted
            write — are so bad that every level prevents them.
          </p>
        </Callout>

        <H2 id="weak-isolation">Read committed & snapshot isolation</H2>
        <H3>Read committed</H3>
        <p>
          The baseline level: no dirty reads (you only see committed data) and no
          dirty writes (you only overwrite committed data). Implementation: writers
          take row-level locks until commit; readers don't lock — the database
          simply remembers both the old committed value and the new uncommitted one,
          and serves readers the old value until commit. Cheap, ubiquitous, and —
          as the read-skew tab showed — not enough for multi-read consistency.
        </p>
        <H3>Snapshot isolation: one frozen instant</H3>
        <p>
          Snapshot isolation gives every transaction a private, consistent view of
          the database <em>as of the moment it began</em>. Long analytics queries and
          backups see a world where time stopped, while writers carry on. The
          mechanism is <strong>MVCC</strong> — keep multiple versions of each row and
          decide visibility per-transaction:
        </p>

        <MvccVisualizer />

        <Callout type="pitfall" title="long-running transactions">
          <p>
            The snapshot guarantee has a cost dual: every old version must be kept
            while <em>any</em> snapshot might read it. A forgotten{" "}
            <code>BEGIN</code> from a stuck worker pins versions for hours →
            table/index bloat, vacuum frantically working, query plans degrading.
            Monitoring "oldest open transaction age" is standard
            production hygiene.
          </p>
        </Callout>

        <InTheWild
          title="Naming chaos: what PostgreSQL calls these levels"
          sources={[
            {
              label: "PostgreSQL docs: transaction isolation",
              href: "https://www.postgresql.org/docs/current/transaction-iso.html",
            },
          ]}
        >
          <p>
            PostgreSQL's own documentation is admirably blunt: its{" "}
            <strong>repeatable read</strong> level is implemented as snapshot
            isolation, and its <strong>serializable</strong> level is snapshot
            isolation plus conflict detection (SSI) that aborts transactions with a
            serialization failure. The SQL standard's level names predate MVCC,
            so identical names mean different guarantees across engines — always ask{" "}
            <em>which anomalies</em> a level prevents, not what it's called.
          </p>
        </InTheWild>

        <H2 id="lost-updates">Lost updates and their tools</H2>
        <p>
          The lost update deserves its own toolbox because it's the anomaly
          you'll actually ship this week: counters, account balances, editing a
          document, updating JSON inside a row — all read-modify-write. The tools, in
          rough order of preference:
        </p>
        <CodeBlock
          title="lost-update toolbox (PostgreSQL flavor)"
          lang="sql"
          code={`-- 1) Atomic operation: let the DB do read-modify-write under its own lock
UPDATE posts SET report_count = report_count + 1 WHERE id = 42;

-- 2) Explicit lock: serialize all writers of this row
BEGIN;
SELECT * FROM bookings WHERE room = 'R12' FOR UPDATE;
-- ...check rules in the app...
UPDATE bookings SET holder = 'maya' WHERE room = 'R12';
COMMIT;

-- 3) Compare-and-set: optimistic, retry on failure
UPDATE drafts SET body = :new, version = version + 1
 WHERE id = 7 AND version = :seen;   -- 0 rows updated → somebody won, retry`}
        />
        <ul>
          <li>
            <strong>Atomic operations</strong> when the modification is expressible
            in one statement — concurrency-safe by construction.
          </li>
          <li>
            <strong>Explicit locking</strong> (<code>FOR UPDATE</code>) when the
            app must think between read and write. Mind deadlocks and lock waits.
          </li>
          <li>
            <strong>Compare-and-set / version columns</strong> when you'd rather
            retry than block — also the only option over HTTP round-trips
            (ETag/If-Match is CAS for APIs).
          </li>
          <li>
            <strong>Automatic detection:</strong> under snapshot isolation, some
            engines abort a transaction whose write clobbers a concurrently
            committed one — PostgreSQL's repeatable read does;{" "}
            <strong>MySQL InnoDB's repeatable read does not</strong>. Portability
            trap.
          </li>
        </ul>

        <H2 id="serializability">Actually serial: three implementations</H2>
        <p>
          Serializable isolation — outcome equivalent to <em>some</em> one-at-a-time
          order — kills the whole bestiary at once, write skew and phantoms included.
          Three known ways to get it:
        </p>
        <H3>1 · Actually execute serially</H3>
        <p>
          One transaction at a time, on one thread. Sounds absurd until RAM got cheap
          and OLTP transactions got tiny: if the working set is in memory and every
          transaction is short, a single core doing nothing but transactions can beat
          a lock-juggling multicore. Conditions: transactions submitted as
          stored-procedure-style units (no waiting on the app mid-transaction), data
          fits in memory, throughput bounded by one core — or partition the data and
          run one thread per partition (cross-partition txns then get drastically
          slower). VoltDB/H-Store and Redis follow this design.
        </p>
        <H3>2 · Two-phase locking   3 · SSI</H3>
        <p>
          The other two are the pessimist and the optimist, compared head-to-head on
          the same race:
        </p>

        <TwoPlVsSsi />

        <p>
          Two-phase locking ruled for thirty years: readers take shared locks,
          writers exclusive ones, everything held to commit, deadlocks detected and
          broken. Phantoms force <em>predicate locks</em> — locks on a search
          condition — usually approximated with <strong>next-key/index-range
          locks</strong>. Its weakness is throughput and latency under contention:
          queues form behind every lock, and one slow transaction stalls a convoy.
        </p>
        <p>
          Serializable snapshot isolation is the modern answer: run everyone on
          snapshots with zero blocking, track read-sets, and at commit abort any
          transaction whose reads were invalidated by a concurrent writer (the
          rw-antidependency cycle from the animation). Brilliant when conflicts are
          rare; under heavy contention the abort-retry tax can exceed locking. Bound
          your transactions' size and time and SSI stays cheap.
        </p>

        <InTheWild
          title="SSI shipped: PostgreSQL 9.1 — and a Jepsen bug 9 years later"
          sources={[
            {
              label: "Ports & Grittner, \"Serializable Snapshot Isolation in PostgreSQL\" (VLDB 2012)",
              href: "https://arxiv.org/pdf/1208.4179",
            },
            {
              label: "Jepsen: PostgreSQL 12.3 analysis",
              href: "https://jepsen.io/analyses/postgresql-12.3",
            },
          ]}
        >
          <p>
            PostgreSQL 9.1 was the first production database to ship SSI: the VLDB
            paper describes tracking reads with non-blocking SIREAD locks and
            aborting when two read-write dependencies form the "dangerous
            structure." The honest footnote: Jepsen's 2020 testing of
            PostgreSQL 12.3 found a bug where serializable transactions could
            exhibit a G2-item cycle under specific conditions — patched in the next
            minor release. Even flagship implementations of subtle algorithms need
            adversarial testing; "serializable" on the label is a claim,
            not a proof.
          </p>
        </InTheWild>

        <H2 id="choosing">Choosing a level in real engines</H2>
        <p>
          Three facts about defaults and names that save real debugging hours:
          PostgreSQL, Oracle and SQL Server default to <strong>read
          committed</strong>; MySQL InnoDB defaults to <strong>repeatable
          read</strong>. Oracle's level named "serializable" is
          actually snapshot isolation — write skew is possible there. And as
          above, PostgreSQL's "repeatable read" <em>is</em> snapshot
          isolation. The SQL standard's definitions are loose enough that names
          guarantee little.
        </p>
        <CodeBlock
          title="being explicit beats trusting defaults"
          lang="sql"
          code={`-- per-transaction:
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- ... reads & writes; be ready to catch serialization_failure (SQLSTATE 40001)
COMMIT;

-- application rule of thumb:
-- wrap serializable txns in a retry loop (3–5 attempts, jittered backoff)`}
        />
        <p>
          A sane decision procedure: start at your engine's default; for every
          read-modify-write, use atomic ops/CAS; for every invariant that spans rows
          ("at least one...", "no overlap...",
          "unique..."), either materialize the conflict with a
          constraint/lock or run that transaction serializable with retries. Reserve
          whole-app serializable for when contention is genuinely low or correctness
          genuinely paramount.
        </p>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              ACID's A = abortability under failure; I = the interesting one,
              sold in levels; C = mostly your job. Single-object writes are already
              atomic — transactions matter for <strong>multi-object</strong>{" "}
              invariants.
            </>,
            <>
              Know the bestiary cold: dirty read, read skew, lost update, write
              skew, phantom — each with a one-line story and the level/technique
              that prevents it.
            </>,
            <>
              Snapshot isolation = MVCC: versions + visibility rules; readers and
              writers never block each other; cost = version GC, and long
              transactions cause bloat.
            </>,
            <>
              SI does <em>not</em> stop write skew or phantoms — "check then
              act" across different rows needs serializable or a materialized
              conflict (constraint, <code>FOR UPDATE</code>).
            </>,
            <>
              Three serializable implementations: actual serial execution
              (in-memory, short txns), 2PL (blocking + deadlocks), SSI (optimistic,
              abort & retry). Names lie across engines — PG RR = SI, Oracle
              "serializable" = SI.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · which level stops which anomaly"
          head={["Anomaly", "Read uncommitted", "Read committed", "Snapshot / RR", "Serializable"]}
          rows={[
            ["Dirty write", "✓ prevented", "✓ prevented", "✓ prevented", "✓ prevented"],
            ["Dirty read", "✗ possible", "✓ prevented", "✓ prevented", "✓ prevented"],
            ["Read skew", "✗ possible", "✗ possible", "✓ prevented", "✓ prevented"],
            ["Lost update", "✗ possible", "✗ possible", "varies †", "✓ prevented"],
            ["Write skew", "✗ possible", "✗ possible", "✗ possible", "✓ prevented"],
            ["Phantom", "✗ possible", "✗ possible", "✗ possible", "✓ prevented"],
          ]}
          footnote={
            <>
              † Under snapshot isolation, PostgreSQL repeatable read detects lost
              updates and aborts one transaction; MySQL InnoDB repeatable read does
              not. Defaults: PG / Oracle / SQL Server → read committed; MySQL →
              repeatable read. Oracle's "serializable" is snapshot
              isolation.
            </>
          }
        />

        <CheatTable
          caption="Cheat sheet · three roads to serializable"
          head={["Approach", "Mechanism", "Strengths", "Costs", "Seen in"]}
          rows={[
            [
              "Actual serial execution",
              "One txn at a time per core/partition",
              "No locks, no aborts, simple",
              "Needs in-memory data, tiny txns; 1-core ceiling; cross-partition pain",
              "VoltDB / H-Store, Redis",
            ],
            [
              "Two-phase locking",
              "Shared/exclusive locks held to commit (+ index-range locks)",
              "No aborts except deadlock; predictable",
              "Blocking, convoys, deadlocks, poor tail latency",
              "MySQL InnoDB serializable, SQL Server",
            ],
            [
              "SSI",
              "Snapshots + read-set tracking; abort on rw-cycle at commit",
              "Non-blocking reads/writes; great at low contention",
              "Abort-retry tax under contention; retry loops required",
              "PostgreSQL serializable, FoundationDB",
            ],
          ]}
        />

        <InterviewQA
          items={[
            {
              q: "Two users both run 'check seat free, then book it'. What goes wrong at each isolation level, and the fix?",
              a: (
                <p>
                  The check queries a row state that the other transaction is about
                  to change. At read committed and snapshot isolation, both checks
                  pass and both bookings insert/update — write skew (or a phantom if
                  the booking row didn't exist yet). Fixes: a unique/exclusion
                  constraint on (seat, showing) so the second booking fails hard;{" "}
                  <code>SELECT … FOR UPDATE</code> on the seat row to serialize the
                  two; or serializable isolation with a retry loop. In an interview,
                  offering the constraint first signals production instincts —
                  it's the cheapest and can't be forgotten by a future code
                  path.
                </p>
              ),
            },
            {
              q: "Why doesn't snapshot isolation prevent write skew?",
              a: (
                <p>
                  SI's conflict detection is write-write: first committer wins
                  on the <em>same object</em>. Write skew is read-write across{" "}
                  <em>different</em> objects — each txn reads a set, then writes
                  something the other read. Both snapshots were internally
                  consistent; the serial-order illusion breaks only when you compare
                  them. Detecting it requires tracking <em>reads</em> (SSI's
                  SIREAD machinery) or forcing both txns to touch a common row.
                </p>
              ),
            },
            {
              q: "How does MVCC decide which row version a transaction sees?",
              a: (
                <p>
                  Each version carries created_by / deleted_by transaction IDs. At
                  start, a transaction snapshots the set of committed transactions.
                  A version is visible iff its creator is in that snapshot and its
                  deleter is not. Updates create a new version and tombstone the
                  old; GC (vacuum/purge) reclaims versions no live snapshot can see.
                  Consequences worth volunteering: long transactions block GC →
                  bloat; reads need no locks at all.
                </p>
              ),
            },
            {
              q: "When would you actually run a database at serializable?",
              a: (
                <p>
                  When an invariant spans multiple rows and can't be expressed
                  as a constraint: no-overlap scheduling, "at least one on
                  duty", balance across accounts, uniqueness over a computed
                  predicate. Prefer it when contention is low (SSI aborts stay rare)
                  and transactions are short. Always pair with a retry-on-40001
                  loop. If one hot row dominates contention, a materialized lock on
                  that row often beats global serializable.
                </p>
              ),
            },
            {
              q: "What's the difference between a lost update and write skew?",
              a: (
                <p>
                  Lost update: two txns read-modify-write the <em>same object</em>;
                  one overwrite erases the other. Write skew: two txns read shared
                  state, then write <em>different</em> objects, jointly violating an
                  invariant neither violated alone. The same-object case has cheap
                  fixes (atomic ops, CAS, FOR UPDATE, SI detection in some engines);
                  the different-object case fundamentally needs serializable or a
                  conflict you materialize yourself.
                </p>
              ),
            },
            {
              q: "Why can't ordinary row locks stop phantoms?",
              a: (
                <p>
                  Because the conflicting row doesn't exist when you read. A
                  lock attaches to a row; a phantom is about a <em>predicate</em>{" "}
                  ("rows where name = nova")
                  whose answer a later insert changes. Engines approximate
                  predicate locks with index-range (next-key) locks — locking the
                  gap where matching rows would land — or you sidestep it with a
                  unique constraint that turns the race into an error.
                </p>
              ),
            },
            {
              q: "Your payment service does read-balance, subtract, write-balance. Make it safe.",
              a: (
                <p>
                  Best: one atomic statement —{" "}
                  <code>
                    UPDATE accounts SET balance = balance − :amt WHERE id = :id AND
                    balance ≥ :amt
                  </code>
                  , check rows-affected (this also enforces the non-negative
                  invariant). If app logic must run between read and write:{" "}
                  <code>FOR UPDATE</code>. Across services/HTTP: CAS with a version
                  column or If-Match. Plus idempotency keys for retries — that part
                  is chapter 8's story.
                </p>
              ),
            },
            {
              q: "How would actual serial execution ever be fast enough?",
              a: (
                <p>
                  Drop the two costs that made databases multi-threaded: disk waits
                  (keep the working set in RAM) and human/app waits inside
                  transactions (submit whole transactions as stored procedures). A
                  single core executing back-to-back in-memory transactions has no
                  lock overhead at all. Scale by partitioning and pinning one thread
                  per partition; the trade is that cross-partition transactions
                  become slow and rare-by-design.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "ACID consistency means the database keeps my data consistent.",
              reality: (
                <>
                  The C is the application's invariants.
                  atomicity, isolation and constraints as <em>tools</em>; only you
                  know that "every booking has a payer".
                  Of the four
                  letters, C is the one the DB can't do alone.
                </>
              ),
            },
            {
              myth: "Repeatable read means the same thing in every database.",
              reality: (
                <>
                  PostgreSQL's RR is snapshot isolation (and detects lost
                  updates); MySQL InnoDB's RR is gap-locked MVCC that does{" "}
                  <em>not</em> detect lost updates; Oracle doesn't offer RR and
                  its "serializable" is SI.
                  Compare by anomalies
                  prevented, never by name.
                </>
              ),
            },
            {
              myth: "Serializable is always far too slow for production.",
              reality: (
                <>
                  That was 2PL's reputation.
                  SSI costs little when conflicts
                  are rare — reads don't block, writes don't block; you
                  pay only in aborts under contention. Plenty of systems run
                  PostgreSQL serializable for the transactions that need it and
                  default elsewhere.
                </>
              ),
            },
            {
              myth: "Snapshot isolation protects read-modify-write code.",
              reality: (
                <>
                  Only sometimes, and engine-dependently. PG RR aborts the loser of
                  a lost-update race; MySQL RR happily loses the update. And no SI
                  implementation stops write skew. Use atomic
                  ops/CAS/locks/serializable per the invariant, not the level's
                  vibe.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
