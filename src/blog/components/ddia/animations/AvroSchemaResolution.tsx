import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Avro schema resolution: writer's schema vs reader's schema, matched by
 * field NAME, defaults filling gaps — and how the writer's schema actually
 * reaches the reader (file header / registry ID per message).
 */

const steps = [
  {
    caption: (
      <>
        Avro&apos;s bytes carry no field names <em>and no tag numbers</em> — they
        can&apos;t even be parsed without knowing exactly what the writer
        intended. So Avro makes the two schemas explicit:{" "}
        <strong>writer&apos;s schema</strong> (used to encode) and{" "}
        <strong>reader&apos;s schema</strong> (what your code expects). They
        don&apos;t have to be identical — only <em>compatible</em>.
      </>
    ),
  },
  {
    caption: (
      <>
        Our pair. Writer (v1): <code>nick, level, tags</code>. Reader (v2):{" "}
        <code>nick, team (default &quot;—&quot;), level</code> — different fields,
        different <em>order</em>. At decode time, Avro&apos;s resolver lines them
        up.
      </>
    ),
  },
  {
    caption: (
      <>
        Resolution rule 1 — <strong>match by name</strong>: <code>nick ↔ nick</code>,{" "}
        <code>level ↔ level</code>. Field order is irrelevant; the resolver reads
        in writer order and delivers in reader order. (Compare protobuf, which
        matches by number and lets names drift — Avro is the mirror image.)
      </>
    ),
  },
  {
    caption: (
      <>
        Rule 2 — writer has it, reader doesn&apos;t: <code>tags</code> is{" "}
        <strong>skipped</strong> (the writer&apos;s schema says how many bytes it
        occupies). Rule 3 — reader expects it, writer never wrote it:{" "}
        <code>team</code> is filled from the reader schema&apos;s{" "}
        <strong>default</strong>. No default ⇒ resolution error — which is
        precisely the definition of an incompatible change.
      </>
    ),
  },
  {
    caption: (
      <>
        So evolution works — <em>if</em> the reader can get the writer&apos;s
        schema. Delivery problem, case 1: <strong>big files</strong> (data-lake
        dumps). Write the schema <em>once</em> in the file header, then millions
        of rows. Amortized cost ≈ zero — and the file is self-describing for any
        future tool.
      </>
    ),
  },
  {
    caption: (
      <>
        Case 2: <strong>streams</strong>, where each message is tiny and
        embedding a schema per message would be absurd. The trick: prefix each
        message with a 4-byte <strong>schema ID</strong> and store schemas in a{" "}
        <strong>registry</strong>. Producer registers v2 → gets ID 7 → sends{" "}
        <code>[magic 0][id 7][14 bytes]</code>.
      </>
    ),
  },
  {
    caption: (
      <>
        The consumer sees ID 7, fetches that schema from the registry (once —
        then caches), and resolves it against its own reader schema as in steps
        2–3. Bonus superpower: the registry <em>refuses to register</em> a schema
        that breaks the topic&apos;s compatibility mode — evolution rules enforced
        centrally, at write time, instead of discovered in production at read
        time.
      </>
    ),
  },
  {
    caption: (
      <>
        Why tolerate the schema-delivery dance at all? Because no-tags is a
        feature: schemas can be <strong>generated</strong> — from a database
        table&apos;s columns, say — with no human assigning and guarding tag
        numbers. That makes Avro the friendliest format for pipelines that dump
        and re-dump evolving relational data, which is exactly the niche it was
        built for (Hadoop, and later Kafka).
      </>
    ),
  },
];

const writerFields = [
  { name: "nick", type: "string" },
  { name: "level", type: "int" },
  { name: "tags", type: "array" },
];
const readerFields = [
  { name: "nick", type: "string" },
  { name: "team", type: 'string · default "—"' },
  { name: "level", type: "int" },
];

