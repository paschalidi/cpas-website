import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Materialized state vs operator pipelines: a 3-stage workflow as chained
 * MapReduce jobs (HDFS between every stage) vs a dataflow DAG (Spark-style),
 * including how each recovers from a dead worker.
 */

const steps = [
  {
    caption: (
      <>
        A real pipeline is rarely one job: <em>parse logs → join with users →
        aggregate per country</em>. The question that splits the generations of
        batch engines: what happens <strong>between</strong> the stages?
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>MapReduce&apos;s answer: a file.</strong> Job 1 runs and writes
        its full output to the distributed FS — replicated, 3 copies. Simple,
        durable, and inspectable (you can rerun job 2 alone tomorrow).
      </>
    ),
  },
  {
    caption: (
      <>
        Job 2 can&apos;t start until job 1 <em>entirely</em> finishes — one
        straggler task in job 1 stalls the whole next stage. Then job 2 reads the
        temp data back off disk, computes, and writes another replicated temp
        file. Disk-write, replicate, disk-read… for data that exists only to be
        consumed once, seconds later.
      </>
    ),
  },
  {
    caption: (
      <>
        Tally for the chain: 2 intermediate datasets × full materialization ×
        3-way replication, plus per-job startup overhead, plus no overlap between
        stages. For 50-job workflows (a normal recommendation pipeline circa
        2012), this is where all the time went.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Dataflow&apos;s answer (Spark, Tez, Flink): one DAG.</strong>{" "}
        Express the whole pipeline as operators; the engine sees all three stages
        at once and plans globally — no artificial job boundaries.
      </>
    ),
  },
  {
    caption: (
      <>
        Where an operator&apos;s output partitions feed the next operator
        one-to-one (<em>narrow</em> dependency: parse → filter),{" "}
        <strong>records stream through in memory</strong> — pipelined, no disk,
        next operator starts immediately. Where the next operator needs
        regrouping by key (<em>wide</em> dependency: the join, the aggregate), a
        shuffle still happens — sorting and repartitioning are fundamental, not a
        MapReduce quirk.
      </>
    ),
  },
  {
    caption: (
      <>
        But if intermediate data lives in RAM, what about crashes? MapReduce
        could just reread the file. Dataflow keeps a <strong>lineage</strong>: each
        partition records the deterministic recipe that produced it. Worker dies
        → recompute <em>only its lost partitions</em> from the last available
        ancestor (checkpointing the occasional expensive shuffle bounds the
        recompute depth). Cheap normal case, surgical failure case.
      </>
    ),
  },
  {
    caption: (
      <>
        Scorecard: dataflow wins on latency (pipelining), I/O (no forced
        materialization), and scheduling (global DAG view) — which is why
        iterative algorithms (ML, PageRank) moved first; rereading HDFS every
        iteration was agony. Materialization keeps one honest virtue:
        durable, inspectable stage boundaries — which is exactly what you{" "}
        <em>choose</em> to keep at workflow seams, as checkpoints and published
        datasets.
      </>
    ),
  },
];

function Disk({ x, y, show, label }: { x: number; y: number; show: boolean; label: string }) {
  return (
    <g className="tr" opacity={show ? 1 : 0}>
      <ellipse cx={x} cy={y - 12} rx={26} ry={7} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
      <path d={`M ${x - 26} ${y - 12} v 22 a 26 7 0 0 0 52 0 v -22`} fill="var(--bg)" stroke="var(--warn)" strokeWidth={1.3} />
      <Txt x={x} y={y + 28} size={8.5} mono anchor="middle" tone="warn">
        {label}
      </Txt>
    </g>
  );
}

