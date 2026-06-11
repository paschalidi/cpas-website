import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Chip, Arrow, Txt, Badge } from "./viz";

/**
 * Key-range vs hash partitioning of the same six usernames, side by side.
 * Shows why range partitioning keeps scans cheap but invites hot spots,
 * while hashing spreads load but scatters scans.
 */

const KEYS = ["ada", "alan", "amy", "barb", "grace", "zoe"] as const;

// hash(key) % 3 — fixed, hand-picked to look spread out
const HASH_PART: Record<string, number> = {
  ada: 1,
  alan: 2,
  amy: 0,
  barb: 2,
  grace: 0,
  zoe: 1,
};
// range partitioning: a–f → p0, g–m → p1, n–z → p2
const RANGE_PART: Record<string, number> = {
  ada: 0,
  alan: 0,
  amy: 0,
  barb: 0,
  grace: 1,
  zoe: 2,
};

const steps = [
  {
    caption: (
      <>
        The same six usernames need a home across three partitions. A{" "}
        <strong>partition</strong> is just a chunk of the keyspace that one node owns.
        Two classic ways to assign keys: by <strong>range</strong> (left) or by{" "}
        <strong>hash</strong> (right).
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Range partitioning:</strong> sort the keys, then cut the sorted order
        into contiguous slices — like encyclopedia volumes (A–F, G–M, N–Z). Each key
        lands in the slice that covers it.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Hash partitioning:</strong> run each key through a hash function and
        use the result to pick a partition. The hash scrambles any ordering, so keys
        spray roughly evenly — even when the raw keys cluster.
      </>
    ),
  },
  {
    caption: (
      <>
        Query: <code>usernames BETWEEN &quot;a*&quot;</code>. Under range partitioning
        the four a-names sit <em>next to each other</em> on one partition — a single
        sequential scan answers it. This is the superpower of range partitioning.
      </>
    ),
  },
  {
    caption: (
      <>
        The same range query under hashing must visit <strong>every</strong> partition
        and merge results, because hashing destroyed adjacency. Range scans go from one
        cheap read to a scatter–gather across the cluster.
      </>
    ),
  },
  {
    caption: (
      <>
        Now the dark side of ranges: a signup wave of a-names (a bot farm, an
        alphabetical import) hammers partition 0 alone. Sorted data means correlated
        keys — and correlated keys mean <strong>hot spots</strong>.
      </>
    ),
  },
  {
    caption: (
      <>
        The same skewed burst under hashing spreads across all three partitions —
        each new a-name hashes somewhere different. Hashing trades cheap range scans
        for built-in load spreading.
      </>
    ),
  },
  {
    caption: (
      <>
        The rule of thumb: <strong>range</strong> when you need ordered scans (time
        series, leaderboards) and will manage hot spots yourself;{" "}
        <strong>hash</strong> when access is by exact key and even load matters more.
        Cassandra&apos;s compound key gets both: hash the first column, sort by the rest.
      </>
    ),
  },
];