export default function AvroSchemaResolution() {
  return (
    <AnimationShell
      title="Avro schema resolution & the registry trick"
      subtitle="match by name · skip extras · default the gaps"
      steps={steps}
      interval={3400}
    >
      {(step) => {
        const showMatch = step >= 2;
        const showSkipDefault = step >= 3;
        const fileCase = step === 4;
        const streamCase = step >= 5;

        const wy = (i: number) => 78 + i * 30;
        const ry = (i: number) => 78 + i * 30;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Avro schema resolution diagram">
            <VizDefs />

            {/* writer schema */}
            <g className="tr" opacity={streamCase ? 0.3 : 1}>
              <rect x={16} y={36} width={200} height={120} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={30} y={58} size={9.5} mono weight={700} tone="acc">WRITER&apos;S SCHEMA (v1)</Txt>
              {writerFields.map((f, i) => (
                <Txt key={f.name} x={30} y={wy(i) + 14} size={10.5} mono tone={f.name === "tags" && showSkipDefault ? "warn" : "ink"}>
                  {f.name}: {f.type}
                </Txt>
              ))}

              {/* reader schema */}
              <rect x={504} y={36} width={200} height={120} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={518} y={58} size={9.5} mono weight={700} tone="acc">READER&apos;S SCHEMA (v2)</Txt>
              {readerFields.map((f, i) => (
                <Txt key={f.name} x={518} y={ry(i) + 14} size={10.5} mono tone={f.name === "team" && showSkipDefault ? "info" : "ink"}>
                  {f.name}: {f.type}
                </Txt>
              ))}

              {/* name-match arrows */}
              <Arrow x1={216} y1={wy(0) + 10} x2={504} y2={ry(0) + 10} tone="ok" show={showMatch} label="by name" />
              <Arrow x1={216} y1={wy(1) + 10} x2={504} y2={ry(2) + 10} tone="ok" show={showMatch} label="order ≠ problem" labelDy={12} />
              {/* skip + default */}
              <g className="tr" opacity={showSkipDefault ? 1 : 0}>
                <Txt x={236} y={wy(2) + 12} size={10} tone="warn" mono>tags → skipped (reader doesn&apos;t want it)</Txt>
                <Txt x={330} y={ry(1) + 12} size={10} tone="info" mono anchor="start">team ← default &quot;—&quot;</Txt>
              </g>
            </g>

            <Badge x={360} y={26} label={showSkipDefault ? "compatible: every gap has a rule" : showMatch ? "resolving…" : "two schemas, one byte stream"} tone={showSkipDefault ? "ok" : "info"} show={!streamCase && step >= 1} />

            {/* file case */}
            <g className="tr" opacity={fileCase ? 1 : 0}>
              <rect x={120} y={186} width={480} height={70} rx={10} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.4} />
              <Txt x={140} y={208} size={9.5} mono weight={700} tone="ok">DATA FILE (one of millions of rows)</Txt>
              <Txt x={140} y={228} size={10.5} mono>[ header: full writer schema, once ][ row ][ row ][ row ] … ×10⁷</Txt>
              <Txt x={140} y={246} size={10} tone="mut">schema cost amortized to ~nothing; file self-describing forever</Txt>
            </g>

            {/* stream + registry case */}
            <g className="tr" opacity={streamCase ? 1 : 0}>
              <NodeBox x={16} y={60} w={150} h={54} label="producer" sub={step >= 5 ? "schema v2 → ID 7" : ""} tone="acc" />
              <NodeBox x={285} y={36} w={150} h={54} label="schema registry" sub={step >= 6 ? "7 → {v2 schema}" : "register v2 → 7"} tone="info" />
              <NodeBox x={554} y={60} w={150} h={54} label="consumer" sub={step >= 6 ? "fetch 7, cache, resolve" : "sees ID 7"} tone={step >= 6 ? "ok" : "default"} />

              <Arrow x1={120} y1={60} x2={290} y2={56} tone="info" show={step >= 5} label="register" curve={-16} />
              <Arrow x1={435} y1={56} x2={600} y2={60} tone="info" show={step >= 6} label="GET /schemas/7" dashed curve={-16} />

              {/* message bytes */}
              <g>
                <rect x={166} y={150} width={60} height={30} rx={6} fill="var(--bg)" stroke="var(--info)" strokeWidth={1.3} />
                <Txt x={196} y={165} size={9.5} mono anchor="middle">magic 0</Txt>
                <rect x={230} y={150} width={70} height={30} rx={6} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.4} />
                <Txt x={265} y={165} size={9.5} mono anchor="middle" tone="acc">ID = 7</Txt>
                <rect x={304} y={150} width={180} height={30} rx={6} fill="var(--bg)" stroke="var(--line-strong)" />
                <Txt x={394} y={165} size={9.5} mono anchor="middle">avro payload · 14 bytes</Txt>
                <Arrow x1={96} y1={114} x2={170} y2={150} tone="acc" show />
                <Arrow x1={488} y1={165} x2={600} y2={120} tone="acc" show label="per message" />
              </g>

              <g className="tr" opacity={step >= 6 ? 1 : 0}>
                <rect x={16} y={206} width={688} height={56} rx={10} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.3} />
                <Txt x={32} y={226} size={9.5} mono weight={700} tone="ok">REGISTRY AS GATEKEEPER</Txt>
                <Txt x={32} y={246} size={10.5}>
                  compatibility mode (e.g. backward) checked at registration — incompatible schema = rejected publish, not a 3am incident
                </Txt>
              </g>
            </g>

            {/* closing note */}
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <Txt x={16} y={290} size={10.5} tone="acc" weight={600}>
                no tags ⇒ schemas can be machine-generated from table columns — Avro&apos;s home turf: evolving data pipelines
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
