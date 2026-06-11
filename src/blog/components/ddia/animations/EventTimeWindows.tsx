import AnimationShell from "./AnimationShell";
import { VizDefs, Txt, Badge, Arrow } from "./viz";

/**
 * Event time vs processing time: a phone in a tunnel, tumbling windows,
 * a watermark, and the three ways to handle the straggler.
 */

const steps = [
  {
    caption: (
      <>
        &ldquo;Count the scores submitted per minute&rdquo; hides a question:
        per minute of <em>what</em>? <strong>Event time</strong> = when the
        score actually happened (the device&apos;s timestamp).{" "}
        <strong>Processing time</strong> = when our server got around to it.
        They&apos;re close — until they aren&apos;t.
      </>
    ),
  },
  {
    caption: (
      <>
        A mobile game streams score events. We bucket them into{" "}
        <strong>tumbling 1-minute windows</strong> by event time: 10:01, 10:02,
        10:03… Most events arrive within a second or two of happening — dots
        landing in their windows almost immediately.
      </>
    ),
  },
  {
    caption: (
      <>
        One player enters a tunnel at <strong>10:02</strong>. Their score event
        is created — timestamped 10:02 — and buffered on the phone. The network
        will see it… eventually. (Same story, server-side: a deploy, a retry
        storm, a consumer backlog — delay between happening and arriving is the
        norm, not the exception.)
      </>
    ),
  },
  {
    caption: (
      <>
        10:07: tunnel ends, the event arrives — a <strong>straggler</strong>.
        Event time 10:02, processing time 10:07, five minutes apart. Which
        window does it belong to? By meaning: 10:02. By arrival: 10:07. This is
        the whole problem in one dot.
      </>
    ),
  },
  {
    caption: (
      <>
        If we&apos;d windowed by <em>processing</em> time: the 10:02 window
        undercounts and 10:07 shows a phantom spike — and every deploy or
        network blip paints fake patterns into the metrics. Processing-time
        windows measure <em>your pipeline&apos;s mood</em>, not the world.
        (Sometimes that&apos;s what you want — &ldquo;requests hitting us per
        second&rdquo; — but be choosing it, not defaulting into it.)
      </>
    ),
  },
  {
    caption: (
      <>
        Event-time windows raise a new puzzle: when can we <em>close</em> the
        10:02 window and emit its count? Arrival order proves nothing. Enter the{" "}
        <strong>watermark</strong>: a flowing assertion, &ldquo;we believe all
        events with timestamp ≤ T have now arrived&rdquo; — derived
        heuristically from observed lateness. When the watermark passes 10:03,
        the 10:02 window fires.
      </>
    ),
  },
  {
    caption: (
      <>
        But watermarks are bets, and our tunnel event arrives <em>after</em> the
        bet settled. Three honest options: <strong>drop</strong> it (count is
        slightly wrong — fine for dashboards); <strong>update</strong> — re-emit
        a corrected result for 10:02 (downstream must handle revisions);{" "}
        <strong>sideline</strong> it to a late-events output for reconciliation.
        Pick per use case; pretending lateness won&apos;t happen is the only
        wrong answer.
      </>
    ),
  },
  {
    caption: (
      <>
        Completing the toolkit: window shapes — <strong>tumbling</strong>{" "}
        (fixed, disjoint), <strong>hopping</strong> (fixed, overlapping for
        smoothing), <strong>session</strong> (close after a gap of inactivity —
        per-user bursts). And the fault-tolerance footnote: when a failed
        processor recomputes a window, results must not double-count
        downstream — idempotent sinks or transactional output (chapter
        8&apos;s idempotence, industrialized as Kafka&apos;s exactly-once) make
        reprocessing safe.
      </>
    ),
  },
];

/** timeline geometry */
const X0 = 70; // x of 10:01
const W = 118; // px per minute
const minuteX = (m: number) => X0 + (m - 1) * W; // m = minutes after 10:00
const AXIS_Y = 150;

const liveEvents = [
  { t: 1.2, lane: 0 },
  { t: 1.55, lane: 1 },
  { t: 2.3, lane: 0 },
  { t: 2.75, lane: 1 },
  { t: 3.4, lane: 0 },
  { t: 4.2, lane: 1 },
  { t: 4.6, lane: 0 },
];

