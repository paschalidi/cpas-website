import AnimationShell from "./AnimationShell";
import { VizDefs, Txt, Badge } from "./viz";

/**
 * One record, four encodings: where the structure lives decides the size.
 * JSON (45 B) → MessagePack (30 B) → Protobuf (16 B) → Avro (14 B).
 */

const steps = [
  {
    caption: (
      <>
        Programs keep data in objects; networks and disks speak <em>bytes</em>.
        Every boundary crossing is an <strong>encoding</strong> (serialization).
        Our specimen, a player profile: <code>nick=&quot;ada&quot;, level=42,
        tags=[&quot;pro&quot;,&quot;eu&quot;]</code>. The question that decides
        everything downstream: <em>where does the structure live — in every
        record, or in a schema?</em>
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>JSON: 45 bytes.</strong> Structure lives <em>inside every
        record</em>: field names, quotes, brackets, all repeated per row. Wins:
        human-readable, universal, schema-optional. Quiet costs: is 42 an int, a
        float, a double? (JS can&apos;t represent integers above 2⁵³ — large IDs
        get mangled, which is why APIs ship them as strings.) No bytes type
        without Base64. Verbosity × a billion rows.
      </>
    ),
  },
  {
    caption: (
      <>
        First instinct: keep JSON&apos;s model, binary-fy it —{" "}
        <strong>MessagePack: 30 bytes.</strong> Markers shrink (<code>83</code> =
        map of 3, <code>a4</code> = 4-char string) but the field names{" "}
        <em>are still in every record</em>, because the format must stay
        self-describing. Modest savings, possibly not worth losing readability.
        The big wins need a different idea.
      </>
    ),
  },
  {
    caption: (
      <>
        The idea: a <strong>schema</strong>, agreed by both sides.{" "}
        <strong>Protocol Buffers / Thrift: 16 bytes.</strong> Field <em>names</em>{" "}
        vanish from the wire — each value is prefixed by a 1-byte tag packing the
        field <em>number</em> + wire type: <code>0A</code> = field 1,
        length-delimited. Names live only in the <code>.proto</code> file; the
        bytes are just numbered slots.
      </>
    ),
  },
  {
    caption: (
      <>
        Zoom on two details. <strong>Varints:</strong> 42 encodes as one byte
        (<code>2A</code>) — small numbers cost little, a big win since most
        numbers are small. <strong>Wire types:</strong> the tag&apos;s low bits say
        how to <em>skip</em> a field you don&apos;t recognize (read its length,
        jump). Remember that skip — it&apos;s the entire basis of forward
        compatibility in the next animation.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Avro: 14 bytes — no tags at all.</strong> Just values,
        concatenated in schema order: length-prefixed &quot;ada&quot;, zigzag-varint
        42, the tags array in blocks. Maximally compact — and maximally
        demanding: these bytes <em>cannot be parsed</em> without the exact schema
        the writer used. Avro embraces that, with a clever delivery system
        (animation 3).
      </>
    ),
  },
  {
    caption: (
      <>
        The tally: <strong>45 → 30 → 16 → 14 bytes</strong>. Now multiply by ten
        billion rows in a data lake, or a million RPC calls a second. Binary
        schema formats also buy you: real types (int64 vs double), bytes without
        Base64, and — the deeper prize — a schema as <em>checkable
        documentation</em> that&apos;s guaranteed current, because decoding
        depends on it.
      </>
    ),
  },
  {
    caption: (
      <>
        The mental model to keep: structure can live in{" "}
        <strong>every record</strong> (JSON, MessagePack — flexible, fat),{" "}
        <strong>field numbers + schema</strong> (Protobuf, Thrift — compact,
        evolvable via tags), or <strong>the schema alone</strong> (Avro — most
        compact, schema must travel). That placement determines not just size
        but <em>how the format evolves</em> — which is the real subject of this
        chapter.
      </>
    ),
  },
];

function ByteCell({ x, y, hex, note, tone }: { x: number; y: number; hex: string; note?: string; tone: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width={30} height={24} fill="var(--bg)" stroke={tone} strokeWidth={1.2} />
      <text x={15} y={12} textAnchor="middle" dominantBaseline="central" fontSize="9.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--ink)">
        {hex}
      </text>
      {note ? (
        <text x={15} y={34} textAnchor="middle" fontSize="7.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--muted)">
          {note}
        </text>
      ) : null}
    </g>
  );
}

