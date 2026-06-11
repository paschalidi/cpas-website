import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Badge, Chip } from "./viz";

/**
 * Two philosophies of messaging: the destructive-read queue (deliver, ack,
 * delete) vs the durable log (append, offset, replay).
 */

const steps = [
  {
    caption: (
      <>
        Producers and consumers, with a broker between them — so far so good.
        The fork in the road is what happens to a message <em>after
        delivery</em>. Philosophy 1 (classic queues, AMQP-style): the message is
        a <strong>task</strong> — hand it to exactly one worker, and when they
        ack, <strong>delete it</strong>.
      </>
    ),
  },
  {
    caption: (
      <>
        The queue load-balances: each new order goes to whichever worker is
        free — perfect when messages are expensive jobs (render this video,
        send this email) and you want to add workers to drain a backlog
        message-by-message.
      </>
    ),
  },
  {
    caption: (
      <>
        Crash handling: worker 2 dies mid-task. The unacked message is{" "}
        <strong>redelivered</strong> to worker 1 — no loss, but note the side
        effects: the message may now be processed <em>twice</em> (it might have
        half-completed), and redelivery can reorder it relative to its
        neighbors. Queues trade ordering for flexible load balancing.
      </>
    ),
  },
  {
    caption: (
      <>
        And the defining property: acked messages are <strong>gone</strong>.
        A consumer that joins today sees only tomorrow&apos;s messages;
        yesterday is unrecoverable. Reading is <em>destructive</em>. For task
        distribution that&apos;s exactly right — a completed job needs no
        memorial. For <em>data</em>, it&apos;s a dealbreaker.
      </>
    ),
  },
  {
    caption: (
      <>
        Philosophy 2: the <strong>log</strong>. Messages are appended to a
        partitioned, ordered, durable file and <em>never deleted on read</em>.
        A consumer is just a pointer — an <strong>offset</strong> — advancing
        through each partition. Delivery is a read, and reads destroy nothing.
      </>
    ),
  },
  {
    caption: (
      <>
        Scaling reads: a <strong>consumer group</strong> divides the{" "}
        <em>partitions</em> (not individual messages) among its members — each
        partition has exactly one reader per group, so order within a partition
        is preserved end-to-end. Checkpointing is trivial: persist one number
        per partition. Crash recovery: resume from the last committed offset.
      </>
    ),
  },
  {
    caption: (
      <>
        The superpower: <strong>replay</strong>. An analytics team shows up
        three months later, registers a new group, sets offsets to 0 — and
        receives the entire history at disk speed, without disturbing anyone
        else. A slow consumer doesn&apos;t block the broker or its peers; it
        just lags, visibly (offset lag is your health metric). A bug in a
        consumer? Fix it, rewind, reprocess. The log is a time machine.
      </>
    ),
  },
  {
    caption: (
      <>
        Choosing: <strong>queue</strong> when messages are independent expensive
        tasks, per-message ack/retry matters, and history doesn&apos;t —{" "}
        <strong>log</strong> when messages are <em>events</em> (facts that
        happened), order per key matters, multiple teams will consume the same
        stream, and replay is valuable. Chapter 11&apos;s thesis: for data
        infrastructure, events beat tasks — the rest of these notes build on
        the log.
      </>
    ),
  },
];

