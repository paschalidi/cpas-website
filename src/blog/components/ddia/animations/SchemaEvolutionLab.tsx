import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * Schema evolution lab: rolling upgrades mean old and new code run at once,
 * in both roles. Forward compat = skip unknown tags; backward compat = fill
 * defaults; and the cautionary tale of a reused tag number.
 */

const steps = [
  {
    caption: (
      <>
        Why evolution is unavoidable: during a <strong>rolling upgrade</strong>,
        v1 and v2 of your service run side by side — each is sometimes the writer
        and sometimes the reader. And rows written five years ago still sit in
        the database: <em>data outlives code</em>. So you need compatibility in{" "}
        <strong>both directions</strong>: new code reading old data (backward),
        old code reading new data (forward).
      </>
    ),
  },
  {
    caption: (
      <>
        The schema, protobuf-style. v1: <code>nick = 1</code>,{" "}
        <code>level = 2</code>. v2 adds <code>team = 3</code>. The numbers are the
        contract — they&apos;re what actually appears on the wire. Names are just
        for humans and can change freely.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Test 1 — forward compatibility:</strong> a v2 writer sends{" "}
        <code>nick, level, team</code> to a v1 reader that has never heard of tag
        3. The reader parses tags 1 and 2 happily… then hits tag 3:{" "}
        <em>unknown field</em>.
      </>
    ),
  },
  {
    caption: (
      <>
        No crash: the tag&apos;s <strong>wire type</strong> tells v1 exactly how
        many bytes to skip (length-delimited: read length, jump). It skips tag 3
        and finishes the record. Old code reads new data —{" "}
        <strong>forward compatible</strong> — because unknown fields are
        mechanically skippable. (Careful: if v1 re-saves the record, it should
        preserve those unknown bytes, not silently drop a field it can&apos;t
        see.)
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Test 2 — backward compatibility:</strong> v2 reads a record
        written by v1 (or a five-year-old database row). Tag 3 simply isn&apos;t
        there. The decoder fills <code>team</code> from its{" "}
        <strong>default value</strong>. New code reads old data — backward
        compatible — <em>because the new field was optional with a default</em>.
        A new <em>required</em> field would make every byte of historical data
        unreadable; that&apos;s why protobuf v3 removed <code>required</code>{" "}
        entirely.
      </>
    ),
  },
  {
    caption: (
      <>
        The rules, derived rather than memorized: <strong>add</strong> fields only
        with new tag numbers + defaults; <strong>remove</strong> only optional
        fields, and never, ever <strong>reuse</strong> a removed tag number;
        renames are free; type changes are mostly not (a reader using the old
        type will misparse the bytes).
      </>
    ),
  },
  {
    caption: (
      <>
        What reuse does, concretely: v3 deletes <code>team</code> and recycles tag
        3 for <code>score: int</code>. Old v2 data — where tag 3 holds a{" "}
        <em>string</em> — meets the v3 reader, which parses those bytes as an
        integer: silent garbage, or a crash if you&apos;re lucky.{" "}
        <strong>Silent</strong> is the operative horror — the decoder has no way
        to know. Hence <code>reserved 3;</code> exists: make the compiler ban the
        reuse forever.
      </>
    ),
  },
  {
    caption: (
      <>
        Same physics everywhere: a database column added in 2026 means rows from
        2021 lack it — reads fill <code>NULL</code>/default instead of rewriting
        terabytes. Every boundary where bytes outlive or outrun code — database,
        RPC, message queue, files in object storage — is an evolution boundary,
        and compatibility is a property you <em>verify</em>, not hope for. The
        registry in the next animation does exactly that.
      </>
    ),
  },
];

const wireV2 = [
  { tag: "1", val: '"ada"', known: true },
  { tag: "2", val: "42", known: true },
  { tag: "3", val: '"red"', known: false },
];

