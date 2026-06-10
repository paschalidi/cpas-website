
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Clock skew + last-write-wins: node A's clock runs 5s fast; node B's
 * genuinely-later write gets a smaller timestamp and is silently discarded.
 */

const steps = [
  {
    caption: (
      <>
        Two replicas accept writes for the same key and resolve conflicts with{" "}
        <strong>last write wins</strong>: keep the value with the biggest
        timestamp. One detail: node A&apos;s clock runs <strong>5 seconds
        fast</strong>. NTP keeps clocks <em>close</em>, not equal — skew of tens of
        milliseconds is normal, and much worse happens.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>10:00:00 real time:</strong> client 1 writes{" "}
        <code>status = &quot;draft&quot;</code> via node A. A stamps it with its own
        clock: <strong>10:00:05</strong> — five seconds in the future.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>10:00:02 real time</strong> — two seconds <em>later</em>, causally
        after the first write — client 2 writes{" "}
        <code>status = &quot;published&quot;</code> via node B. B&apos;s honest clock
        stamps it <strong>10:00:02</strong>.
      </>
    ),
  },
  {
    caption: (
      <>
        The replicas sync and compare timestamps: 10:00:05 &gt; 10:00:02, so LWW
        keeps <code>&quot;draft&quot;</code> and discards{" "}
        <code>&quot;published&quot;</code>. The genuinely newer write loses.
      </>
    ),
  },
  {
    caption: (
      <>
        Worst part: <strong>no error anywhere</strong>. Both clients got success;
        replication converged cleanly; monitoring is green. The data is simply
        wrong, durably. Clock-skew bugs don&apos;t crash — they corrupt.
      </>
    ),
  },
  {
    caption: (
      <>
        Fix 1 — stop using wall clocks for <em>ordering</em>.{" "}
        <strong>Logical clocks</strong> (Lamport timestamps) are counters that only
        promise &ldquo;if X caused Y, then ts(X) &lt; ts(Y)&rdquo; — exactly the
        property ordering needs and wall clocks lack. <strong>Version
        vectors</strong> go further: they detect that two writes were concurrent
        and keep <em>both</em> for the application to merge.
      </>
    ),
  },
  {
    caption: (
      <>
        Fix 2 — if you must use physical time, use <strong>uncertainty
        intervals</strong>: Google&apos;s TrueTime returns [earliest, latest] and
        Spanner <em>waits out</em> the uncertainty before commit, so timestamp
        order matches real order. Either way the lesson stands: a timestamp from
        an unsynchronized clock is an opinion, not a fact.
      </>
    ),
  },
];

export default function ClockSkewLww() {
  return (
    <AnimationShell
      title="Clock skew: how last-write-wins loses data"
      subtitle="a 5-second-fast clock silently wins the future"
      steps={steps}
    >
      {(step) => {
        const w1 = step >= 1;
        const w2 = step >= 2;
        const merged = step >= 3;

        return (
          <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label="Clock skew and last-write-wins diagram">
            <VizDefs />

            {/* real-time ruler */}
            <line x1={60} y1={40} x2={700} y2={40} stroke="var(--line-strong)" />
            <Txt x={60} y={28} size={10} mono>
              real time →
            </Txt>
            {[0, 1, 2, 3].map((t) => (
              <g key={t}>
                <line x1={140 + t * 150} y1={34} x2={140 + t * 150} y2={46} stroke="var(--line-strong)" />
                <Txt x={140 + t * 150} y={60} size={9.5} mono anchor="middle">
                  10:00:0{t}
                </Txt>
              </g>
            ))}

            {/* nodes */}
            <NodeBox x={40} y={90} w={170} h={56} label="node A" sub="clock +5s fast ⚠" tone="warn" />
            <NodeBox x={40} y={186} w={170} h={56} label="node B" sub="clock accurate" tone="default" />

            {/* write events on the ruler */}
            <g className="tr" opacity={w1 ? 1 : 0}>
              <circle cx={140} cy={40} r={5} fill="var(--accent)" />
              <Arrow x1={140} y1={48} x2={150} y2={88} tone="acc" show={w1} />
              <Txt x={228} y={112} size={11} mono tone="ink">
                write &quot;draft&quot;
              </Txt>
              <Txt x={228} y={130} size={11} mono tone="bad" weight={700}>
                stamped 10:00:05 ←skewed
              </Txt>
            </g>
            <g className="tr" opacity={w2 ? 1 : 0}>
              <circle cx={440} cy={40} r={5} fill="var(--info)" />
              <Arrow x1={440} y1={48} x2={200} y2={186} tone="info" show={w2} curve={-30} />
              <Txt x={228} y={208} size={11} mono tone="ink">
                write &quot;published&quot;  (2s later!)
              </Txt>
              <Txt x={228} y={226} size={11} mono tone="info" weight={700}>
                stamped 10:00:02 ←honest
              </Txt>
            </g>

            {/* merge */}
            <g className="tr" opacity={merged ? 1 : 0}>
              <NodeBox x={520} y={132} w={176} h={70} label="LWW merge" sub="keep max(timestamp)" tone={step >= 4 ? "bad" : "default"} fillTone={step >= 4 ? "bad" : undefined} />
              <Arrow x1={210} y1={118} x2={520} y2={150} tone="acc" show={merged} label="05 wins" />
              <Arrow x1={210} y1={214} x2={520} y2={186} tone="bad" show={merged} dashed label='"published" dropped' />
            </g>

            <Badge x={608} y={228} label='final: "draft" ✗' tone="bad" show={step >= 3 && step < 5} />
            <g className="tr" opacity={step === 4 ? 1 : 0}>
              <Txt x={40} y={282} size={10.5} tone="bad" weight={600}>
                no error raised · both clients saw OK · replication “healthy” · data silently wrong
              </Txt>
            </g>

            {/* fixes panel */}
            <g className="tr" opacity={step >= 5 ? 1 : 0}>
              <rect x={420} y={92} width={284} height={150} rx={10} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.4} />
              <Txt x={436} y={114} size={10} weight={700} mono tone="ok">
                ORDER WITHOUT WALL CLOCKS
              </Txt>
              <Txt x={436} y={138} size={10.5} tone="ink">
                Lamport ts: causality ⇒ ts order
              </Txt>
              <Txt x={436} y={158} size={10.5} tone="ink">
                Version vectors: detect concurrency,
              </Txt>
              <Txt x={436} y={174} size={10.5} tone="ink">
                keep siblings, app merges
              </Txt>
              <Txt x={436} y={200} size={10.5} tone="ink" show={step >= 6}>
                TrueTime: [earliest, latest] interval;
              </Txt>
              <Txt x={436} y={216} size={10.5} tone="ink" show={step >= 6}>
                Spanner waits out uncertainty ε
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
