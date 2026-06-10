import React from "react";
import DDIAThemeProvider from "../../components/ddia/DDIAThemeProvider";
import {
  H2,
  H3,
  Callout,
  InTheWild,
  KeyTakeaways,
  CheatTable,
  InterviewQA,
  Misconceptions,
} from "../../components/ddia/blocks";
import CodeBlock from "../../components/ddia/CodeBlock";
import FlakyNetworkLab from "../../components/ddia/animations/FlakyNetworkLab";
import ClockSkewLww from "../../components/ddia/animations/ClockSkewLww";
import FencingTokens from "../../components/ddia/animations/FencingTokens";

export default function DistributedTroubleArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content max-w-none">
        <p>
          A single computer is binary: it works, or it's obviously broken. A
          distributed system lives in a third state — <em>partially</em> broken,
          nondeterministically, with no one able to say for sure which parts. This
          chapter is the book's cold shower: networks drop messages, clocks
          lie, and processes freeze mid-instruction. Everything in chapter 9 is
          machinery built to survive what this chapter establishes.
        </p>

        <H2 id="partial-failure">Partial failure, the defining condition</H2>
        <p>
          Picture a relay race where any runner might silently stand still for a
          minute, the baton sometimes vanishes mid-handoff, and each runner's
          stopwatch disagrees with the others — yet the team is still expected to
          post a time. That's a distributed system: independent machines,
          independent failures, connected by an unreliable medium, required to act
          as one.
        </p>
        <p>
          The engineering stance that follows: assume <em>every</em> component will
          fail in <em>every</em> combination, and build the reliable whole out of
          unreliable parts — the same move TCP makes over lossy IP. Supercomputers
          choose differently (checkpoint, crash entirely, restart); internet
          services can't, because they must stay up through node failures,
          rolling deploys, and hardware swaps.
        </p>
        <Callout type="insight">
          <p>
            The deepest difficulty isn't that things fail — it's that you
            often <em>can't know</em> whether they failed. A node that
            doesn't answer might be dead, slow, or unreachable — and each calls
            for a different response. Distributed systems are about acting
            correctly under <strong>uncertainty about state</strong>, not just
            recovering from failure.
          </p>
        </Callout>

        <H2 id="networks">Networks: silence is the only signal</H2>
        <p>
          The internet's design point is <strong>asynchronous packet
          switching</strong>: maximize utilization of shared links, promise nothing
          about delivery or timing. So a request may be lost, queued, delivered to a
          dead process; a reply may be lost or delayed. The sender observes exactly
          one symptom for all of these: <em>no answer yet</em>. Step through the
          cheapest possible disaster — one lost packet — and its standard cure:
        </p>

        <FlakyNetworkLab />

        <CodeBlock
          title="idempotent consumer, sketch"
          lang="pseudo"
          code={`handle(request):
  if results.contains(request.idempotency_key):
      return results[request.idempotency_key]      # replay, no side effect

  outcome = charge(request.amount)                 # the side effect, once
  results.put(request.idempotency_key, outcome)    # record atomically with it
  return outcome

# client: generate the key ONCE per logical operation; reuse it on every retry`}
        />
        <Callout type="pitfall" title="timeout tuning">
          <p>
            There is no "correct" timeout. Short timeouts detect failure
            fast but declare slow nodes dead — and shifting their load can cascade
            an overload. Long timeouts make users wait through real failures.
            Network delay is unbounded in principle (queues at switches, NICs, OS
            buffers, GC on the receiver), so production systems measure response
            times and adapt timeouts continuously (Phi-accrual style detectors,
            jittered exponential backoff on retries).
          </p>
        </Callout>

        <InTheWild
          title="Stripe: idempotency keys as a public API contract"
          sources={[
            {
              label: "Stripe blog: designing robust and predictable APIs with idempotency",
              href: "https://stripe.com/blog/idempotency",
            },
          ]}
        >
          <p>
            Stripe's payments API exposes exactly the mechanism in the
            animation: clients send an <code>Idempotency-Key</code> header; the
            server stores the result of the first execution and replays it for any
            retry bearing the same key, so a charge is never applied twice even when
            connections die mid-request. Their guidance matches the theory — always
            retry on ambiguity, with the same key, with exponential backoff — turning
            the scary "was it charged?" state into a safe default.
          </p>
        </InTheWild>

        <H2 id="clocks">Clocks: two kinds, both dangerous</H2>
        <p>
          Every machine has two very different clocks, and most clock bugs come from
          using the wrong one:
        </p>
        <ul>
          <li>
            <strong>Time-of-day clock</strong> — wall time, synced by NTP. It can{" "}
            <em>jump backwards</em> (NTP step corrections), pause (leap seconds), or
            drift badly. Fine for timestamps shown to humans; treacherous for
            measuring durations or ordering events.
          </li>
          <li>
            <strong>Monotonic clock</strong> — a counter that only moves forward
            (<code>CLOCK_MONOTONIC</code>, <code>System.nanoTime()</code>). Its
            absolute value is meaningless, but differences are trustworthy. Always
            the right tool for timeouts and latency measurement — on one machine.
            It's meaningless across machines.
          </li>
        </ul>
        <p>
          Cross-machine ordering by wall clock is where data quietly dies. The
          classic: conflict resolution by <em>last write wins</em> with skewed
          clocks —
        </p>

        <ClockSkewLww />

        <InTheWild
          title="Cloudflare's leap-second outage: time went backwards"
          sources={[
            {
              label: "Cloudflare blog: how and why the leap second affected Cloudflare DNS",
              href: "https://blog.cloudflare.com/how-and-why-the-leap-second-affected-cloudflare-dns/",
            },
          ]}
        >
          <p>
            At midnight UTC on New Year's 2017 a leap second made time appear
            to step backwards on Cloudflare's edge. Their Go-based DNS server
            computed a duration from two wall-clock readings, got a{" "}
            <em>negative</em> number, and panicked — at peak about 0.2% of DNS
            queries were failing across their network. The patch took ~90 minutes to
            start rolling and the fix was textbook chapter 8: never subtract two
            time-of-day readings to measure elapsed time; that's the monotonic
            clock's job.
          </p>
        </InTheWild>

        <InTheWild
          title="Spanner: making physical time safe with uncertainty"
          sources={[
            {
              label: "Spanner (OSDI 2012 paper)",
              href: "https://research.google.com/archive/spanner-osdi2012.pdf",
            },
            {
              label: "Google Cloud docs: TrueTime and external consistency",
              href: "https://docs.cloud.google.com/spanner/docs/true-time-external-consistency",
            },
          ]}
        >
          <p>
            Google's Spanner shows the disciplined way to use physical clocks
            for ordering: TrueTime returns an <em>interval</em> [earliest, latest]
            bounded by GPS and atomic clocks in each datacenter, and a transaction{" "}
            <em>waits out the uncertainty</em> before its commit becomes visible —
            guaranteeing that timestamp order matches real-time order (external
            consistency). The honesty is the point: instead of pretending the clock
            is exact, quantify the error and pay for it with a small wait.
          </p>
        </InTheWild>

        <H2 id="pauses">Process pauses and fencing</H2>
        <p>
          Even your own process can betray you: a stop-the-world GC, a VM
          live-migration, paging, or an operator's <code>SIGSTOP</code> can
          freeze execution for seconds-to-minutes <em>between any two
          instructions</em>. The code can't feel it happening. So any logic of
          the form "I checked I hold the lease, therefore I may write"
          contains a hidden race against time itself:
        </p>

        <FencingTokens />

        <Callout type="interview" title="the one-liner">
          <p>
            A distributed lock without fencing is a polite suggestion. The resource
            itself must reject stale writers — monotonically increasing token,
            checked at the storage — because the paused client cannot be informed
            that it lost the lease in time to stop itself.
          </p>
        </Callout>

        <H2 id="knowledge">Truth by majority</H2>
        <p>
          If a node can't trust its own clock or its own sense of being alive
          (it might be mid-pause), what can anyone trust? The pragmatic answer:{" "}
          <strong>quorums</strong>. A node is "dead" when a majority
          says so — even if it's actually alive and merely partitioned; it must
          then step down. Majorities are the bridge from "no individual can
          know" to "the system can decide", and they're the
          seed of chapter 9's consensus algorithms.
        </p>
        <p>
          Scope note: all of this assumes nodes are honest-but-faulty (crash,
          pause, lose messages). If nodes can <em>lie</em> — send corrupted or
          malicious messages — you're in <strong>Byzantine fault</strong>{" "}
          territory: flight-control and blockchain land, requiring much more
          expensive protocols. Inside one organization's datacenter, the
          standard and reasonable assumption is non-Byzantine.
        </p>

        <InTheWild
          title="GitHub, Oct 21 2018: 43 seconds of partition, 24 hours of cleanup"
          sources={[
            {
              label: "GitHub post-incident analysis",
              href: "https://github.blog/2018-10-30-oct21-post-incident-analysis/",
            },
          ]}
        >
          <p>
            Routine maintenance caused a ~43-second network partition between
            GitHub's East and West coast facilities. Their Raft-based
            orchestration failed MySQL leadership across the country — correct
            behavior locally — but writes had continued briefly in both places,
            leaving two primaries with divergent data. Restoring consistency meant
            ~24 hours of degraded service while data was reconciled. A 43-second
            network event, hours of consequence: partial failure's
            cost asymmetry in one incident.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Distributed = <strong>partial failure under uncertainty</strong>: a
              non-response never tells you whether the request, the node, or the
              reply failed. Timeouts detect silence, not state.
            </>,
            <>
              Retries are mandatory and dangerous: pair at-least-once delivery with{" "}
              <strong>idempotency</strong> (keys + result store) to get
              exactly-once <em>effect</em>.
            </>,
            <>
              Two clocks: time-of-day (can jump back; never measure with it) and
              monotonic (durations only, one machine only). Ordering events across
              machines by wall clock silently loses data under LWW.
            </>,
            <>
              Processes pause without noticing (GC, VM migration). Lease-then-act
              logic is a race; <strong>fencing tokens</strong> checked at the
              resource make stale writers powerless.
            </>,
            <>
              No node can trust itself; the system trusts <strong>majorities</strong>.
              Crash-faulty is the normal model; Byzantine (lying nodes) is a
              different, far costlier game.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · failure modes and standard mitigations"
          head={["Failure", "Symptom", "Mitigation"]}
          rows={[
            [
              "Lost request/reply",
              "Timeout; outcome unknown",
              "Retry + idempotency key; jittered backoff",
            ],
            [
              "Slow node (not dead)",
              "Timeouts fire, load shifts, risk of cascade",
              "Adaptive timeouts (measured), hedged requests, circuit breakers",
            ],
            [
              "Clock skew / jumps",
              "Wrong event order; negative durations; LWW data loss",
              "Monotonic clocks for durations; logical clocks / version vectors for order; bounded-uncertainty (TrueTime) if physical order required",
            ],
            [
              "Process pause (GC, VM)",
              "Expired lease holder acts as zombie",
              "Fencing tokens enforced at the resource; short leases + heartbeats",
            ],
            [
              "Network partition",
              "Two sides each suspect the other dead",
              "Quorum-based decisions; minority side steps down",
            ],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · the two clocks"
          head={["", "Time-of-day", "Monotonic"]}
          rows={[
            ["What it returns", "Wall time (epoch)", "Counter since arbitrary point"],
            ["Can jump backwards", "Yes (NTP step, leap second)", "Never"],
            ["Comparable across machines", "Approximately (skew!)", "No — meaningless"],
            ["Use for", "Human-facing timestamps", "Timeouts, durations, latency"],
            ["Never use for", "Measuring durations, ordering writes", "Cross-machine anything"],
          ]}
        />

        <InterviewQA
          items={[
            {
              q: "A request times out. Walk me through what might be true and what you'd do.",
              a: (
                <p>
                  Four indistinguishable worlds: request lost; server crashed
                  before/while processing; server processing slowly; reply lost. So
                  the operation may have happened 0 or 1 times. Action: retry with
                  the same idempotency key and exponential backoff + jitter; cap
                  retries; surface ambiguity to the caller if the budget is
                  exhausted. Design-side: make every state-changing endpoint
                  idempotent so this question stops being scary.
                </p>
              ),
            },
            {
              q: "How do you get exactly-once semantics?",
              a: (
                <p>
                  You don't get exactly-once <em>delivery</em> over a lossy
                  network; you get at-least-once delivery plus deduplication for
                  exactly-once <em>effect</em>. Mechanics: client generates a unique
                  operation ID once; server records ID → result atomically with the
                  side effect (same transaction/log entry); retries replay the
                  stored result. The atomicity of "effect + record" is
                  the part people miss.
                </p>
              ),
            },
            {
              q: "Why is last-write-wins dangerous, and when is it acceptable?",
              a: (
                <p>
                  LWW orders by timestamp; with skewed clocks a stale node's
                  write can carry a <em>larger</em> timestamp than a causally later
                  write and silently delete it — no error, durable corruption.
                  Acceptable when losing some concurrent writes is genuinely fine
                  (caches, metrics, presence) or when keys are written once and
                  immutable. For anything precious: version vectors (detect
                  concurrency, merge) or single-leader ordering.
                </p>
              ),
            },
            {
              q: "Design a distributed lock. What goes wrong with the obvious version?",
              a: (
                <p>
                  Obvious: lock service grants a lease with TTL; holder renews.
                  Failure: holder GC-pauses past expiry, service re-grants, old
                  holder wakes and writes — two writers. Fix: service issues a
                  monotonically increasing fencing token with each grant; the
                  protected resource records the max token and rejects lower ones
                  (or uses conditional writes). Also: the lock service itself must
                  be consensus-backed (chapter 9) or it's a single point of
                  lying.
                </p>
              ),
            },
            {
              q: "Your p99 spiked after you lowered timeouts to 'fail fast'. What happened?",
              a: (
                <p>
                  Lower timeouts declared slow-but-alive nodes dead; their load
                  shifted to neighbors, pushing <em>them</em> over the edge —
                  timeout-induced cascade. Slow ≠ dead is the core confusion.
                  Remedies: timeouts derived from measured latency distributions,
                  retry budgets, circuit breakers that shed load instead of
                  shifting it, and hedged requests for the tail rather than blanket
                  aggression.
                </p>
              ),
            },
            {
              q: "Where do unbounded delays actually come from inside one datacenter?",
              a: (
                <p>
                  Queues, mostly: switch buffers under incast, NIC/OS receive
                  queues, CPU run-queues on a loaded host, TCP retransmit +
                  head-of-line blocking, plus receiver-side GC pauses. Sender-side
                  throttling too. The point for design: delay has no hard upper
                  bound, so correctness can never depend on "it will arrive
                  within X ms" — X is an SLO, not a law.
                </p>
              ),
            },
            {
              q: "When would you reach for Byzantine fault tolerance?",
              a: (
                <p>
                  When participants can lie or be compromised and there's no
                  single trusted operator: multi-organization consortia, public
                  blockchains, safety-critical voting between redundant sensors.
                  Inside one company's infrastructure it's the wrong
                  tool — 3f+1 replicas and multi-round protocols cost dearly, and
                  your real threats (bugs, misconfig) are better handled by
                  checksums, auth, and review.
                </p>
              ),
            },
            {
              q: "How does a node know it's been declared dead, and why must it care?",
              a: (
                <p>
                  It often <em>doesn't</em> know promptly — that's the
                  problem. A quorum may demote a leader that's alive but
                  partitioned or paused; if it keeps acting (serving reads, taking
                  writes) you get split brain. Hence: leases that self-expire
                  (step down when you can't renew), fencing tokens at
                  resources, and epoch/term numbers on every message so stale
                  leaders' traffic is rejected on arrival.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "TCP gives me reliable delivery, so my RPCs are reliable.",
              reality: (
                <>
                  TCP retransmits within a connection, but connections reset, hosts
                  crash after ACKing, and replies vanish with the process. At the
                  application level you still face the 0-or-1-times ambiguity —
                  idempotency is yours to build.
                </>
              ),
            },
            {
              myth: "NTP keeps clocks accurate enough to order events.",
              reality: (
                <>
                  NTP bounds drift, with tens-of-milliseconds typical error and
                  far worse under load or misconfig — plus backward jumps on
                  corrections. Tens of ms is an eternity: thousands of writes.
                  Order by logical clocks or a single sequencer, not wall time.
                </>
              ),
            },
            {
              myth: "A 30-second GC pause is a JVM-tuning problem, not a design input.",
              reality: (
                <>
                  Pauses of that order also come from VM migration, paging, and
                  snapshots — on any runtime. Correctness must survive a freeze
                  between any two instructions; that's precisely why leases
                  expire and fencing exists.
                </>
              ),
            },
            {
              myth: "Inside one datacenter the network is basically reliable.",
              reality: (
                <>
                  Better, not reliable: top-of-rack switch failures, link flaps,
                  congestion incast, and maintenance partitions all happen — GitHub
                  lost cross-country connectivity for 43 seconds and spent a day
                  recovering. Design for partition even "inside".
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
