
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Chip, Txt, Badge } from "./viz";

/**
 * Rebalancing: why "hash mod N" backfires when N changes, and how a fixed
 * pool of partitions fixes it by moving whole partitions instead of keys.
 *
 * 12 keys with stable hash values. Top lane: assignment = hash mod N.
 * Bottom lane: 12 fixed partitions (hash mod 12), partitions assigned to nodes.
 */

const HASHES = [3, 7, 12, 17, 21, 25, 28, 31, 33, 41, 47, 50];

const modAssign = (n: number) => HASHES.map((h) => h % n);

// fixed partitions: partition index = hash % 12
const partOf = HASHES.map((h) => h % 12);
// partition -> node, 3 nodes: round-robin p%3; 4 nodes: move p3, p7, p11 to node 3
const partNode3 = (p: number) => p % 3;
const partNode4 = (p: number) => ([3, 7, 11].includes(p) ? 3 : p % 3);

const steps = [
  {
    caption: (
      <>
        Twelve keys, three nodes. Each key has a stable hash (shown on the chip). The
        naive assignment rule: <code>node = hash mod 3</code>. Simple, stateless,
        perfectly balanced… for now.
      </>
    ),
  },
  {
    caption: (
      <>
        Traffic grows, so we add <strong>node 3</strong>. The rule silently becomes{" "}
        <code>hash mod 4</code> — and almost every key&apos;s answer changes, because{" "}
        <code>h mod 3</code> and <code>h mod 4</code> rarely agree.
      </>
    ),
  },
  {
    caption: (
      <>
        Watch the shuffle: <strong>9 of 12 keys move</strong> (red). We wanted to shift
        ~25% of the data to the new node; instead the cluster rewrites ~75% of itself
        over the network while serving traffic. This is the mod-N backfire.
      </>
    ),
  },
  {
    caption: (
      <>
        The fix: decouple <em>keys → partitions</em> from <em>partitions → nodes</em>.
        Create <strong>many fixed partitions</strong> up front (here 12; real systems
        use hundreds or thousands). <code>hash mod 12</code> never changes, because the
        partition count never changes.
      </>
    ),
  },
  {
    caption: (
      <>
        Partitions are assigned to nodes: node 0 holds p0/p3/p6/p9, and so on. A key&apos;s
        partition is permanent; only the partition&apos;s <em>address</em> can change.
      </>
    ),
  },
  {
    caption: (
      <>
        Add node 3 again. This time we move <strong>whole partitions</strong> — one from
        each old node (p3, p7, p11). Keys inside never re-shuffle among themselves; the
        partition travels as a unit.
      </>
    ),
  },
  {
    caption: (
      <>
        Result: exactly <strong>3 of 12 partitions moved (~25%)</strong> — the
        theoretical minimum. Every other key stayed put. Same trick scaled up: Riak,
        Elasticsearch, Couchbase pre-split into fixed partitions; Cassandra-style
        systems use many virtual nodes per machine for the same effect.
      </>
    ),
  },
];

function Lane({
  y0,
  step,
}: {
  y0: number;
  step: number;
}) {
  // Top lane: mod-N world. Visible always; nodes 3 vs 4 depending on step.
  const four = step >= 1;
  const shuffled = step >= 2;
  const n = shuffled ? 4 : 3;
  const before = modAssign(3);
  const after = modAssign(4);
  const nodeW = four ? 158 : 214;
  const gap = 12;
  const x0 = 26;

  const slot: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const moved = HASHES.map((_, i) => before[i] !== after[i]);
  const movedCount = moved.filter(Boolean).length;

  return (
    <g>
      <Txt x={x0} y={y0 - 8} size={12} weight={700} tone="ink">
        A · node = hash mod N
      </Txt>
      {[0, 1, 2, 3].map((nd) => {
        const show = nd < 3 || four;
        return (
          <g key={nd} className="tr" opacity={show ? 1 : 0}>
            <NodeBox
              x={x0 + nd * (nodeW + gap)}
              y={y0}
              w={nodeW}
              h={92}
              label={`node ${nd}`}
              tone={nd === 3 && four ? "acc" : "default"}
            />
          </g>
        );
      })}
      {HASHES.map((h, i) => {
        const nd = shuffled ? after[i] : before[i];
        const idx = slot[nd]++;
        const perRow = four ? 3 : 4;
        const cx = x0 + nd * (nodeW + gap) + 26 + (idx % perRow) * 50;
        const cy = y0 + 36 + Math.floor(idx / perRow) * 26;
        const didMove = shuffled && moved[i];
        return (
          <Chip
            key={h}
            cx={cx}
            cy={cy}
            label={String(h)}
            w={42}
            h={20}
            tone={didMove ? "bad" : "default"}
            filled={didMove}
          />
        );
      })}
      <g className="tr" opacity={shuffled ? 1 : 0}>
        <Badge x={620} y={y0 - 14} label={`${movedCount}/12 keys moved`} tone="bad" />
      </g>
    </g>
  );
}

