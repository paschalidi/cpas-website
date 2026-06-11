import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Lambda vs kappa: when derived views need recomputing (bug fix, logic v2),
 * do you run two systems forever, or one log you can replay?
 */

const steps = [
  {
    caption: (
      <>
        Derived views go stale in a way no uptime fixes: the <em>logic</em>{" "}
        changes. A bug in the counting code, a new definition of &ldquo;active
        user&rdquo;, a feature needing history recomputed. The design question
        of this animation: how does an architecture <strong>recompute the
        past</strong> while staying current with the present?
      </>
    ),
  },
  {
    caption: (
      <>
        Answer 1 — <strong>lambda architecture</strong>: run both modes,
        permanently. A <em>batch layer</em> periodically reprocesses the entire
        immutable raw dataset — slow, thorough, self-correcting. A{" "}
        <em>speed layer</em> stream-processes recent events for low latency —
        fast, possibly approximate, discarded once batch catches up.
      </>
    ),
  },
  {
    caption: (
      <>
        Queries <strong>merge</strong> the two: batch view for everything up to
        the last run, speed view for the tail since. Correctness comes from the
        nightly recompute; freshness from the stream. On paper, the best of
        both.
      </>
    ),
  },
  {
    caption: (
      <>
        The bill arrives in engineering hours: the <em>same business logic
        implemented twice</em>, in two frameworks, by two pipelines that must
        agree — and subtly don&apos;t (different time handling, different
        late-data behavior). Every change ships twice; every discrepancy is a
        debugging séance across systems. The merge layer adds its own bugs.
      </>
    ),
  },
  {
    caption: (
      <>
        Answer 2 — <strong>kappa</strong>: one system. Keep the raw events in a
        log with long (or tiered/infinite) retention. Processing logic v1 runs
        continuously, maintaining view v1. No second codebase — because
        reprocessing will reuse the <em>same</em> path…
      </>
    ),
  },
  {
    caption: (
      <>
        Need logic v2? Start a <strong>second instance of the job from offset
        0</strong>. It chews through history at disk speed, building view v2 in
        parallel — while v1 keeps serving production untouched. Reprocessing
        isn&apos;t a separate architecture; it&apos;s the same architecture,
        pointed at the past.
      </>
    ),
  },
  {
    caption: (
      <>
        When v2&apos;s offset catches the head: <strong>switch reads
        atomically</strong> to view v2, watch it, retire v1 (and keep it briefly
        for instant rollback). Schema migrations, bug fixes, and &ldquo;what
        if we&apos;d always counted it this way?&rdquo; all become: replay,
        compare, switch.
      </>
    ),
  },
  {
    caption: (
      <>
        The fair scorecard: lambda was the right answer when stream processors
        were approximate; once logs became replayable and streaming gained
        exactly-once state (chapter 11), the dual-codebase tax stopped buying
        correctness. Kappa&apos;s real requirements — long log retention, dev/ops
        maturity to run parallel jobs, sinks that support view-switching — are
        real but cheaper. The durable principle beneath both:{" "}
        <em>immutable raw input + rebuildable views = the freedom to be wrong
        and recover</em>.
      </>
    ),
  },
];

