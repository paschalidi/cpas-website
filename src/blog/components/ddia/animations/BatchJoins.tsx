import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Joining two datasets in batch: reduce-side sort-merge join (general,
 * shuffle-heavy) vs map-side broadcast hash join (fast, needs a small side).
 */

const steps = [
  {
    caption: (
      <>
        Task: join a <strong>click log</strong> (billions of rows:{" "}
        <code>user_id, url</code>) with a <strong>user table</strong> (millions:{" "}
        <code>user_id, country</code>) to count clicks per country. No indexes in
        batch land — a &ldquo;join&rdquo; means physically bringing matching
        records together. Two strategies.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Reduce-side join, step 1:</strong> mappers read <em>both</em>{" "}
        inputs and emit everything keyed by <code>user_id</code> — click records
        tagged C, user records tagged U. No join logic yet; mappers just label and
        address.
      </>
    ),
  },
  {
    caption: (
      <>
        The shuffle does the matchmaking: hash-partition on <code>user_id</code>,
        so every record about user 17 — the one U record and all its C records —
        lands on the <em>same reducer</em>, sorted. A <strong>secondary sort</strong>{" "}
        orders the tag too: U arrives <em>before</em> its Cs.
      </>
    ),
  },
  {
    caption: (
      <>
        Each reducer streams its sorted run: see U(17, &ldquo;IE&rdquo;) → hold
        country in one variable → for every following C(17, …) emit{" "}
        <code>(IE, 1)</code>. One pass, O(1) memory per key. General — works for
        any sizes — but the <em>entire</em> click log crossed the network and hit
        disk. Sort-merge join.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Map-side broadcast join:</strong> different bet. The user table is{" "}
        <em>small enough to fit in RAM</em> — so ship a copy of it to{" "}
        <strong>every</strong> mapper as an in-memory hash table.
      </>
    ),
  },
  {
    caption: (
      <>
        Now mappers stream the giant click log and join inline:{" "}
        <code>hash.get(user_id) → country</code>, emit. <strong>No shuffle of the
        big input at all.</strong> The output is done when the map is done — no
        reduce stage needed for the join itself.
      </>
    ),
  },
  {
    caption: (
      <>
        The skew footnote (chapter 6 returns): one celebrity user with 10⁸ clicks
        makes one reducer the whole job&apos;s straggler in a reduce-side join.
        Mitigations: salt the hot key across reducers and recombine, or broadcast
        just the hot keys&apos; side. Skew is the #1 reason real joins are slow.
      </>
    ),
  },
  {
    caption: (
      <>
        Choosing: <strong>broadcast</strong> when one side fits in memory (after
        filtering — push filters down first!); <strong>partitioned hash
        join</strong> when both sides are pre-partitioned the same way;{" "}
        <strong>sort-merge reduce-side</strong> as the general fallback. The mental
        model: a batch join is a question of <em>where matching rows physically
        meet</em> — at reducers via shuffle, or at mappers via broadcast.
      </>
    ),
  },
];

