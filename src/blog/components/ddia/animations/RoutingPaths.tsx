import AnimationShell from "./AnimationShell";
import { VizDefs, NodeBox, Arrow, Txt, Packet } from "./viz";

/**
 * Request routing: a client wants key "grace" (lives on node 2).
 * Three discovery strategies, shown one per pair of steps.
 */

const steps = [
  {
    caption: (
      <>
        A client wants to read key <code>grace</code>, which lives on{" "}
        <strong>node 2</strong> — but the client doesn&apos;t know that. Someone has to
        answer the question <em>&quot;which node owns this key right now?&quot;</em> This is
        service discovery for data.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Strategy 1 — ask any node.</strong> The client connects to a random
        node (node 0). Every node knows the partition map, so node 0 forwards the
        request to node 2 and relays the answer back.
      </>
    ),
  },
  {
    caption: (
      <>
        Cost: an extra network hop on misses, and every node must keep its view of the
        map fresh (often via gossip). Benefit: dumb clients, no extra infrastructure.
        Cassandra and Riak work this way — any node can be the coordinator.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Strategy 2 — routing tier.</strong> All requests go to a
        partition-aware proxy that owns the map and forwards each request to the right
        node. Clients stay simple; the map lives in one place.
      </>
    ),
  },
  {
    caption: (
      <>
        Cost: the proxy is an extra hop on <em>every</em> request and a component you
        must scale and keep highly available. This is the shape of MongoDB&apos;s{" "}
        <code>mongos</code> router in a sharded cluster.
      </>
    ),
  },
  {
    caption: (
      <>
        <strong>Strategy 3 — partition-aware client.</strong> The client library itself
        caches the partition map and dials node 2 directly. Zero extra hops — the
        fastest path.
      </>
    ),
  },
  {
    caption: (
      <>
        Cost: fat clients in every language, and a cache that can go stale mid-rebalance
        (a miss usually returns a redirect plus a fresh map). Either way, something
        authoritative must hold the truth — often a coordination service like
        ZooKeeper, which nodes update and routers/clients watch.
      </>
    ),
  },
];

export default function RoutingPaths() {
  return (
    <AnimationShell title="Request routing: three ways to find the data" subtitle='read key "grace" → node 2' steps={steps}>
      {(step) => {
        const nodesY = 60;
        const nodeX = [430, 430, 430];
        const ny = (i: number) => nodesY + i * 76;

        const s1 = step >= 1 && step <= 2;
        const s2 = step >= 3 && step <= 4;
        const s3 = step >= 5;

        // packet position per phase
        let pkt = { x: 90, y: 160, show: false };
        if (s1) pkt = step === 1 ? { x: 470, y: ny(0) + 22, show: true } : { x: 470, y: ny(2) + 22, show: true };
        if (s2) pkt = step === 3 ? { x: 280, y: 160, show: true } : { x: 470, y: ny(2) + 22, show: true };
        if (s3) pkt = step === 5 ? { x: 470, y: ny(2) + 22, show: true } : { x: 470, y: ny(2) + 22, show: true };

        return (
          <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label="Request routing strategies diagram">
            <VizDefs />

            {/* client */}
            <NodeBox x={30} y={134} w={120} h={52} label="client" sub='get("grace")' tone="acc" />

            {/* routing tier (strategy 2 only) */}
            <g className="tr" opacity={s2 ? 1 : 0.12}>
              <NodeBox x={230} y={134} w={110} h={52} label="router" sub="owns the map" tone={s2 ? "info" : "mut"} />
            </g>

            {/* nodes */}
            {[0, 1, 2].map((i) => (
              <NodeBox
                key={i}
                x={nodeX[i]}
                y={ny(i)}
                w={150}
                h={56}
                label={`node ${i}`}
                sub={i === 2 ? 'owns "g–m" → grace' : i === 0 ? 'owns "a–f"' : 'owns "n–z"'}
                tone={i === 2 ? "ok" : "default"}
              />
            ))}

            {/* ZooKeeper (mentioned at the end) */}
            <g className="tr" opacity={step >= 6 ? 1 : 0}>
              <NodeBox x={612} y={134} w={96} h={52} label="ZK / etcd" sub="map of record" tone="warn" />
              {[0, 1, 2].map((i) => (
                <Arrow key={i} x1={612} y1={160} x2={nodeX[i] + 150} y2={ny(i) + 28} tone="warn" dashed show={step >= 6} />
              ))}
            </g>

            {/* Strategy 1 arrows: client -> node0 -> node2 -> back */}
            <Arrow x1={150} y1={150} x2={nodeX[0] - 6} y2={ny(0) + 20} tone="acc" show={s1} label={step === 1 ? "1 · any node" : undefined} />
            <Arrow x1={nodeX[0] + 75} y1={ny(0) + 56} x2={nodeX[2] + 75 - 30} y2={ny(2) - 4} tone="info" show={s1} label={step >= 1 ? "2 · forward" : undefined} />
            <Arrow x1={nodeX[2] - 6} y1={ny(2) + 36} x2={150} y2={172} tone="ok" show={step === 2} label="3 · reply" curve={40} />

            {/* Strategy 2 arrows */}
            <Arrow x1={150} y1={160} x2={224} y2={160} tone="acc" show={s2} label={step === 3 ? "1" : undefined} />
            <Arrow x1={340} y1={160} x2={nodeX[2] - 6} y2={ny(2) + 16} tone="info" show={s2} label={step === 3 ? "2 · route" : undefined} />
            <Arrow x1={nodeX[2] - 6} y1={ny(2) + 40} x2={150} y2={176} tone="ok" show={step === 4} label="3 · reply" curve={-46} />

            {/* Strategy 3 arrows */}
            <Arrow x1={150} y1={170} x2={nodeX[2] - 6} y2={ny(2) + 20} tone="acc" show={s3} label={step === 5 ? "direct — 0 extra hops" : undefined} />
            <Arrow x1={nodeX[2] - 6} y1={ny(2) + 42} x2={150} y2={182} tone="ok" show={s3} dashed />
            <g className="tr" opacity={s3 ? 1 : 0}>
              <Txt x={90} y={206} anchor="middle" size={10} tone="acc" weight={600}>
                cached map inside
              </Txt>
            </g>

            <Packet cx={pkt.x} cy={pkt.y} show={pkt.show && step > 0} tone="acc" r={5} />

            {/* strategy label */}
            <Txt x={30} y={36} size={12} weight={700} tone="ink">
              {step === 0
                ? "The discovery problem"
                : s1
                  ? "Strategy 1 · ask any node (gossip)"
                  : s2
                    ? "Strategy 2 · routing tier (e.g. mongos)"
                    : "Strategy 3 · partition-aware client"}
            </Txt>
          </svg>
        );
      }}
    </AnimationShell>
  );
}