export default function SchemaEvolutionLab() {
  return (
    <AnimationShell
      title="Schema evolution lab: old code meets new data"
      subtitle="forward = skip unknowns · backward = fill defaults"
      steps={steps}
      interval={3400}
    >
      {(step) => {
        const fwd = step === 2 || step === 3; // v2 writer → v1 reader
        const bwd = step === 4; // v1 writer → v2 reader
        const reuse = step === 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Schema evolution diagram">
            <VizDefs />

            {/* schema panels */}
            <g className="tr" opacity={step >= 1 ? 1 : 0.35}>
              <rect x={16} y={20} width={180} height={92} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={30} y={42} size={9.5} mono weight={700} tone="acc">SCHEMA v1</Txt>
              <Txt x={30} y={64} size={10.5} mono>string nick = 1;</Txt>
              <Txt x={30} y={82} size={10.5} mono>int32 level = 2;</Txt>
            </g>
            <g className="tr" opacity={step >= 1 ? 1 : 0.35}>
              <rect x={216} y={20} width={196} height={92} rx={10} fill="var(--bg)" stroke={reuse ? "var(--line-strong)" : "var(--accent)"} strokeWidth={1.4} />
              <Txt x={230} y={42} size={9.5} mono weight={700} tone="acc">SCHEMA v2</Txt>
              <Txt x={230} y={64} size={10.5} mono>… nick = 1; level = 2;</Txt>
              <Txt x={230} y={82} size={10.5} mono tone="acc">string team = 3;  // +default</Txt>
            </g>
            <g className="tr" opacity={reuse ? 1 : 0}>
              <rect x={432} y={20} width={196} height={92} rx={10} fill="var(--bg)" stroke="var(--bad)" strokeWidth={1.6} />
              <Txt x={446} y={42} size={9.5} mono weight={700} tone="bad">SCHEMA v3 — BAD</Txt>
              <Txt x={446} y={64} size={10.5} mono>// team deleted</Txt>
              <Txt x={446} y={82} size={10.5} mono tone="bad">int32 score = 3;  // reuse!</Txt>
            </g>

            {/* writer / reader nodes */}
            <NodeBox
              x={24}
              y={150}
              w={160}
              h={56}
              label={bwd ? "writer · v1 (old data)" : reuse ? "data written by v2" : "writer · v2"}
              sub={bwd ? "sends tags 1, 2" : reuse ? "tag 3 = string" : "sends tags 1, 2, 3"}
              tone={reuse ? "warn" : "acc"}
            />
            <NodeBox
              x={536}
              y={150}
              w={160}
              h={56}
              label={bwd ? "reader · v2 (new code)" : reuse ? "reader · v3" : "reader · v1 (old code)"}
              sub={
                reuse
                  ? "parses tag 3 as int ✗"
                  : bwd
                    ? step >= 4
                      ? 'team ← default ""'
                      : "expects tag 3…"
                    : step >= 3
                      ? "skipped tag 3 ✓"
                      : "knows tags 1, 2 only"
              }
              tone={reuse ? "bad" : step >= 3 ? "ok" : "info"}
            />

            {/* wire */}
            <Arrow x1={184} y1={178} x2={536} y2={178} tone={reuse ? "bad" : "acc"} show={step >= 2} />
            {(fwd || step >= 5 ? wireV2 : bwd ? wireV2.slice(0, 2) : wireV2).map((f, i) => {
              const show = step >= 2;
              const x = 226 + i * 100;
              const unknownNow = fwd && !f.known;
              const poisoned = reuse && f.tag === "3";
              return (
                <g key={`${step}-${i}`} className="tr" opacity={show ? 1 : 0}>
                  <rect
                    x={x}
                    y={160}
                    width={92}
                    height={34}
                    rx={8}
                    fill="var(--bg)"
                    stroke={poisoned ? "var(--bad)" : unknownNow ? "var(--warn)" : "var(--line-strong)"}
                    strokeWidth={poisoned || unknownNow ? 1.6 : 1.2}
                  />
                  <text x={x + 46} y={172} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--muted)">
                    tag {f.tag} · len
                  </text>
                  <text x={x + 46} y={186} textAnchor="middle" fontSize="10" fontWeight={650} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--ink)">
                    {f.val}
                  </text>
                </g>
              );
            })}

            {/* annotations */}
            <Badge x={426} y={222} label="tag 3 unknown → wire type says: skip 5 bytes" tone="warn" show={step === 2 || step === 3} />
            <Badge x={580} y={222} label="FORWARD COMPATIBLE ✓" tone="ok" show={step === 3} />
            <Badge x={426} y={222} label='tag 3 absent → team = "" (default)' tone="info" show={bwd} />
            <Badge x={580} y={222} label="BACKWARD COMPATIBLE ✓" tone="ok" show={bwd} />
            <Badge x={426} y={222} label='string bytes "red" parsed as int → garbage' tone="bad" show={reuse} />
            <Badge x={600} y={250} label="SILENT CORRUPTION" tone="bad" show={reuse} />

            {/* rules wall */}
            <g className="tr" opacity={step === 5 ? 1 : 0}>
              <rect x={16} y={232} width={688} height={66} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
              <Txt x={32} y={252} size={9.5} mono weight={700} tone="acc">THE TAG RULES</Txt>
              <Txt x={32} y={270} size={10.5}>
                add: new number + default · remove: optional only, then `reserved N;` · rename: free (names aren&apos;t on the wire)
              </Txt>
              <Txt x={32} y={288} size={10.5}>
                never reuse a number · never change a number · type changes: assume breaking unless proven otherwise
              </Txt>
            </g>

            {/* db angle */}
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <Txt x={16} y={250} size={10.5} weight={600} tone="acc">
                same rule, every boundary:
              </Txt>
              <Txt x={16} y={270} size={10.5}>
                DB column added → old rows read as NULL/default · RPC: old clients call new servers (and vice versa)
              </Txt>
              <Txt x={16} y={288} size={10.5}>
                queues: messages written before the deploy are consumed after it · files: archives are forever
              </Txt>
            </g>

            <Txt x={16} y={134} size={10} mono tone="mut">
              {bwd ? "TEST 2: old writer → new reader (backward)" : reuse ? "VIOLATION: reused tag number" : step >= 2 ? "TEST 1: new writer → old reader (forward)" : ""}
            </Txt>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