export default function BatchJoins() {
  return (
    <AnimationShell
      title="Reduce-side vs map-side joins"
      subtitle="where do matching rows physically meet?"
      steps={steps}
      interval={3200}
    >
      {(step) => {
        const reduceSide = step >= 1 && step <= 3;
        const mapSide = step >= 4 && step <= 5;
        const dimLeft = step >= 4 && step <= 5;
        const dimRight = step >= 1 && step <= 3;

        return (
          <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="Batch join strategies diagram">
            <VizDefs />
            <line x1={360} y1={12} x2={360} y2={308} stroke="var(--line-strong)" strokeDasharray="2 6" />

            {/* ---------------- left: reduce-side ---------------- */}
            <g className="tr" opacity={dimLeft ? 0.28 : 1}>
              <Txt x={18} y={26} size={12} weight={700} tone="ink">
                A · reduce-side (sort-merge)
              </Txt>

              <NodeBox x={18} y={44} w={104} h={44} label="clicks" sub="billions · C" tone="default" />
              <NodeBox x={18} y={100} w={104} h={44} label="users" sub="millions · U" tone="default" />
              <NodeBox x={156} y={70} w={92} h={48} label="mappers" sub={reduceSide ? "tag + key" : ""} tone={reduceSide ? "acc" : "default"} />
              <Arrow x1={122} y1={66} x2={152} y2={86} tone="mut" show={step >= 1} />
              <Arrow x1={122} y1={122} x2={152} y2={102} tone="mut" show={step >= 1} />

              {/* shuffle */}
              <g className="tr" opacity={step >= 2 ? 1 : 0}>
                <rect x={150} y={150} width={104} height={34} rx={17} fill="var(--bg)" stroke="var(--warn)" strokeDasharray="5 4" />
                <Txt x={202} y={167} size={9.5} anchor="middle" tone="warn" weight={700} mono>
                  SHUFFLE (all of it)
                </Txt>
              </g>
              <Arrow x1={202} y1={118} x2={202} y2={148} tone="warn" show={step >= 2} />
              <Arrow x1={202} y1={184} x2={202} y2={210} tone="warn" show={step >= 2} />

              <NodeBox x={156} y={214} w={92} h={48} label="reducer" sub={step >= 3 ? "U then C…C" : "by user_id"} tone={step >= 3 ? "ok" : "default"} />

              {/* sorted run readout */}
              <g className="tr" opacity={step >= 2 ? 1 : 0}>
                <rect x={262} y={196} width={88} height={86} rx={8} fill="var(--bg)" stroke="var(--line-strong)" />
                <Txt x={274} y={214} size={8.5} mono weight={700} tone="acc">
                  sorted run
                </Txt>
                <Txt x={274} y={231} size={9.5} mono tone={step >= 3 ? "ok" : "ink"}>
                  U 17 IE
                </Txt>
                <Txt x={274} y={247} size={9.5} mono>
                  C 17 /a
                </Txt>
                <Txt x={274} y={263} size={9.5} mono>
                  C 17 /b
                </Txt>
                <Txt x={274} y={279} size={9.5} mono tone="mut">
                  U 18 FR …
                </Txt>
              </g>
              <Txt x={156} y={296} size={9.5} tone="ok" show={step >= 3} mono>
                emit (IE,1)(IE,1)…
              </Txt>
            </g>

            {/* ---------------- right: map-side broadcast ---------------- */}
            <g className="tr" opacity={dimRight ? 0.28 : 1}>
              <Txt x={382} y={26} size={12} weight={700} tone="ink">
                B · map-side (broadcast hash)
              </Txt>

              <NodeBox x={382} y={44} w={104} h={44} label="users" sub="small → RAM" tone={mapSide ? "info" : "default"} />
              <NodeBox x={382} y={210} w={104} h={44} label="clicks" sub="billions" tone="default" />

              {/* mappers with hash tables */}
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <NodeBox
                    x={540}
                    y={44 + i * 64}
                    w={120}
                    h={50}
                    label={`mapper ${i + 1}`}
                    sub={step >= 4 ? "hash{u→country}" : ""}
                    tone={step >= 5 ? "ok" : step >= 4 ? "info" : "default"}
                  />
                  <Arrow x1={486} y1={66} x2={536} y2={62 + i * 64} tone="info" show={step >= 4} dashed={i > 0} label={i === 0 ? "broadcast copy" : undefined} />
                  <Arrow x1={486} y1={232} x2={536} y2={80 + i * 64} tone="acc" show={step >= 5} />
                </g>
              ))}

              <Txt x={540} y={250} size={9.5} mono tone="ok" show={step >= 5}>
                join inside map() — no shuffle
              </Txt>
              <Badge x={444} y={282} label="output ready at end of map ✓" tone="ok" show={step === 5} />
            </g>

            {/* skew + choosing overlays */}
            <g className="tr" opacity={step === 6 ? 1 : 0}>
              <rect x={150} y={108} width={420} height={96} rx={12} fill="var(--bg)" stroke="var(--bad)" strokeWidth={1.5} />
              <Txt x={170} y={134} size={11} weight={700} tone="bad">
                SKEW: the celebrity problem
              </Txt>
              <Txt x={170} y={156} size={10.5}>
                hash(user 1D) sends 10⁸ rows to ONE reducer → job waits on it
              </Txt>
              <Txt x={170} y={176} size={10.5}>
                fixes: salt hot keys across reducers; broadcast the hot keys&apos; side;
              </Txt>
              <Txt x={170} y={192} size={10.5}>
                always filter/project before the shuffle
              </Txt>
            </g>

            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <Badge x={202} y={150} label="general · pays full shuffle" tone="warn" />
              <Badge x={530} y={150} label="fast · needs small side in RAM" tone="ok" />
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