function Side({
  x0,
  title,
  part,
  step,
  isRange,
}: {
  x0: number;
  title: string;
  part: Record<string, number>;
  step: number;
  isRange: boolean;
}) {
  const pw = 96;
  const gap = 14;
  const py = 118;
  const ph = 128;

  // chips: before assignment they sit in a pool at the top; after, inside partitions
  const assigned = isRange ? step >= 1 : step >= 2;
  const scan = isRange ? step === 3 : step === 4; // range-scan highlight
  const burst = isRange ? step === 5 : step === 6; // hot a-name burst

  const slot: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

  return (
    <g>
      <Txt x={x0 + (pw * 3 + gap * 2) / 2} y={24} anchor="middle" size={13} weight={700} tone="ink">
        {title}
      </Txt>
      <Txt x={x0 + (pw * 3 + gap * 2) / 2} y={42} anchor="middle" size={10}>
        {isRange ? "sorted keyspace, contiguous slices" : "hash(key) picks the partition"}
      </Txt>

      {/* partitions */}
      {[0, 1, 2].map((p) => {
        const px = x0 + p * (pw + gap);
        const hot = burst && ((isRange && p === 0) || !isRange);
        const scanHit = scan && (isRange ? p === 0 : true);
        return (
          <g key={p}>
            <NodeBox
              x={px}
              y={py}
              w={pw}
              h={ph}
              label={`p${p}`}
              sub={isRange ? ["a – f", "g – m", "n – z"][p] : `hash % 3 = ${p}`}
              tone={hot ? "bad" : scanHit ? "acc" : "default"}
              fillTone={hot ? "bad" : scanHit ? "acc" : undefined}
            />
          </g>
        );
      })}

      {/* key chips */}
      {KEYS.map((k, i) => {
        const p = part[k];
        const idx = assigned ? slot[p]++ : 0;
        const poolX = x0 + 22 + i * ((pw * 3 + gap * 2 - 44) / (KEYS.length - 1));
        const poolY = 72;
        const cx = assigned ? x0 + p * (pw + gap) + pw / 2 : poolX;
        const cy = assigned ? py + 58 + idx * 24 : poolY;
        const isA = k.startsWith("a");
        return (
          <Chip
            key={k}
            cx={cx}
            cy={cy}
            label={k}
            w={56}
            tone={scan && isA ? "acc" : "default"}
            filled={scan && isA}
            dim={scan && !isA}
          />
        );
      })}

      {/* scan annotation */}
      {isRange ? (
        <g className="tr" opacity={scan ? 1 : 0}>
          <rect
            x={x0 - 6}
            y={py - 10}
            width={pw + 12}
            height={ph + 20}
            rx={12}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          <Txt x={x0 + pw / 2} y={py + ph + 26} anchor="middle" tone="acc" weight={700} size={10.5}>
            one partition, one scan ✓
          </Txt>
        </g>
      ) : (
        <g className="tr" opacity={scan ? 1 : 0}>
          {[0, 1, 2].map((p) => (
            <Arrow
              key={p}
              x1={x0 + (pw * 3 + gap * 2) / 2}
              y1={py + ph + 38}
              x2={x0 + p * (pw + gap) + pw / 2}
              y2={py + ph + 8}
              tone="warn"
              show={scan}
            />
          ))}
          <Txt
            x={x0 + (pw * 3 + gap * 2) / 2}
            y={py + ph + 52}
            anchor="middle"
            tone="warn"
            weight={700}
            size={10.5}
          >
            scatter–gather: ask all 3, merge ✗
          </Txt>
        </g>
      )}

      {/* hot burst arrows */}
      {burst
        ? [0, 1, 2].map((i) => {
            const target = isRange ? 0 : i; // range: all hit p0; hash: spread
            const tx = x0 + target * (pw + gap) + pw / 2 + (isRange ? (i - 1) * 16 : 0);
            return (
              <Arrow
                key={i}
                x1={x0 + (pw * 3 + gap * 2) / 2 + (i - 1) * 60}
                y1={62}
                x2={tx}
                y2={py - 6}
                tone={isRange ? "bad" : "ok"}
                show
                label={i === 1 ? "new “a…” signups" : undefined}
              />
            );
          })
        : null}
      {burst ? (
        <Badge
          x={x0 + (isRange ? pw / 2 : (pw * 3 + gap * 2) / 2)}
          y={py + ph + 30}
          label={isRange ? "HOT SPOT" : "load spread ✓"}
          tone={isRange ? "bad" : "ok"}
        />
      ) : null}
    </g>
  );
}

export default function KeyRangeVsHash() {
  return (
    <AnimationShell
      title="Key-range vs hash partitioning"
      subtitle="same six keys, two assignment strategies"
      steps={steps}
    >
      {(step) => (
        <svg viewBox="0 0 720 330" className="h-auto w-full" role="img" aria-label="Diagram comparing range and hash partitioning">
          <VizDefs />
          <Side x0={28} title="Range partitioning" part={RANGE_PART} step={step} isRange />
          <line x1={360} y1={16} x2={360} y2={314} stroke="var(--line-strong)" strokeDasharray="2 6" />
          <Side x0={392} title="Hash partitioning" part={HASH_PART} step={step} isRange={false} />
        </svg>
      )}
    </AnimationShell>
  );
}
