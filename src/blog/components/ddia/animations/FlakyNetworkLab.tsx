
import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge, Packet } from "./viz";

/**
 * Unreliable network simulator: a payment request, a lost ACK, a timeout,
 * a retry, a double charge — and the idempotency-key fix.
 */

const steps = [
  {
    caption: (
      <>
        A checkout service asks a payment service to charge £30. Between them: a
        network that may <strong>lose, delay, or reorder</strong> any message — and
        gives no notification when it does. That&apos;s the only honest model of a
        network.
      </>
    ),
  },
  {
    caption: (
      <>
        The request arrives. Payments charges the card and writes the ledger:{" "}
        <strong>charged £30</strong>. From the server&apos;s perspective, complete
        success.
      </>
    ),
  },
  {
    caption: (
      <>
        The <em>response</em> is dropped on the way back. Crucial asymmetry: the
        sender can&apos;t distinguish &ldquo;request lost&rdquo;, &ldquo;server
        crashed&rdquo;, &ldquo;server slow&rdquo;, and &ldquo;reply lost&rdquo; — all
        four look identical: silence.
      </>
    ),
  },
  {
    caption: (
      <>
        Checkout&apos;s timeout fires. What now? Give up — maybe the customer
        wasn&apos;t charged, you lost a sale. Retry — maybe they <em>were</em>{" "}
        charged, and you&apos;re about to do it again. Timeouts detect{" "}
        <em>silence</em>, not <em>state</em>.
      </>
    ),
  },
  {
    caption: (
      <>
        Checkout retries. Payments — which has no idea this is a retry — charges
        again. Ledger: <strong>£60</strong>. The customer support ticket writes
        itself. The network didn&apos;t even misbehave badly: one lost packet.
      </>
    ),
  },
  {
    caption: (
      <>
        The fix: make the operation <strong>idempotent</strong> — safe to apply
        twice. Checkout attaches a unique <code>Idempotency-Key</code> (generated
        once per logical payment, reused across retries).
      </>
    ),
  },
  {
    caption: (
      <>
        Payments stores results keyed by that ID. Fresh key → perform the charge,
        record <code>key → result</code>. The first attempt charges £30 and records
        it. (Reply lost again — networks gonna network.)
      </>
    ),
  },
  {
    caption: (
      <>
        The retry arrives with the <em>same key</em>. Payments recognizes it,
        performs <strong>no second charge</strong>, and replays the stored result.
        Ledger: £30. Retries are now free — which means timeouts can be aggressive
        and the system can be impatient <em>safely</em>.
      </>
    ),
  },
];

