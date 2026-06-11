import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge } from "./viz";

/**
 * The end-to-end argument, animated: every layer dedupes within its own
 * scope, and the duplicate survives anyway — until the operation itself
 * carries an identity.
 */

const steps = [
  {
    caption: (
      <>
        A user taps <strong>PAY</strong>. The Wi-Fi hiccups; the spinner spins;
        they tap again (or the client auto-retries). Somewhere below, a stack of
        reliable-sounding layers — TCP, load balancer, service, message broker,
        database — each promises some flavor of &ldquo;once&rdquo;. Let&apos;s
        audit who actually keeps it.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>TCP</strong> dedupes retransmitted packets and orders bytes —
        flawlessly, <em>within one connection</em>. But the user&apos;s retry
        opened a <em>new</em> connection. TCP&apos;s guarantee ended at the
        socket; two distinct, perfectly-delivered requests march upward.
      </>
    ),
  },
  {
    caption: (
      <>
        The first request reached the service, which charged the card — and the{" "}
        <em>response</em> died on the way back. From the client&apos;s side:
        indistinguishable from never-arrived (chapter 8&apos;s ambiguity). The
        retry is a second, fully legitimate-looking request. The load balancer
        even helpfully routes it to a different healthy instance.
      </>
    ),
  },
  {
    caption: (
      <>
        Suppose the service publishes a <code>charge</code> event to a broker
        with exactly-once producing: sequence numbers dedupe <em>broker-side
        retries</em> of the same send. Immaculate — and irrelevant: our two
        requests became two <em>distinct</em> messages with different sequence
        numbers. Deduped perfectly, both delivered.
      </>
    ),
  },
  {
    caption: (
      <>
        Audit result: every layer kept its promise, scoped to itself —
        and the duplicate sailed through, because it was born{" "}
        <strong>above all of them</strong>, at the moment of user intent. No
        composition of hop-local guarantees adds up to an operation-level one.
      </>
    ),
  },
  {
    caption: (
      <>
        This is the <strong>end-to-end argument</strong> (Saltzer, Reed &amp;
        Clark, 1984): functions like duplicate suppression can only be
        completely implemented <em>at the endpoints</em>, with the application&apos;s
        own knowledge; lower layers can help performance, never own
        correctness. The fix, therefore: the <em>client</em> mints an{" "}
        <strong>operation ID</strong> the instant the user means &ldquo;pay
        once&rdquo; — and it rides every hop.
      </>
    ),
  },
  {
    caption: (
      <>
        At the end of the chain, the ID becomes a database fact:{" "}
        <code>INSERT INTO payments (op_id, …) — op_id UNIQUE</code>. Request
        two arrives, insert conflicts, handler returns the original result.
        Retries are now <em>safe at every layer</em>, because exactly-once
        lives where the meaning lives. Chapter 8&apos;s idempotency key,
        chapter 7&apos;s unique constraint — composed into an architecture
        principle: <em>the request ID is the truth; everything below is
        transport.</em>
      </>
    ),
  },
];

const LANES = [
  { x: 16, label: "client" },
  { x: 168, label: "TCP / LB" },
  { x: 320, label: "service ×2" },
  { x: 472, label: "broker" },
  { x: 600, label: "database" },
];

export default function EndToEndDedup() {
  return (
    <AnimationShell
      title="The end-to-end argument, animated"
      subtitle="every hop dedupes; the duplicate survives anyway"
      steps={steps}
      interval={3500}
    >
      {(step) => {
        const retry = step >= 1;
        const charged = step >= 2;
        const broker = step >= 3;
        const fixed = step >= 5;
        const landed = step >= 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="End-to-end deduplication diagram">
            <VizDefs />

            {/* lanes */}
            {LANES.map((l) => (
              <g key={l.label}>
                <Txt x={l.x + 52} y={30} size={9.5} mono tone="mut" anchor="middle">{l.label}</Txt>
                <line x1={l.x + 52} y1={38} x2={l.x + 52} y2={fixed ? 200 : 240} stroke="var(--line-strong)" strokeDasharray="2 4" opacity={0.6} />
              </g>
            ))}

            <NodeBox x={16} y={48} w={104} h={46} label="user taps" sub={retry ? "…taps again" : "PAY"} tone={retry ? "warn" : "acc"} />

            {/* request 1 */}
            <Arrow x1={120} y1={64} x2={216} y2={64} tone="acc" show label="req 1" />
            <Arrow x1={224} y1={64} x2={368} y2={64} tone="acc" show />
            <g className="tr" opacity={charged ? 1 : 0}>
              <Badge x={372} y={48} label="charged ✓" tone="ok" />
              <Arrow x1={368} y1={84} x2={230} y2={84} tone="bad" show dashed label="response lost ✗" labelDy={12} />
            </g>

            {/* request 2 (retry) */}
            <g className="tr" opacity={retry ? 1 : 0}>
              <Arrow x1={120} y1={120} x2={216} y2={120} tone="warn" show label="req 2 (new conn)" labelDy={12} />
              <Arrow x1={224} y1={120} x2={368} y2={120} tone="warn" show label={charged ? "→ other instance" : ""} labelDy={12} />
            </g>
            <g className="tr" opacity={step === 1 ? 1 : 0}>
              <Badge x={220} y={156} label="TCP deduped its packets ✓ — per connection only" tone="info" />
            </g>

            {/* broker hop */}
            <g className="tr" opacity={broker ? 1 : 0}>
              <Arrow x1={372} y1={64} x2={520} y2={64} tone="acc" show label="msg A (seq 12)" />
              <Arrow x1={372} y1={120} x2={520} y2={120} tone="warn" show label="msg B (seq 13)" labelDy={12} />
              <Badge x={524} y={92} label="broker deduped resends ✓ — A and B are 'different'" tone="info" />
            </g>

            {/* the verdict */}
            <g className="tr" opacity={step === 4 ? 1 : 0}>
              <rect x={16} y={196} width={688} height={56} rx={10} fill="var(--bg)" stroke="var(--bad)" strokeWidth={1.4} />
              <Txt x={32} y={216} size={10.5} tone="bad" weight={650}>
                every layer honest, every guarantee kept — duplicate delivered twice anyway
              </Txt>
              <Txt x={32} y={236} size={10.5}>
                it was born above all of them: two expressions of one human intent
              </Txt>
            </g>

            {/* the fix */}
            <g className="tr" opacity={fixed ? 1 : 0}>
              <rect x={16} y={206} width={420} height={42} rx={8} fill="var(--bg)" stroke="var(--ok)" strokeWidth={1.4} />
              <Txt x={30} y={222} size={9} mono weight={700} tone="ok">THE END-TO-END FIX</Txt>
              <Txt x={30} y={238} size={10} mono>op_id = "pay-7f3a…" minted at tap · carried on EVERY hop</Txt>
              <Badge x={130} y={92} label="op_id rides along" tone="ok" />
            </g>
            <g className="tr" opacity={landed ? 1 : 0}>
              <NodeBox x={560} y={150} w={148} h={56} label="payments table" sub="op_id UNIQUE" tone="ok" />
              <Arrow x1={524} y1={70} x2={600} y2={146} tone="ok" show label="insert op_id ✓" />
              <Arrow x1={524} y1={126} x2={616} y2={150} tone="warn" show dashed label="conflict → return original" labelDy={14} />
              <rect x={16} y={262} width={688} height={36} rx={8} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.2} />
              <Txt x={32} y={284} size={10.5} tone="acc" weight={600}>
                exactly-once lives where the meaning lives — the request ID is the truth; everything below is transport
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