function FixedLane({ y0, step }: { y0: number; step: number }) {
  const show = step >= 3;
  const assigned = step >= 4;
  const four = step >= 5;
  const pw = 50;
  const gap = 6;
  const x0 = 26;

  // partition x positions when laid in a strip (step 3) vs grouped under nodes (4+)
  const nodeOf = (p: number) => (four ? partNode4(p) : partNode3(p));
  const movedParts = [3, 7, 11];

  // group layout: nodes occupy 4 columns
  const nodeW = four ? 158 : 214;
  const ngap = 12;

  return (
    <g className="tr" opacity={show ? 1 : 0}>
      <Txt x={x0} y={y0 - 8} size={12} weight={700} tone="ink">
        B · fixed partitions: key → partition (mod 12) → node
      </Txt>

      {/* node boxes appear when assigned */}
      {[0, 1, 2, 3].map((nd) => {
        const vis = assigned && (nd < 3 || four);
        return (
          <g key={nd} className="tr" opacity={vis ? 1 : 0}>
            <NodeBox
              x={x0 + nd * (nodeW + ngap)}
              y={y0 + 4}
              w={nodeW}
              h={96}
              label={`node ${nd}`}
              tone={nd === 3 && four ? "acc" : "default"}
            />
          </g>
        );
      })}

      {/* 12 partitions */}
      {Array.from({ length: 12 }, (_, p) => {
        let cx: number;
        let cy: number;
        if (!assigned) {
          cx = x0 + 28 + p * (pw + gap);
          cy = y0 + 50;
        } else {
          const nd = nodeOf(p);
          const within = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            .filter((q) => nodeOf(q) === nd)
            .indexOf(p);
          cx = x0 + nd * (nodeW + ngap) + 30 + within * (four ? 48 : 52);
          cy = y0 + 56;
        }
        const movedNow = four && movedParts.includes(p);
        return (
          <g key={p}>
            <Chip
              cx={cx}
              cy={cy}
              label={`p${p}`}
              w={44}
              h={24}
              tone={movedNow ? "ok" : "info"}
              filled={movedNow}
            />
            {/* sample keys living inside a few partitions, shown pre-assignment */}
            {!assigned && partOf.includes(p) ? (
              <Txt x={cx} y={cy + 24} size={8.5} anchor="middle" mono show={!assigned}>
                {HASHES.filter((h) => h % 12 === p).join(",")}
              </Txt>
            ) : null}
          </g>
        );
      })}

      <g className="tr" opacity={four ? 1 : 0}>
        <Badge x={620} y={y0 - 14} label="3/12 partitions moved" tone="ok" />
      </g>
      <g className="tr" opacity={step >= 6 ? 1 : 0}>
        <Txt x={x0} y={y0 + 124} size={11} tone="ok" weight={600}>
          Keys never re-hash. Only partition → node addresses change — the minimum possible data movement.
        </Txt>
      </g>
    </g>
  );
}

export default function RebalancingLab() {
  return (
    <AnimationShell
      title="Rebalancing: why hash mod N backfires"
      subtitle="adding a 4th node, two ways"
      steps={steps}
    >
      {(step) => (
        <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="Diagram comparing mod-N rebalancing with fixed partitions">
          <VizDefs />
          <Lane y0={34} step={step} />
          <FixedLane y0={176} step={step} />
        </svg>
      )}
    </AnimationShell>
  );
}