export default function FlakyNetworkLab() {
  return (
    <AnimationShell
      title="Unreliable network: retry → double charge → idempotency"
      subtitle="one lost packet is all it takes"
      steps={steps}
    >
      {(step) => {
        const phase2 = step >= 5; // idempotency era
        const ledger =
          step <= 0 ? "—" : step <= 3 ? "£30" : step === 4 ? "£60 ✗✗" : step === 5 ? "—" : "£30 ✓";

        // packet position
        let pkt: { x: number; y: number; show: boolean; tone: "acc" | "bad" | "ok" } = {
          x: 0,
          y: 0,
          show: false,
          tone: "acc",
        };
        if (step === 1) pkt = { x: 360, y: 96, show: true, tone: "acc" };
        if (step === 2) pkt = { x: 380, y: 150, show: true, tone: "bad" }; // dropped reply
        if (step === 4) pkt = { x: 360, y: 96, show: true, tone: "bad" };
        if (step === 6) pkt = { x: 360, y: 96, show: true, tone: "acc" };
        if (step === 7) pkt = { x: 360, y: 96, show: true, tone: "ok" };

        return (
          <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label="Unreliable network and idempotency diagram">
            <VizDefs />

            <NodeBox x={28} y={64} w={160} h={64} label="checkout" sub={step >= 3 && step < 5 ? "timeout! retry?" : phase2 ? "sends Idempotency-Key" : "awaiting reply…"} tone={step >= 3 && step < 5 ? "warn" : "default"} />
            <NodeBox x={532} y={64} w={160} h={64} label="payments" sub={phase2 ? "dedupes by key" : "charges blindly"} tone={phase2 ? "ok" : "default"} />

            {/* the network cloud */}
            <g>
              <rect x={232} y={56} width={256} height={80} rx={40} fill="var(--bg)" stroke="var(--line-strong)" strokeDasharray="6 5" />
              <Txt x={360} y={100} size={11} anchor="middle" tone="mut" weight={600}>
                network: may drop / delay / reorder
              </Txt>
            </g>

            {/* request arrows */}
            <Arrow x1={188} y1={84} x2={532} y2={84} tone={step === 4 ? "bad" : "acc"} show={step >= 1 && step !== 5} label={step === 4 ? "retry: charge £30" : step >= 6 ? `charge £30 · key=K7` : "charge £30"} curve={26} />

            {/* reply arrow — dropped at the X */}
            <g className="tr" opacity={step === 2 || step === 6 ? 1 : 0}>
              <Arrow x1={532} y1={112} x2={400} y2={112} tone="mut" show label="200 OK" />
              <Txt x={388} y={117} size={16} tone="bad" weight={800} anchor="middle">
                ✕
              </Txt>
              <Txt x={388} y={134} size={9.5} tone="bad" anchor="middle">
                reply lost
              </Txt>
            </g>
            {/* successful replay reply at final step */}
            <Arrow x1={532} y1={112} x2={188} y2={112} tone="ok" show={step === 7} label="200 OK (stored result)" curve={-26} />

            <Packet cx={pkt.x} cy={pkt.y} show={pkt.show} tone={pkt.tone} />

            {/* timeout clock */}
            <g className="tr" opacity={step === 3 ? 1 : 0}>
              <circle cx={108} cy={160} r={16} fill="none" stroke="var(--warn)" strokeWidth={2} />
              <line x1={108} y1={160} x2={108} y2={149} stroke="var(--warn)" strokeWidth={2} />
              <line x1={108} y1={160} x2={117} y2={163} stroke="var(--warn)" strokeWidth={2} />
              <Txt x={134} y={164} size={10.5} tone="warn" weight={700}>
                timeout — but is the charge done?
              </Txt>
            </g>

            {/* payments ledger */}
            <g>
              <rect x={532} y={168} width={160} height={88} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
              <Txt x={548} y={190} size={10} weight={700} mono tone="acc">
                LEDGER
              </Txt>
              <Txt x={548} y={214} size={13} mono tone={step === 4 ? "bad" : "ink"} weight={700}>
                charged: {ledger}
              </Txt>
              <Txt x={548} y={238} size={10} mono show={phase2 && step >= 6}>
                seen keys: {step >= 6 ? "K7 → £30" : ""}
              </Txt>
            </g>

            <Badge x={360} y={216} label="DOUBLE CHARGE" tone="bad" show={step === 4} />
            <Badge x={360} y={216} label="retry deduped ✓" tone="ok" show={step === 7} />

            {/* phase label */}
            <Txt x={28} y={32} size={12} weight={700} tone="ink">
              {phase2 ? "B · with idempotency keys" : "A · naive request/retry"}
            </Txt>

            {/* footer truth */}
            <g className="tr" opacity={step === 3 ? 1 : 0}>
              <Txt x={28} y={282} size={10.5} tone="warn">
                silence is ambiguous: request lost ≡ server dead ≡ server slow ≡ reply lost
              </Txt>
            </g>
            <g className="tr" opacity={step === 7 ? 1 : 0}>
              <Txt x={28} y={282} size={10.5} tone="ok">
                exactly-once <em>effect</em> = at-least-once delivery + idempotent processing
              </Txt>
            </g>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