export default function EventTimeWindows() {
  return (
    <AnimationShell
      title="Event time, windows, and the straggler"
      subtitle="a phone in a tunnel vs your per-minute metrics"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const windowsOn = step >= 1;
        const tunnel = step >= 2;
        const arrived = step >= 3;
        const wmOn = step >= 5;
        const choices = step >= 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Event-time windowing diagram">
            <VizDefs />

            {/* axis */}
            <line x1={40} y1={AXIS_Y} x2={680} y2={AXIS_Y} stroke="var(--line-strong)" strokeWidth={1.4} />
            {[1, 2, 3, 4, 5].map((m) => (
              <g key={m}>
                <line x1={minuteX(m)} y1={AXIS_Y - 5} x2={minuteX(m)} y2={AXIS_Y + 5} stroke="var(--line-strong)" />
                <Txt x={minuteX(m)} y={AXIS_Y + 22} size={9.5} mono tone="mut" anchor="middle">{`10:0${m}`}</Txt>
              </g>
            ))}
            <Txt x={680} y={AXIS_Y - 12} size={9} mono tone="mut" anchor="end">event time →</Txt>

            {/* tumbling windows */}
            {windowsOn &&
              [1, 2, 3, 4].map((m) => {
                const isTwo = m === 2;
                const closed = wmOn && m <= 2;
                return (
                  <g key={m} className="tr">
                    <rect
                      x={minuteX(m)}
                      y={AXIS_Y - 76}
                      width={W - 6}
                      height={70}
                      rx={8}
                      fill="none"
                      stroke={isTwo && arrived ? "var(--warn)" : closed ? "var(--ok)" : "var(--line-strong)"}
                      strokeWidth={isTwo ? 1.8 : 1.2}
                      strokeDasharray={closed ? undefined : "4 4"}
                    />
                    <Txt x={minuteX(m) + 8} y={AXIS_Y - 60} size={8.5} mono tone={closed ? "ok" : "mut"}>
                      {closed ? `w 10:0${m} FIRED` : `window 10:0${m}`}
                    </Txt>
                  </g>
                );
              })}

            {/* live events */}
            {windowsOn &&
              liveEvents.map((e, i) => (
                <circle key={i} cx={minuteX(e.t)} cy={AXIS_Y - 28 - e.lane * 16} r={5} fill="var(--accent)" className="tr" />
              ))}

            {/* tunnel event */}
            {tunnel && (
              <g className="tr">
                <circle
                  cx={arrived ? minuteX(2.55) : minuteX(2.55)}
                  cy={arrived ? AXIS_Y - 28 : AXIS_Y + 56}
                  r={6}
                  fill="none"
                  stroke="var(--bad)"
                  strokeWidth={2}
                  className="tr"
                />
                {!arrived && (
                  <>
                    <Txt x={minuteX(2.55)} y={AXIS_Y + 78} size={9} tone="bad" anchor="middle" mono>
                      created 10:02 · stuck in tunnel
                    </Txt>
                  </>
                )}
                {arrived && (
                  <>
                    <Arrow x1={minuteX(5)} y1={AXIS_Y + 52} x2={minuteX(2.62)} y2={AXIS_Y - 20} tone="bad" show curve={-40} label="arrives 10:07 → belongs to 10:02" />
                    <Txt x={minuteX(5)} y={AXIS_Y + 70} size={9} tone="bad" anchor="middle" mono>
                      straggler: event 10:02, processed 10:07
                    </Txt>
                  </>
                )}
              </g>
            )}

            {/* processing-time warning */}
            <g className="tr" opacity={step === 4 ? 1 : 0}>
              <Badge x={360} y={36} label="processing-time windows: phantom spike at 10:07, fake dip at 10:02" tone="warn" />
            </g>

            {/* watermark */}
            {wmOn && (
              <g className="tr">
                <line x1={minuteX(3.15)} y1={AXIS_Y - 84} x2={minuteX(3.15)} y2={AXIS_Y + 8} stroke="var(--info)" strokeWidth={2.2} strokeDasharray="6 3" />
                <Txt x={minuteX(3.15) + 6} y={AXIS_Y - 88} size={9} mono tone="info">
                  watermark: “all ≤ 10:03 arrived (we believe)”
                </Txt>
              </g>
            )}

            {/* late options */}
            <g className="tr" opacity={choices ? 1 : 0}>
              <rect x={40} y={228} width={640} height={66} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={56} y={248} size={9.5} mono weight={700} tone="acc">{step >= 7 ? "WINDOW SHAPES & SAFE REPROCESSING" : "THE STRAGGLER MENU"}</Txt>
              {step === 6 ? (
                <>
                  <Txt x={56} y={268} size={10.5}>drop (cheap, slightly wrong) · update (re-emit corrected window; downstream handles revisions)</Txt>
                  <Txt x={56} y={286} size={10.5}>sideline (late-output stream → reconciliation job) — choose per use case, never by accident</Txt>
                </>
              ) : (
                <>
                  <Txt x={56} y={268} size={10.5}>tumbling (disjoint) · hopping (overlapping, smoother) · session (gap-of-inactivity, per user)</Txt>
                  <Txt x={56} y={286} size={10.5} tone="acc">recomputed windows must not double-count: idempotent sinks or transactional output (Kafka EOS)</Txt>
                </>
              )}
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
