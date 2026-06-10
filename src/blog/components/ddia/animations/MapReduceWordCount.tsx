
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * MapReduce word count, end to end: splits → map → partition → sort/spill →
 * shuffle copy → merge → reduce → output. Chips physically migrate from
 * mapper columns to reducer columns.
 */

const steps = [
  {
    caption: (
      <>
        Job: count words across a mountain of files. The input lives in a
        distributed filesystem (HDFS-style), already chopped into{" "}
        <strong>splits</strong> on different machines. You write two pure
        functions — <code>map</code> and <code>reduce</code> — and the framework
        owns distribution, retries, and the grouping in between.
      </>
    ),
  },
  {
    caption: (
      <>
        The scheduler assigns each split to a mapper <em>on or near the machine
        already storing it</em> — moving computation to data, because code is
        kilobytes and data is terabytes. Two splits here: A = &ldquo;go big or go
        home&rdquo;, B = &ldquo;go home&rdquo;.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Map.</strong> Each mapper calls <code>map(record)</code> per line
        and emits key–value pairs: every word becomes <code>(word, 1)</code>.
        Stateless, parallel, embarrassingly so.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Partition.</strong> Same word, different mappers — the counts must
        meet. Each pair is assigned a reducer by <code>hash(key) mod R</code>{" "}
        (R = 2 here): amber → reducer 0, blue → reducer 1. Deterministic, so{" "}
        <em>every</em> &ldquo;go&rdquo; lands on the same reducer, whoever emitted
        it. Chapter 6&apos;s hash partitioning, reborn.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Sort &amp; spill.</strong> Each mapper sorts its output by key
        within each partition and writes sorted runs to its <em>local disk</em> —
        materialized. If this mapper later dies, its finished output survives; if
        a reducer dies, mappers don&apos;t re-run.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Shuffle.</strong> Each reducer pulls its partition from{" "}
        <em>every</em> mapper — the framework&apos;s only all-to-all network step,
        and usually the expensive one. Watch the pairs migrate to their assigned
        reducer.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Merge.</strong> A reducer now holds one sorted run per mapper; a
        k-way merge interleaves them into a single sorted stream — see reducer
        1&apos;s <code>home, or, home</code> become <code>home, home, or</code>.
        Sorting means equal keys are now <em>adjacent</em>: grouping costs
        nothing.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Reduce.</strong> The framework calls{" "}
        <code>reduce(key, iterator-of-values)</code> once per key:{" "}
        <code>go → 3</code>, <code>big → 1</code>, <code>home → 2</code>,{" "}
        <code>or → 1</code>. Each reducer writes its own output file to the
        distributed FS — outputs stay partitioned.
      </>
    ),
  },
  {
    caption: (
      <>
        The whole trick in one line: <em>map = extract &amp; tag, shuffle =
        group-by in the network, reduce = aggregate per group</em>. Optimization
        you should name in interviews: a <strong>combiner</strong> pre-sums on the
        mapper (A would ship <code>(go, 2)</code> instead of two pairs), cutting
        shuffle traffic — legal because addition is associative &amp; commutative.
      </>
    ),
  },
];

interface ChipDef {
  id: string;
  word: string;
  dest: 0 | 1;
}
const CHIPS: ChipDef[] = [
  { id: "a-go1", word: "go", dest: 0 },
  { id: "a-big", word: "big", dest: 0 },
  { id: "a-or", word: "or", dest: 1 },
  { id: "a-go2", word: "go", dest: 0 },
  { id: "a-home", word: "home", dest: 1 },
  { id: "b-go", word: "go", dest: 0 },
  { id: "b-home", word: "home", dest: 1 },
];

// ordered id lists per location/phase
const EMIT_A = ["a-go1", "a-big", "a-or", "a-go2", "a-home"];
const EMIT_B = ["b-go", "b-home"];
const SORT_A = ["a-big", "a-go1", "a-go2", "a-or", "a-home"]; // dest0 sorted, then dest1 sorted
const SORT_B = ["b-go", "b-home"];
const R0_COPIED = ["a-big", "a-go1", "a-go2", "b-go"]; // runs concatenated (A then B)
const R1_COPIED = ["a-home", "a-or", "b-home"];
const R1_MERGED = ["a-home", "b-home", "a-or"];

const MAP_COL_X = 330;
const RED_COL_X = 478;
const A_BASE = 42;
const B_BASE = 196;
const ROW = 23;

function positions(step: number): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>();
  const place = (ids: string[], x: number, base: number, gapAfterDest0 = false) => {
    let y = base;
    let prevDest: 0 | 1 | null = null;
    ids.forEach((id) => {
      const dest = CHIPS.find((c) => c.id === id)!.dest;
      if (gapAfterDest0 && prevDest === 0 && dest === 1) y += 9;
      m.set(id, { x, y });
      y += ROW;
      prevDest = dest;
    });
  };

  if (step <= 3) {
    place(EMIT_A, MAP_COL_X, A_BASE);
    place(EMIT_B, MAP_COL_X, B_BASE);
  } else if (step === 4) {
    place(SORT_A, MAP_COL_X, A_BASE, true);
    place(SORT_B, MAP_COL_X, B_BASE, true);
  } else if (step === 5) {
    place(R0_COPIED, RED_COL_X, A_BASE);
    place(R1_COPIED, RED_COL_X, B_BASE);
  } else {
    place(R0_COPIED, RED_COL_X, A_BASE);
    place(R1_MERGED, RED_COL_X, B_BASE);
  }
  return m;
}

