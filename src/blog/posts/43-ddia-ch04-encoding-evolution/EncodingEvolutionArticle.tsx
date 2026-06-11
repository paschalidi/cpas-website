import React from "react";
import DDIAThemeProvider from "../../components/ddia/DDIAThemeProvider";
import {
  H2,
  H3,
  Callout,
  InTheWild,
  KeyTakeaways,
  CheatTable,
  InterviewQA,
  Misconceptions,
} from "../../components/ddia/blocks";
import CodeBlock from "../../components/ddia/CodeBlock";
import BinaryEncodingBytes from "../../components/ddia/animations/BinaryEncodingBytes";
import SchemaEvolutionLab from "../../components/ddia/animations/SchemaEvolutionLab";
import AvroSchemaResolution from "../../components/ddia/animations/AvroSchemaResolution";

export default function EncodingEvolutionArticle() {
  return (
    <DDIAThemeProvider>
      <div className="blog-content">
        <p>
          Every byte that crosses a process boundary — onto disk, over the
          network, into a queue — has been <em>encoded</em>, and will one day be
          decoded by code that didn&apos;t exist when it was written. This
          chapter is about that time-travel problem: choosing byte formats, and
          changing them later without breaking the old readers, the old writers,
          or the five-year-old rows still sitting in your database.
        </p>

        <H2 id="why-encoding">Data outlives code</H2>
        <p>
          Two facts make encoding a <em>design</em> topic rather than a library
          choice. First, deployments roll: during any upgrade, version 1 and
          version 2 of your code run simultaneously — each sometimes writing,
          sometimes reading. Second, storage persists: code from 2026 routinely
          reads bytes written in 2021. Together they force two distinct promises:
        </p>
        <ul>
          <li>
            <strong>Backward compatibility</strong> — newer code can read data
            written by older code. Comparatively easy: you wrote the old format,
            you know what it looks like.
          </li>
          <li>
            <strong>Forward compatibility</strong> — older code can read data
            written by newer code. Harder and easier to forget: old code must
            gracefully handle fields it has never heard of, ideally preserving
            rather than destroying them.
          </li>
        </ul>
        <Callout type="insight">
          <p>
            A useful reframe: in a system with rolling upgrades, &ldquo;the
            schema&rdquo; is never one thing — it&apos;s a <em>set</em> of
            versions coexisting in time, and compatibility is the contract that
            lets them interoperate. Encoding formats differ mainly in how
            mechanically they enforce that contract.
          </p>
        </Callout>
        <p>
          One non-option: language-native serialization (Java&apos;s{" "}
          <code>Serializable</code>, Python&apos;s <code>pickle</code>). It
          chains you to one language, has a long history of remote-code-execution
          vulnerabilities (decoding can instantiate arbitrary classes), versions
          poorly, and performs poorly. Fine for scratch caches; never for
          anything that crosses a trust, language, or time boundary.
        </p>

        <H2 id="formats">Where structure lives: JSON → Avro</H2>
        <p>
          The clearest way to compare formats is to encode one record four ways
          and stare at the bytes. Watch where the <em>structure</em> — field
          names, types, boundaries — physically resides in each:
        </p>

        <BinaryEncodingBytes />

        <InTheWild
          title="Why your API sends IDs as strings"
          sources={[
            {
              label: "MDN: Number.MAX_SAFE_INTEGER",
              href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER",
            },
          ]}
        >
          <p>
            JSON has one number type, and JavaScript backs it with an IEEE 754
            double — integers are only exact up to 2⁵³ − 1
            (9,007,199,254,740,991). Snowflake-style 64-bit IDs exceed that, so
            a numeric ID round-tripped through a JS client can come back{" "}
            <em>off by a few</em> — silently. Hence the industry convention of
            duplicating large IDs as strings in JSON payloads. A one-line spec
            detail that has corrupted real production data.
          </p>
        </InTheWild>

        <H2 id="evolution">Evolving schemas without downtime</H2>
        <p>
          Tagged binary formats (Protocol Buffers, Thrift) turn compatibility
          into mechanics. Two mechanisms do all the work:{" "}
          <em>unknown tags can be skipped</em> (the wire type says how many bytes
          to jump — that&apos;s forward compatibility) and{" "}
          <em>missing tags get defaults</em> (that&apos;s backward compatibility,
          and why new fields must be optional). Run both directions, then watch
          the one mistake that silently corrupts:
        </p>

        <SchemaEvolutionLab />

        <CodeBlock
          title="an evolution in .proto, annotated"
          lang="proto"
          code={`message Player {              // v1            → v2
  string nick   = 1;          // unchanged: tag is the contract
  int32  level  = 2;
  string team   = 3;          // ADDED in v2: new tag, optional, has default
  // string region = 3;       // ✗ NEVER: reusing tag 3 misparses old data
  reserved 9; reserved "old_rank";   // tombstones for deleted fields
}`}
        />

        <InTheWild
          title="The rules, from the source"
          sources={[
            {
              label: "Protocol Buffers: Language Guide (proto3)",
              href: "https://protobuf.dev/programming-guides/proto3/",
            },
            {
              label: "Protocol Buffers: Proto Best Practices (dos & don'ts)",
              href: "https://protobuf.dev/best-practices/dos-donts/",
            },
          ]}
        >
          <p>
            Google&apos;s own guidance is blunt about the sharp edges: never
            re-use a tag number, almost never change a field&apos;s type, and
            don&apos;t add required fields — proto3 removed{" "}
            <code>required</code> from the language entirely after years of
            upgrade pain, because a required field makes every historical byte
            that lacks it unreadable. The <code>reserved</code> keyword exists
            precisely so the compiler can enforce the &ldquo;never reuse&rdquo;
            rule after a field is deleted.
          </p>
        </InTheWild>

        <H2 id="avro-registry">Avro and the schema registry</H2>
        <p>
          Avro takes the schema idea to its logical extreme:{" "}
          <em>nothing</em> structural on the wire — no names, no tags — so the
          reader must obtain the writer&apos;s schema and <em>resolve</em> it
          against its own. That sounds fragile until you see the machinery:
        </p>

        <AvroSchemaResolution />

        <InTheWild
          title="Schema resolution is in the spec, not a convention"
          sources={[
            {
              label: "Apache Avro specification (schema resolution)",
              href: "https://avro.apache.org/docs/1.11.1/specification/",
            },
          ]}
        >
          <p>
            Avro&apos;s specification defines resolution precisely: a reader{" "}
            <em>must</em> use the writer&apos;s schema to parse, fields are
            matched by name, writer-only fields are skipped, reader-only fields
            take their declared defaults, and a missing default is an error. The
            spec even defines a &ldquo;Parsing Canonical Form&rdquo; so two
            textually different schemas can be recognized as semantically
            identical — compatibility as a formal property of two documents, not
            a vibe.
          </p>
        </InTheWild>

        <H2 id="dataflow">Dataflow: databases, services, messages</H2>
        <p>
          The same compatibility physics applies at three boundaries, each with
          its own twist:
        </p>
        <H3>Through a database</H3>
        <p>
          The writer is your past; the reader is your future. Adding a column is
          cheap precisely because old rows are <em>not rewritten</em> — reads
          fill nulls/defaults, the relational equivalent of Avro&apos;s
          reader-side defaults. The subtle trap is an old process doing
          read-modify-write on a row containing fields it doesn&apos;t know: if
          its model drops unknowns, the write erases a newer field. (ORMs have
          caused exactly this.)
        </p>
        <H3>Through services: REST and RPC</H3>
        <p>
          Servers usually deploy before clients (or the reverse for mobile apps,
          where old clients linger for <em>years</em>), so requests need forward
          compatibility on the server and responses need backward compatibility
          on the client. RPC frameworks (gRPC on protobuf, Thrift) inherit their
          format&apos;s evolution rules. The deeper caution: RPC sells a network
          call dressed as a local function call, but a network call can time out,
          duplicate on retry, and return late — chapter 8&apos;s problems
          don&apos;t vanish because the syntax looks local. Treat the
          abstraction as a convenience, not a truth.
        </p>
        <H3>Through messages</H3>
        <p>
          A broker between sender and receiver buys: buffering when consumers
          lag, redelivery after crashes, one-to-many fan-out, and — crucially for
          this chapter — <em>decoupled deploy schedules</em>. The price: messages
          written before a deploy are consumed after it, so a queue is a time
          capsule of old schema versions. Same rules, longer time horizon.
        </p>

        <InTheWild
          title="gRPC: the tag rules, industrialized"
          sources={[{ label: "gRPC — grpc.io", href: "https://grpc.io/" }]}
        >
          <p>
            gRPC — the most widely deployed modern RPC framework — is
            essentially Protocol Buffers plus HTTP/2 plumbing: services and
            messages are declared in <code>.proto</code> files, and every API
            evolution question (can I add this field? rename this? retire that?)
            reduces to the tag rules from this chapter. Choosing gRPC is, among
            other things, choosing to let a compiler enforce your compatibility
            discipline.
          </p>
        </InTheWild>

        <H2 id="interview-prep">Interview prep</H2>

        <KeyTakeaways
          items={[
            <>
              Two promises, both required by rolling upgrades and persistent
              data: <strong>backward</strong> (new code reads old data) and{" "}
              <strong>forward</strong> (old code reads new data) compatibility.
            </>,
            <>
              Formats differ by where structure lives: in every record (JSON,
              MessagePack), in field numbers + schema (Protobuf/Thrift), or in
              the schema alone (Avro). Placement determines size{" "}
              <em>and</em> evolution mechanics.
            </>,
            <>
              Protobuf/Thrift evolution = tag discipline: add optional fields
              with new numbers; skip unknown tags via wire types; never reuse or
              renumber; <code>reserved</code> deleted tags.
            </>,
            <>
              Avro evolution = writer/reader schema resolution: match by name,
              skip extras, default the gaps; schemas delivered via file headers
              or a registry ID per message, with compatibility enforced at
              registration.
            </>,
            <>
              Every boundary is an evolution boundary — database rows, RPC
              calls, queued messages, archived files — and queues/archives
              stretch the time horizon furthest.
            </>,
          ]}
        />

        <CheatTable
          caption="Cheat sheet · format trade-offs"
          head={[
            "Format",
            "Schema?",
            "Relative size",
            "Evolution mechanism",
            "Sweet spot",
          ]}
          rows={[
            [
              "JSON / XML / CSV",
              "Optional, external",
              "Largest",
              "Convention + tolerant readers (fragile)",
              "Public APIs, human-edited config, interop",
            ],
            [
              "Binary JSON (MessagePack, BSON…)",
              "No (self-describing)",
              "Smaller, not small",
              "Same as JSON",
              "Drop-in JSON compression inside one system",
            ],
            [
              "Thrift / Protocol Buffers",
              "Required (.proto/.thrift, code-gen)",
              "Small",
              "Field tags: skip unknown, default missing",
              "RPC and service contracts (gRPC)",
            ],
            [
              "Avro",
              "Required (writer + reader schemas)",
              "Smallest",
              "Name-based resolution + defaults; registry/file header",
              "Data pipelines, Kafka topics, lake files; generated schemas",
            ],
          ]}
        />

        <CheatTable
          caption="Cheat sheet · is this change safe?"
          head={[
            "Change",
            "Backward (new reads old)",
            "Forward (old reads new)",
            "Notes",
          ]}
          rows={[
            [
              "Add optional field w/ default",
              "✓",
              "✓",
              "The only fully safe add; new tag (PB) / default (Avro) required",
            ],
            [
              "Add required field",
              "✗",
              "—",
              "Old data lacks it → unreadable; proto3 abolished required",
            ],
            [
              "Remove optional field",
              "✓",
              "✓ (readers default it)",
              "PB: reserve the tag forever; Avro: only if it had a default",
            ],
            [
              "Rename field",
              "PB ✓ (numbers match)",
              "PB ✓",
              "Avro ✗ unless aliases declared — names ARE the wire contract",
            ],
            [
              "Reuse a deleted tag number",
              "✗✗",
              "✗✗",
              "Silent misparse of historical data — the cardinal sin",
            ],
            [
              "Change field type",
              "Usually ✗",
              "Usually ✗",
              "Few blessed widenings (e.g. int32→int64 with care); assume breaking",
            ],
          ]}
        />

        <InterviewQA
          items={[
            {
              q: "Define backward and forward compatibility, and explain why a rolling upgrade needs both.",
              a: (
                <p>
                  Backward: code N+1 reads data written by code N. Forward: code
                  N reads data written by code N+1. During a rolling deploy both
                  versions run simultaneously, and either may write data the
                  other reads — through the database, RPC responses, or queued
                  messages. A mobile fleet makes it starker: clients may lag the
                  server by years, so server responses need backward-compatible
                  readers on ancient clients, and old clients&apos; requests must
                  remain parseable forever.
                </p>
              ),
            },
            {
              q: "How does an old protobuf reader survive a field it's never seen?",
              a: (
                <p>
                  Every field is prefixed by a tag encoding (field number, wire
                  type). An unknown number can&apos;t be interpreted — but the
                  wire type still says how to <em>skip</em> it: varint → read to
                  terminator; length-delimited → read length, jump. The reader
                  continues parsing and should retain the unknown bytes so a
                  re-save doesn&apos;t destroy a newer field. That skip rule is
                  the entire foundation of forward compatibility in tagged
                  formats.
                </p>
              ),
            },
            {
              q: "Why is reusing a retired field number so dangerous, and what's the safeguard?",
              a: (
                <p>
                  The number is the wire contract. Historical bytes where tag 3
                  was a string still exist in databases, queues, and backups; a
                  new schema where tag 3 is an int will parse those bytes as an
                  int — silent garbage, no error, possibly persisted onward. The
                  safeguard is <code>reserved 3;</code> (and reserving the name),
                  making the compiler reject any future reuse. Process safeguard:
                  schema changes go through review precisely because this failure
                  is invisible in testing against fresh data.
                </p>
              ),
            },
            {
              q: "Protobuf matches by number, Avro by name. What does each buy?",
              a: (
                <p>
                  Numbers (PB): names are free to change, the wire stays tiny
                  and stable, but humans must allocate and guard numbers forever
                  — fits hand-maintained service contracts. Names (Avro): no
                  number bookkeeping, so schemas can be <em>generated</em> from a
                  database table or class definition on every export — fits
                  pipelines dumping evolving relational data — but renames now
                  break compatibility unless you declare aliases, and the reader
                  needs the writer&apos;s schema delivered somehow.
                </p>
              ),
            },
            {
              q: "You're putting events on Kafka. How does each tiny message get decoded correctly across schema versions?",
              a: (
                <p>
                  Embedding a schema per message is absurd, so: prefix each
                  message with a small schema ID; producers register schemas with
                  a registry and get IDs; consumers fetch-and-cache by ID, then
                  resolve the writer&apos;s schema against their own reader
                  schema. The registry doubles as gatekeeper: configured with a
                  compatibility mode (backward, forward, full), it rejects an
                  incompatible schema at <em>publish</em> time — turning a 3am
                  consumer crash into a failed CI step.
                </p>
              ),
            },
            {
              q: "When is JSON the right answer despite everything in this chapter?",
              a: (
                <p>
                  Public-facing APIs (universal tooling, curl-ability, no codegen
                  burden on unknown clients), config and documents humans edit,
                  low-volume internal endpoints where debuggability beats bytes,
                  and anywhere organizational friction of schema distribution
                  exceeds the cost of verbosity. Mitigations when you stay: JSON
                  Schema validation at boundaries, strings for 64-bit IDs,
                  explicit version fields, and tolerant-reader discipline (ignore
                  unknown keys, never require new ones).
                </p>
              ),
            },
            {
              q: "An old service does read-modify-write on rows that new code added a field to. What's the risk?",
              a: (
                <p>
                  The old process decodes the row into a model that doesn&apos;t
                  know the new field; if it then writes the <em>whole</em> model
                  back, the unknown field is erased — a forward-compatibility
                  failure at the database boundary. Defenses: update only the
                  columns you touched (targeted UPDATE, not object replace), keep
                  unknown fields opaque-but-preserved in the model, or version
                  rows and reject blind overwrites (CAS — chapter 7&apos;s
                  lost-update toolbox reappears).
                </p>
              ),
            },
            {
              q: "Why do message queues stretch compatibility requirements further than RPC?",
              a: (
                <p>
                  An RPC exists for milliseconds: writer and reader versions are
                  at most one deploy apart. A queued message may be consumed
                  minutes, days — after an outage, weeks — later, and dead-letter
                  replays resurrect the truly ancient. Every message in flight is
                  a snapshot of whatever schema version produced it, so consumers
                  effectively face an archive, not a peer. Hence registries with
                  enforced compatibility windows matter most exactly here.
                </p>
              ),
            },
          ]}
        />

        <Misconceptions
          items={[
            {
              myth: "JSON is schemaless, so I don't have schema-evolution problems.",
              reality: (
                <>
                  The schema didn&apos;t disappear — it moved into every
                  reader&apos;s assumptions, unchecked. Evolution problems remain
                  (renamed keys, changed types, missing fields) but now fail at
                  runtime in consumers instead of at build/publish time.
                  Schema-on-read is a deferral, not an exemption.
                </>
              ),
            },
            {
              myth: "Binary formats are about saving bytes.",
              reality: (
                <>
                  Size is the visible win; the structural wins are real types
                  (int64 vs double, bytes without Base64), generated code, and —
                  above all — <em>machine-checkable compatibility</em>: a
                  compiler or registry can prove an evolution safe before it
                  ships.
                </>
              ),
            },
            {
              myth: "RPC makes a remote call behave like a local function call.",
              reality: (
                <>
                  The syntax matches; the semantics can&apos;t. A network call
                  may time out with unknown outcome, duplicate on retry, and
                  reorder — none of which a local call does. Good RPC usage
                  embraces this: idempotency, deadlines, explicit retries
                  (chapter 8 wearing an API).
                </>
              ),
            },
            {
              myth: "We can clean up the schema by renumbering/compacting old fields.",
              reality: (
                <>
                  Renumbering is semantically identical to reuse: every byte
                  ever written under the old numbering becomes misparseable.
                  Schemas accrete; tags are append-only real estate. The hygienic
                  move is <code>reserved</code> tombstones, not renumbering.
                </>
              ),
            },
          ]}
        />
      </div>
    </DDIAThemeProvider>
  );
}