export default function PipelineVsMaterialize() {
  return (
    <AnimationShell
      title="Materialized state vs operator pipelines"
      subtitle="what lives between the stages?"
      steps={steps}
      interval={3200}
    >
      {(step) => {
        const mrPhase = step >= 1 && step <= 3;
        const dfPhase = step >= 4;
        const crash = step === 6;

        return (
          <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="Materialization vs pipelining diagram">
            <VizDefs />

            {/* ---------- top: MapReduce chain ---------- */}
            <g className="tr" opacity={dfPhase && !crash ? 0.3 : 1}>
              <Txt x={18} y={26} size={12} weight={700} tone="ink">
                A · chained MapReduce jobs
              </Txt>

              <NodeBox x={18} y={44} w={108} h={48} label="job 1" sub="parse" tone={step >= 1 ? "acc" : "default"} />
              <Disk x={196} y={70} show={step >= 1} label="HDFS temp ×3" />
              <NodeBox x={266} y={44} w={108} h={48} label="job 2" sub={step === 2 ? "waits… then joins" : "join"} tone={step >= 2 ? "acc" : "mut"} />
              <Disk x={444} y={70} show={step >= 2} label="HDFS temp ×3" />
              <NodeBox x={514} y={44} w={108} h={48} label="job 3" sub="aggregate" tone={step >= 3 ? "acc" : "mut"} />

              <Arrow x1={126} y1={68} x2={166} y2={68} tone="warn" show={step >= 1} label="write" />
              <Arrow x1={226} y1={68} x2={262} y2={68} tone="warn" show={step >= 2} label="read" />
              <Arrow x1={374} y1={68} x2={414} y2={68} tone="warn" show={step >= 2} label="write" />
              <Arrow x1={474} y1={68} x2={510} y2={68} tone="warn" show={step >= 3} label="read" />

              <g className="tr" opacity={step === 3 ? 1 : 0}>
                <Txt x={18} y={122} size={10.5} tone="warn" weight={600}>
                  cost: full materialize + replicate ×2 stages · no overlap · per-job startup
                </Txt>
              </g>
            </g>

            {/* ---------- bottom: dataflow DAG ---------- */}
            <g className="tr" opacity={dfPhase ? 1 : 0.3}>
              <Txt x={18} y={160} size={12} weight={700} tone="ink">
                B · one dataflow DAG (Spark-style)
              </Txt>

              <NodeBox x={18} y={180} w={96} h={46} label="parse" sub="op" tone={dfPhase ? "info" : "default"} />
              <NodeBox x={150} y={180} w={96} h={46} label="filter" sub="op" tone={dfPhase ? "info" : "default"} />
              <NodeBox x={306} y={180} w={96} h={46} label="join" sub="wide dep" tone={dfPhase ? "acc" : "default"} />
              <NodeBox x={462} y={180} w={110} h={46} label="aggregate" sub="wide dep" tone={dfPhase ? "acc" : "default"} />
              <NodeBox x={608} y={180} w={96} h={46} label="output" sub="DFS ✓" tone={step >= 7 ? "ok" : "mut"} />

              {/* narrow: pipelined in memory */}
              <Arrow x1={114} y1={203} x2={146} y2={203} tone="ok" show={dfPhase} label={step >= 5 ? "RAM" : undefined} />
              {/* wide: shuffle boundaries */}
              <Arrow x1={246} y1={203} x2={302} y2={203} tone="warn" show={dfPhase} dashed label={step >= 5 ? "shuffle" : undefined} />
              <Arrow x1={402} y1={203} x2={458} y2={203} tone="warn" show={dfPhase} dashed label={step >= 5 ? "shuffle" : undefined} />
              <Arrow x1={572} y1={203} x2={604} y2={203} tone="ok" show={dfPhase} />

              <Txt x={18} y={250} size={10.5} tone="ok" show={step === 5}>
                narrow deps stream record-by-record — stage 2 starts before stage 1 ends
              </Txt>

              {/* crash + lineage */}
              <g className="tr" opacity={crash ? 1 : 0}>
                <Txt x={198} y={172} size={18} weight={800} tone="bad" anchor="middle">
                  ✕
                </Txt>
                <rect x={18} y={258} width={560} height={50} rx={10} fill="var(--bg)" stroke="var(--info)" strokeWidth={1.4} />
                <Txt x={34} y={278} size={10} mono weight={700} tone="info">
                  LINEAGE
                </Txt>
                <Txt x={34} y={296} size={10.5}>
                  filter.p3 = filter(parse.p3) ← recompute ONLY lost partitions from the recipe
                </Txt>
              </g>

              <g className="tr" opacity={step === 7 ? 1 : 0}>
                <Badge x={320} y={282} label="pipeline by default; materialize by choice (checkpoints, published datasets)" tone="ok" />
              </g>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