export default function LogVsQueue() {
  return (
    <AnimationShell
      title="Log vs queue: two kinds of messaging"
      subtitle="delete-on-ack tasks vs replayable, ordered events"
      steps={steps}
      interval={3400}
    >
      {(step) => {
        const queueMode = step <= 3;
        const crash = step === 2;
        const replay = step >= 6;

        return (
          <svg viewBox="0 0 720 310" className="h-auto w-full" role="img" aria-label="Queue vs log messaging diagram">
            <VizDefs />

            {queueMode ? (
              <g>
                <Txt x={16} y={30} size={11} mono weight={700} tone="acc">PHILOSOPHY 1 · THE QUEUE (delete on ack)</Txt>
                <NodeBox x={16} y={60} w={130} h={50} label="producer" sub="orders" tone="default" />
                <rect x={210} y={56} width={260} height={58} rx={10} fill="var(--bg)" stroke="var(--line-strong)" />
                <Txt x={224} y={76} size={9.5} mono weight={700} tone="mut">QUEUE</Txt>
                {["#7", "#8", "#9"].map((m, i) => (
                  <Chip key={m} cx={260 + i * 56} cy={96} label={m} tone={crash && i === 0 ? "warn" : "info"} w={44} h={24} />
                ))}
                <Arrow x1={146} y1={85} x2={206} y2={85} tone="acc" show />

                <NodeBox x={540} y={28} w={164} h={50} label="worker 1" sub={crash ? "redelivered #6 (dup?)" : step >= 1 ? "got #5 → ack → deleted" : ""} tone={crash ? "warn" : "ok"} />
                <NodeBox x={540} y={140} w={164} h={50} label="worker 2" sub={crash ? "CRASHED mid-#6" : step >= 1 ? "got #6, working…" : ""} tone={crash ? "bad" : "default"} fillTone={crash ? "bad" : undefined} />
                <Arrow x1={470} y1={76} x2={536} y2={56} tone="ok" show={step >= 1} label="deliver" />
                <Arrow x1={470} y1={100} x2={536} y2={158} tone={crash ? "bad" : "acc"} show={step >= 1} label={crash ? "✗" : "deliver"} />
                <Arrow x1={540} y1={170} x2={500} y2={80} tone="warn" show={crash} dashed label="unacked → redeliver to w1" curve={40} />

                <g className="tr" opacity={step === 1 ? 1 : 0}>
                  <Badge x={360} y={210} label="load-balanced: any free worker takes the next message" tone="info" />
                </g>
                <g className="tr" opacity={crash ? 1 : 0}>
                  <Badge x={360} y={210} label="no loss — but duplicates + reordering are now possible" tone="warn" />
                </g>
                <g className="tr" opacity={step === 3 ? 1 : 0}>
                  <Txt x={250} y={150} size={26} weight={800} tone="bad" anchor="middle">✕</Txt>
                  <Txt x={306} y={150} size={26} weight={800} tone="bad" anchor="middle">✕</Txt>
                  <Badge x={360} y={210} label="acked = deleted: a new consumer sees only the future" tone="bad" />
                  <Txt x={360} y={244} size={10.5} anchor="middle" tone="mut">
                    right for jobs · wrong for data
                  </Txt>
                </g>
              </g>
            ) : (
              <g>
                <Txt x={16} y={30} size={11} mono weight={700} tone="acc">PHILOSOPHY 2 · THE LOG (append, offset, replay)</Txt>

                {/* two partitions */}
                {[0, 1].map((p) => (
                  <g key={p}>
                    <Txt x={16} y={78 + p * 64} size={9.5} mono tone="mut">{`partition ${p}`}</Txt>
                    <rect x={90} y={58 + p * 64} width={400} height={40} rx={8} fill="var(--bg)" stroke="var(--line-strong)" />
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <g key={i}>
                        <rect x={94 + i * 56} y={62 + p * 64} width={52} height={32} rx={5} fill="none" stroke="var(--line-strong)" opacity={0.7} />
                        <text x={120 + i * 56} y={78 + p * 64} textAnchor="middle" dominantBaseline="central" fontSize="9.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--ink)">{`e${i}`}</text>
                      </g>
                    ))}
                    {/* group A offset */}
                    <g className="tr" opacity={step >= 5 ? 1 : 0}>
                      <line x1={94 + 5 * 56} y1={56 + p * 64} x2={94 + 5 * 56} y2={100 + p * 64} stroke="var(--accent)" strokeWidth={2.5} className="tr" />
                      <Txt x={94 + 5 * 56} y={48 + p * 64} size={8.5} mono tone="acc" anchor="middle">grp A @5</Txt>
                    </g>
                    {/* group B offset at 0 */}
                    <g className="tr" opacity={replay ? 1 : 0}>
                      <line x1={94} y1={56 + p * 64} x2={94} y2={100 + p * 64} stroke="var(--ok)" strokeWidth={2.5} />
                      <Txt x={110} y={110 + p * 64} size={8.5} mono tone="ok">grp B @0 → replaying history</Txt>
                    </g>
                  </g>
                ))}

                <NodeBox x={540} y={50} w={164} h={46} label="group A · consumer 1" sub="owns partition 0" tone="acc" />
                <NodeBox x={540} y={112} w={164} h={46} label="group A · consumer 2" sub="owns partition 1" tone="acc" />
                <Arrow x1={490} y1={78} x2={536} y2={72} tone="acc" show />
                <Arrow x1={490} y1={142} x2={536} y2={136} tone="acc" show />
                <NodeBox x={540} y={196} w={164} h={46} label="group B · analytics" sub={replay ? "reading from offset 0" : "(joins later)"} tone={replay ? "ok" : "mut"} dim={!replay} />
                <Arrow x1={120} y1={166} x2={536} y2={216} tone="ok" show={replay} curve={30} label="full history, disk-speed" />

                <g className="tr" opacity={step === 4 ? 1 : 0}>
                  <Badge x={300} y={210} label="reads delete nothing — a consumer is just an offset" tone="ok" />
                </g>
                <g className="tr" opacity={step === 5 ? 1 : 0}>
                  <Badge x={300} y={230} label="partitions ÷ group members · order preserved per partition · checkpoint = one number" tone="info" />
                </g>
                <g className="tr" opacity={step === 7 ? 1 : 0}>
                  <rect x={16} y={244} width={688} height={54} rx={10} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.3} />
                  <Txt x={32} y={264} size={10.5}>
                    queue: independent expensive tasks · per-message retry · history disposable
                  </Txt>
                  <Txt x={32} y={284} size={10.5} tone="acc">
                    log: events as facts · per-key order · many independent readers · replay = superpower
                  </Txt>
                </g>
                <g className="tr" opacity={step === 6 ? 1 : 0}>
                  <Badge x={300} y={250} label="slow consumer = visible lag, not broker pressure · bug? rewind & reprocess" tone="ok" />
                </g>
              </g>
            )}
          </svg>
        );
      }}
    </AnimationShell>
  );
}