function KvChip({ x, y, word, dest, colored, faded }: { x: number; y: number; word: string; dest: 0 | 1; colored: boolean; faded: boolean }) {
  const stroke = colored ? (dest === 0 ? "var(--accent)" : "var(--info)") : "var(--line-strong)";
  return (
    <g transform={`translate(${x}, ${y})`} className="tr" opacity={faded ? 0.18 : 1} style={{ transitionProperty: "transform, opacity" }}>
      <rect width={62} height={19} rx={9.5} fill="var(--bg)" stroke={stroke} strokeWidth={1.3} className="tr" />
      <text
        x={31}
        y={9.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="var(--ink)"
      >
        {word},1
      </text>
    </g>
  );
}

export default function MapReduceWordCount() {
  return (
    <AnimationShell
      title="MapReduce word count, end to end"
      subtitle="map · partition · sort · shuffle · merge · reduce"
      steps={steps}
      interval={3200}
    >
      {(step) => {
        const pos = positions(step);
        const colored = step >= 3;
        const reduced = step >= 7;

        return (
          <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="MapReduce word count pipeline">
            <VizDefs />

            {/* phase ribbon */}
            {["MAP", "SHUFFLE", "REDUCE"].map((p, i) => {
              const active = (i === 0 && step >= 1 && step <= 4) || (i === 1 && (step === 5 || step === 6)) || (i === 2 && step >= 7);
              return (
                <Txt key={p} x={330 + i * 120} y={20} size={10} mono weight={700} tone={active ? "acc" : "mut"}>
                  {p}
                </Txt>
              );
            })}

            {/* inputs */}
            <NodeBox x={14} y={56} w={118} h={56} label="split A" sub="“go big or go home”" tone={step >= 1 ? "default" : "mut"} />
            <NodeBox x={14} y={210} w={118} h={56} label="split B" sub="“go home”" tone={step >= 1 ? "default" : "mut"} />

            {/* mappers */}
            <NodeBox x={176} y={56} w={108} h={56} label="mapper 1" sub={step >= 4 ? "spilled, sorted" : step >= 2 ? "map()" : "idle"} tone={step >= 2 && step <= 4 ? "acc" : "default"} />
            <NodeBox x={176} y={210} w={108} h={56} label="mapper 2" sub={step >= 4 ? "spilled, sorted" : step >= 2 ? "map()" : "idle"} tone={step >= 2 && step <= 4 ? "acc" : "default"} />
            <Arrow x1={132} y1={84} x2={172} y2={84} tone="mut" show={step >= 1} />
            <Arrow x1={132} y1={238} x2={172} y2={238} tone="mut" show={step >= 1} />

            {/* local disk note */}
            <g className="tr" opacity={step === 4 ? 1 : 0}>
              <Badge x={230} y={150} label="sorted runs → local disk" tone="warn" />
            </g>

            {/* kv chips */}
            {CHIPS.map((c) => {
              const p = pos.get(c.id);
              if (!p || step < 2) return null;
              return <KvChip key={c.id} x={p.x} y={p.y} word={c.word} dest={c.dest} colored={colored} faded={reduced} />;
            })}

            {/* shuffle arrows */}
            <Arrow x1={398} y1={88} x2={470} y2={88} tone="acc" show={step === 5} label="pull" />
            <Arrow x1={398} y1={120} x2={470} y2={210} tone="info" show={step === 5} dashed />
            <Arrow x1={398} y1={242} x2={470} y2={110} tone="acc" show={step === 5} dashed />
            <Arrow x1={398} y1={242} x2={470} y2={242} tone="info" show={step === 5} label="pull" labelDy={14} />

            {/* reducers */}
            <NodeBox x={556} y={56} w={106} h={56} label="reducer 0" sub={reduced ? "summed ✓" : step === 6 ? "merging…" : step === 5 ? "copying…" : "waiting"} tone={reduced ? "ok" : step >= 5 ? "acc" : "mut"} />
            <NodeBox x={556} y={210} w={106} h={56} label="reducer 1" sub={reduced ? "summed ✓" : step === 6 ? "k-way merge" : step === 5 ? "copying…" : "waiting"} tone={reduced ? "ok" : step >= 5 ? "info" : "mut"} />

            {/* outputs */}
            <g className="tr" opacity={reduced ? 1 : 0}>
              <rect x={556} y={118} width={150} height={44} rx={8} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.4} />
              <Txt x={568} y={134} size={9} mono weight={700} tone="ok">
                part-00000 (DFS)
              </Txt>
              <Txt x={568} y={151} size={10} mono>
                go 3 · big 1
              </Txt>
              <rect x={556} y={272} width={150} height={42} rx={8} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.4} />
              <Txt x={568} y={288} size={9} mono weight={700} tone="ok">
                part-00001 (DFS)
              </Txt>
              <Txt x={568} y={304} size={10} mono>
                home 2 · or 1
              </Txt>
            </g>

            {/* combiner note */}
            <g className="tr" opacity={step === 8 ? 1 : 0}>
              <Badge x={230} y={150} label="combiner: ship (go,2) instead" tone="ok" />
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