export default function LambdaVsKappa() {
  return (
    <AnimationShell
      title="Lambda vs kappa: two ways to recompute"
      subtitle="logic changes; history must be re-derivable"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const lambda = step >= 1 && step <= 3;
        const kappa = step >= 4;
        const v2 = step >= 5;
        const switched = step >= 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Lambda vs kappa diagram">
            <VizDefs />

            {step === 0 && (
              <g>
                <NodeBox x={60} y={110} w={180} h={56} label="raw events" sub="immutable history" tone="acc" />
                <NodeBox x={460} y={110} w={200} h={56} label="derived view" sub="pageviews per article" tone="default" />
                <Arrow x1={240} y1={138} x2={456} y2={138} tone="acc" show label="logic v1" />
                <Badge x={360} y={226} label="logic v2 ships — who recomputes 3 years of history, and how?" tone="warn" />
              </g>
            )}

            {lambda && (
              <g>
                <Txt x={16} y={28} size={11} mono weight={700} tone="acc">LAMBDA · run both modes forever</Txt>
                <NodeBox x={16} y={110} w={150} h={56} label="raw events" sub="immutable store" tone="acc" />

                <NodeBox x={250} y={48} w={190} h={52} label="batch layer" sub="nightly: recompute ALL" tone="info" />
                <NodeBox x={250} y={180} w={190} h={52} label="speed layer" sub="stream: recent tail" tone="warn" />
                <Arrow x1={166} y1={126} x2={246} y2={76} tone="info" show label="full history" />
                <Arrow x1={166} y1={150} x2={246} y2={204} tone="warn" show label="new events" />

                <NodeBox x={520} y={48} w={150} h={52} label="batch view" sub="correct, stale" tone="info" />
                <NodeBox x={520} y={180} w={150} h={52} label="speed view" sub="fresh, approx" tone="warn" />
                <Arrow x1={440} y1={74} x2={516} y2={74} tone="info" show />
                <Arrow x1={440} y1={206} x2={516} y2={206} tone="warn" show />

                <g className="tr" opacity={step >= 2 ? 1 : 0}>
                  <NodeBox x={560} y={118} w={140} h={44} label="query" sub="merge both" tone="ok" />
                  <Arrow x1={596} y1={100} x2={616} y2={114} tone="ok" show />
                  <Arrow x1={596} y1={180} x2={616} y2={162} tone="ok" show />
                </g>

                <g className="tr" opacity={step === 3 ? 1 : 0}>
                  <rect x={16} y={246} width={688} height={52} rx={10} fill="var(--bg)" stroke="var(--bad)" strokeWidth={1.3} />
                  <Txt x={32} y={266} size={10.5} tone="bad" weight={600}>
                    the tax: same logic, two frameworks, two deploys — agreeing only approximately
                  </Txt>
                  <Txt x={32} y={284} size={10.5}>
                    drift between paths + merge-layer bugs = debugging across two systems at once
                  </Txt>
                </g>
              </g>
            )}

            {kappa && (
              <g>
                <Txt x={16} y={28} size={11} mono weight={700} tone="acc">KAPPA · one log, replayed</Txt>

                <rect x={16} y={56} width={420} height={42} rx={8} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.5} />
                <Txt x={30} y={72} size={9} mono weight={700} tone="acc">LOG — long retention</Txt>
                <Txt x={30} y={88} size={10} mono>[e1][e2][e3] … [e9,412,003] → head</Txt>

                <NodeBox x={520} y={48} w={184} h={52} label="job v1 (live)" sub={switched ? "retired (kept for rollback)" : "at head · serving view v1"} tone={switched ? "mut" : "ok"} dim={switched} />
                <Arrow x1={436} y1={77} x2={516} y2={74} tone={switched ? "mut" : "ok"} show />

                <g className="tr" opacity={v2 ? 1 : 0}>
                  <NodeBox x={520} y={140} w={184} h={52} label="job v2 (new logic)" sub={switched ? "caught up · serving ✓" : "replaying from offset 0…"} tone={switched ? "ok" : "info"} />
                  <Arrow x1={60} y1={98} x2={516} y2={166} tone="info" show curve={40} label={switched ? "" : "history at disk speed"} />
                </g>

                <g className="tr" opacity={switched ? 1 : 0}>
                  <NodeBox x={300} y={216} w={160} h={48} label="readers" sub="switched atomically" tone="ok" />
                  <Arrow x1={460} y1={232} x2={560} y2={196} tone="ok" show label="now → v2" />
                </g>

                <g className="tr" opacity={step === 4 ? 1 : 0}>
                  <Badge x={250} y={150} label="one codebase: the production path IS the reprocessing path" tone="ok" />
                </g>
                <g className="tr" opacity={step === 7 ? 1 : 0}>
                  <rect x={16} y={246} width={688} height={52} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
                  <Txt x={32} y={266} size={10.5}>
                    kappa&apos;s real costs: long log retention · parallel-job ops · switchable sinks — cheaper than two codebases
                  </Txt>
                  <Txt x={32} y={284} size={10.5} tone="acc" weight={600}>
                    the invariant either way: immutable raw input + rebuildable views = freedom to be wrong and recover
                  </Txt>
                </g>
              </g>
            )}
          </svg>
        );
      }}
    </AnimationShell>
  );
}