function ByteRow({ x, y, cells }: { x: number; y: number; cells: { hex: string; note?: string; t: "name" | "val" | "mark" }[] }) {
  const toneOf = { name: "var(--bad)", val: "var(--accent)", mark: "var(--info)" } as const;
  return (
    <g>
      {cells.map((c, i) => (
        <ByteCell key={i} x={x + i * 31} y={y} hex={c.hex} note={c.note} tone={toneOf[c.t]} />
      ))}
    </g>
  );
}

const SIZES = [
  { name: "JSON", bytes: 45, tone: "var(--bad)" },
  { name: "MessagePack", bytes: 30, tone: "var(--warn)" },
  { name: "Protobuf", bytes: 16, tone: "var(--accent)" },
  { name: "Avro", bytes: 14, tone: "var(--ok)" },
];

export default function BinaryEncodingBytes() {
  return (
    <AnimationShell
      title="The same record, byte by byte"
      subtitle="where the structure lives decides the size"
      steps={steps}
      interval={3400}
    >
      {(step) => {
        const revealed = step === 0 ? 0 : Math.min(step, 5) - 0;
        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Encoding comparison, byte by byte">
            <VizDefs />

            {/* the record */}
            <rect x={16} y={20} width={300} height={48} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
            <Txt x={32} y={40} size={9.5} mono weight={700} tone="acc">
              THE RECORD
            </Txt>
            <Txt x={32} y={58} size={11} mono>
              {`nick:"ada"  level:42  tags:["pro","eu"]`}
            </Txt>

            {/* legend */}
            <g>
              <rect x={420} y={26} width={12} height={12} fill="none" stroke="var(--bad)" strokeWidth={1.4} />
              <Txt x={438} y={32} size={9.5}>structure / names</Txt>
              <rect x={420} y={44} width={12} height={12} fill="none" stroke="var(--accent)" strokeWidth={1.4} />
              <Txt x={438} y={50} size={9.5}>values</Txt>
              <rect x={560} y={26} width={12} height={12} fill="none" stroke="var(--info)" strokeWidth={1.4} />
              <Txt x={578} y={32} size={9.5}>tags / markers</Txt>
            </g>

            {/* per-format panels */}
            {/* JSON */}
            <g className="tr" opacity={step === 1 ? 1 : 0}>
              <Txt x={16} y={110} size={12} weight={700}>JSON · 45 bytes — every byte is visible structure or text</Txt>
              <Txt x={16} y={138} size={12.5} mono>
                {`{"nick":"ada","level":42,"tags":["pro","eu"]}`}
              </Txt>
              <Txt x={16} y={164} size={10} tone="bad">
                field names repeated in EVERY record · number types ambiguous · ints {">"} 2⁵³ unsafe in JS
              </Txt>
            </g>

            {/* MessagePack */}
            <g className="tr" opacity={step === 2 ? 1 : 0}>
              <Txt x={16} y={104} size={12} weight={700}>MessagePack · 30 bytes — binary, but names still aboard</Txt>
              <ByteRow
                x={16}
                y={120}
                cells={[
                  { hex: "83", note: "map3", t: "mark" },
                  { hex: "a4", note: "str4", t: "mark" },
                  { hex: "6E", note: "n", t: "name" },
                  { hex: "69", note: "i", t: "name" },
                  { hex: "63", note: "c", t: "name" },
                  { hex: "6B", note: "k", t: "name" },
                  { hex: "a3", note: "str3", t: "mark" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "64", note: "d", t: "val" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "…", t: "mark" },
                ]}
              />
              <Txt x={16} y={176} size={10} tone="warn">
                &quot;nick&quot;, &quot;level&quot;, &quot;tags&quot; still spelled out per record — self-describing has a rent
              </Txt>
            </g>

            {/* Protobuf */}
            <g className="tr" opacity={step === 3 || step === 4 ? 1 : 0}>
              <Txt x={16} y={104} size={12} weight={700}>Protocol Buffers · 16 bytes — names → field numbers</Txt>
              <ByteRow
                x={16}
                y={120}
                cells={[
                  { hex: "0A", note: "f1·len", t: "mark" },
                  { hex: "03", note: "3", t: "mark" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "64", note: "d", t: "val" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "10", note: "f2·int", t: "mark" },
                  { hex: "2A", note: "42", t: "val" },
                  { hex: "1A", note: "f3·len", t: "mark" },
                  { hex: "03", note: "3", t: "mark" },
                  { hex: "70", note: "p", t: "val" },
                  { hex: "72", note: "r", t: "val" },
                  { hex: "6F", note: "o", t: "val" },
                  { hex: "1A", note: "f3·len", t: "mark" },
                  { hex: "02", note: "2", t: "mark" },
                  { hex: "65", note: "e", t: "val" },
                  { hex: "75", note: "u", t: "val" },
                ]}
              />
              <Txt x={16} y={176} size={10} tone="acc" show={step === 3}>
                zero red bytes: names live in the .proto schema, not on the wire
              </Txt>
              <g className="tr" opacity={step === 4 ? 1 : 0}>
                <rect x={16} y={186} width={560} height={40} rx={8} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
                <Txt x={30} y={202} size={10} mono>
                  tag 0x0A = (field 1 ≪ 3) | wiretype 2 → &quot;length-delimited: read len, then skip or parse&quot;
                </Txt>
                <Txt x={30} y={218} size={10} mono>
                  varint: 42 → 2A (1 byte) · 300 → AC 02 (2 bytes) — small numbers stay small
                </Txt>
              </g>
            </g>

            {/* Avro */}
            <g className="tr" opacity={step === 5 ? 1 : 0}>
              <Txt x={16} y={104} size={12} weight={700}>Avro · 14 bytes — values only, schema order</Txt>
              <ByteRow
                x={16}
                y={120}
                cells={[
                  { hex: "06", note: "len3", t: "mark" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "64", note: "d", t: "val" },
                  { hex: "61", note: "a", t: "val" },
                  { hex: "54", note: "42z", t: "val" },
                  { hex: "04", note: "blk2", t: "mark" },
                  { hex: "06", note: "len3", t: "mark" },
                  { hex: "70", note: "p", t: "val" },
                  { hex: "72", note: "r", t: "val" },
                  { hex: "6F", note: "o", t: "val" },
                  { hex: "04", note: "len2", t: "mark" },
                  { hex: "65", note: "e", t: "val" },
                  { hex: "75", note: "u", t: "val" },
                  { hex: "00", note: "end", t: "mark" },
                ]}
              />
              <Txt x={16} y={176} size={10} tone="ok">
                no field numbers either — unreadable without the writer&apos;s schema, by design
              </Txt>
            </g>

            {/* size bars (final steps) */}
            <g className="tr" opacity={step >= 6 ? 1 : 0}>
              {SIZES.map((s, i) => (
                <g key={s.name}>
                  <Txt x={16} y={120 + i * 36} size={11} mono weight={600}>
                    {s.name}
                  </Txt>
                  <rect x={130} y={108 + i * 36} width={(s.bytes / 45) * 440} height={20} rx={4} fill={s.tone} opacity={0.85} className="tr" />
                  <Txt x={140 + (s.bytes / 45) * 440} y={118 + i * 36} size={11} mono weight={700}>
                    {s.bytes} B
                  </Txt>
                </g>
              ))}
              <Txt x={16} y={266} size={10.5} tone="mut" show={step >= 6}>
                × 10¹⁰ rows in a lake, or 10⁶ RPCs/sec — the gap pays for whole clusters
              </Txt>
            </g>

            {/* running size tally */}
            <g>
              {SIZES.map((s, i) => {
                const on = step >= i + 1 && step < 6;
                return (
                  <g key={s.name} className="tr" opacity={on ? 1 : 0}>
                    <Badge x={648} y={120 + i * 34} label={`${s.name}: ${s.bytes} B`} tone={i === 0 ? "bad" : i === 1 ? "warn" : i === 2 ? "acc" : "ok"} />
                  </g>
                );
              })}
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
