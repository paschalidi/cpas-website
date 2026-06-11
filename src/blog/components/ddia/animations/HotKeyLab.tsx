import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge, Chip } from "./viz";

/**
 * Hot keys: hashing balances *keys*, not *traffic*. One celebrity key melts a
 * partition; salting the key spreads writes at the cost of fan-out reads.
 */

const steps = [
  {
    caption: (
      <>
        A social app hash-partitions posts by <code>post_id</code>. Keys are spread
        perfectly evenly — each partition owns a third of the keyspace. Looks healthy.
      </>
    ),
  },
  {
    caption: (
      <>
        Then one post goes viral. Hashing sends <em>every</em> like and comment for{" "}
        <code>star</code> to the <strong>same partition</strong> — identical key,
        identical hash, identical home. Hashing balances keys, not popularity.
      </>
    ),
  },
  {
    caption: (
      <>
        Partition 1 saturates: its write queue grows, p99 latency climbs, and the other
        two partitions sit idle. Adding nodes doesn&apos;t help — the hot key still maps to
        exactly one of them.
      </>
    ),
  },
  {
    caption: (
      <>
        The classic fix: <strong>salt the key</strong>. Writers append a small random
        suffix — <code>star#1</code> … <code>star#4</code> — turning one hot key into
        four cooler ones that hash to different partitions.
      </>
    ),
  },
  {
    caption: (
      <>
        Now the viral traffic fans out: each salted variant lands on its own partition,
        and per-partition load drops to roughly 1/4 of the spike. The cluster breathes
        again.
      </>
    ),
  },
  {
    caption: (
      <>
        The bill arrives on the read path: fetching <code>star</code>&apos;s data now means
        querying <strong>all four</strong> salted keys and merging. You traded one hot
        write target for N-way read fan-out.
      </>
    ),
  },
  {
    caption: (
      <>
        That&apos;s why you salt <em>only</em> the few provably hot keys (and track which
        ones they are), not everything. DynamoDB&apos;s docs call this write sharding;
        per-partition throughput caps make it unavoidable for celebrity workloads.
      </>
    ),
  },
];

export default function HotKeyLab() {
  return (
    <AnimationShell title="Hot keys: the celebrity problem" subtitle="why even hashing melts down, and what salting costs" steps={steps}>
      {(step) => {
        const viral = step >= 1;
        const melt = step >= 2 && step < 4;
        const salted = step >= 3;
        const spread = step >= 4;
        const readCost = step >= 5;

        const px = [80, 310, 540];
        const py = 150;
        const pw = 150;
        const ph = 96;

        return (
          <svg viewBox="0 0 720 330" className="h-auto w-full" role="img" aria-label="Hot key and salting diagram">
            <VizDefs />

            {/* client / traffic source */}
            <NodeBox x={290} y={20} w={140} h={44} label={viral ? "viral post: star" : "clients"} sub={viral ? "1M likes/min" : "normal traffic"} tone={viral ? "warn" : "default"} />

            {/* partitions */}
            {px.map((x, i) => {
              const hot = melt && i === 1;
              const cool = spread;
              return (
                <NodeBox
                  key={i}
                  x={x}
                  y={py}
                  w={pw}
                  h={ph}
                  label={`partition ${i}`}
                  sub={
                    hot
                      ? "queue ↑↑ · p99 ↑↑"
                      : cool && viral
                        ? "~1/4 of spike"
                        : "nominal"
                  }
                  tone={hot ? "bad" : cool && viral ? "ok" : "default"}
                  fillTone={hot ? "bad" : undefined}
                />
              );
            })}

            {/* normal traffic arrows (step 0) */}
            {px.map((x, i) => (
              <Arrow key={i} x1={360} y1={64} x2={x + pw / 2} y2={py - 8} tone="mut" show={!viral} dashed />
            ))}

            {/* viral, unsalted: all arrows to partition 1 */}
            {[0, 1, 2].map((i) => (
              <Arrow
                key={`v${i}`}
                x1={330 + i * 30}
                y1={64}
                x2={px[1] + pw / 2 - 20 + i * 20}
                y2={py - 8}
                tone="bad"
                show={viral && !spread}
                label={i === 1 ? 'hash("star") → p1' : undefined}
              />
            ))}

            {/* salted keys */}
            {[0, 1, 2, 3].map((i) => {
              const targets = [0, 1, 2, 0]; // star#1..4 → partitions
              const t = targets[i];
              // pre-spread: a row under the client; post-spread: above the target partition
              const sx = spread ? px[t] + pw / 2 + (i === 3 ? 34 : i === 0 ? -34 : 0) : 220 + i * 76;
              const sy = spread ? py - 26 : 96;
              return (
                <g key={i} className="tr" opacity={salted ? 1 : 0}>
                  <Chip cx={sx} cy={sy} label={`star#${i + 1}`} w={58} h={20} tone="acc" filled={spread} />
                  {spread ? <Arrow x1={sx} y1={sy + 12} x2={px[t] + pw / 2 + (i === 3 ? 24 : i === 0 ? -24 : 0)} y2={py - 6} tone="ok" show /> : null}
                </g>
              );
            })}
            <g className="tr" opacity={salted && !spread ? 1 : 0}>
              <Txt x={360} y={120} anchor="middle" size={10.5} tone="acc" weight={600}>
                writer appends random suffix 1–4
              </Txt>
            </g>

            {/* melt badge */}
            <g className="tr" opacity={melt ? 1 : 0}>
              <Badge x={px[1] + pw / 2} y={py + ph + 22} label="HOT PARTITION" tone="bad" />
              <Txt x={px[0] + pw / 2} y={py + ph + 24} anchor="middle" size={10}>
                idle
              </Txt>
              <Txt x={px[2] + pw / 2} y={py + ph + 24} anchor="middle" size={10}>
                idle
              </Txt>
            </g>

            {/* read fan-out */}
            <g className="tr" opacity={readCost ? 1 : 0}>
              <NodeBox x={290} y={272} w={140} h={42} label='read "star"' sub="query 4 keys, merge" tone="warn" />
              {[0, 1, 2].map((i) => (
                <Arrow key={i} x1={px[i] + pw / 2} y1={py + ph + 4} x2={350 + (i - 1) * 36} y2={270} tone="warn" show={readCost} dashed />
              ))}
              <Txt x={360} y={326} anchor="middle" size={10.5} tone="warn" weight={600}>
                cost moved from writes to reads: N-way fan-out + merge
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
