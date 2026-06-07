export type SceneStep = {
  t: 'A' | 'B';
  kind: 'write' | 'read' | 'commit' | 'abort' | 'note';
  text: string;
  db?: string;
  flash?: 'flash' | 'bad' | 'good';
  packet?: { from: 'db' | 'A' | 'B'; to: 'db' | 'A' | 'B'; val: string };
  note?: string;
};

export type SceneData = {
  id: string;
  tag: string;
  tagText: string;
  title: string;
  aka: string;
  desc: string;
  dbStart: string;
  dbLabel: string;
  steps: SceneStep[];
  verdict: { type: 'bad' | 'good'; icon: string; text: string };
};

export type LevelData = {
  cls: string;
  name: string;
  aka: string;
  pips: ('on' | 'off' | 'warn')[];
};

export type SolutionData = {
  ic: string;
  name: string;
  code: string;
  text: string;
  anim: 'atomic' | 'lock' | 'detect' | 'cas' | 'merge';
};

export const anomalies: SceneData[] = [
  {
    id: 'dirty-write',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Dirty write',
    aka: 'overwriting an uncommitted write',
    desc: "Two transactions both write the same object. The second overwrites the first before it has committed — so you end up with a corrupted mix of two writes that should have stayed atomic. In a car sale: one buyer wins the listing, the other buyer's name lands on the invoice.",
    dbStart: '\u2014',
    dbLabel: 'sale',
    steps: [
      { t: 'A', kind: 'write', text: 'set buyer = <b>Alice</b>', db: 'Alice', flash: 'flash' },
      { t: 'B', kind: 'write', text: 'set buyer = <b>Bob</b>', db: 'Bob', flash: 'flash' },
      { t: 'A', kind: 'write', text: 'set invoice = <b>Alice</b>', flash: 'flash' },
      { t: 'B', kind: 'commit', text: 'listing: Bob', db: 'Bob/Alice', flash: 'bad' },
      { t: 'A', kind: 'commit', text: 'invoice: Alice' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: "Listing says Bob, invoice says Alice. The two writes interleaved into an inconsistent record.",
    },
  },
  {
    id: 'dirty-read',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Dirty read',
    aka: 'reading an uncommitted write',
    desc: "One transaction reads a value another has written but not committed. Then the writer aborts — so the reader acted on data that officially never existed.",
    dbStart: '$50',
    dbLabel: 'balance',
    steps: [
      {
        t: 'A',
        kind: 'write',
        text: 'set balance = <b>$100</b>',
        db: '$100',
        flash: 'flash',
        note: 'not committed yet',
      },
      {
        t: 'B',
        kind: 'read',
        text: 'read balance \u2192 <b>$100</b>',
        packet: { from: 'db', to: 'B', val: '100' },
        flash: 'flash',
      },
      { t: 'B', kind: 'note', text: 'B trusts the $100 and proceeds\u2026' },
      { t: 'A', kind: 'abort', text: 'roll back to $50', db: '$50', flash: 'bad' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: 'B saw $100, but the balance was never really $100. It acted on a ghost value.',
    },
  },
  {
    id: 'read-skew',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Read skew',
    aka: 'non-repeatable read',
    desc: "A read returns one answer, then a second read in the same transaction returns another — because someone committed in between. Mid-transfer, you snapshot account 1 before and account 2 after, and money seems to vanish. Brutal for backups and long analytic queries.",
    dbStart: '500 / 500',
    dbLabel: 'a1/a2',
    steps: [
      {
        t: 'B',
        kind: 'read',
        text: 'read acct1 \u2192 <b>500</b>',
        packet: { from: 'db', to: 'B', val: '500' },
        flash: 'flash',
      },
      { t: 'A', kind: 'write', text: 'transfer: a1\u2192400, a2\u2192600', db: '400 / 600', flash: 'flash' },
      { t: 'A', kind: 'commit', text: 'transfer done' },
      {
        t: 'B',
        kind: 'read',
        text: 'read acct2 \u2192 <b>500</b>',
        packet: { from: 'db', to: 'B', val: '500' },
        flash: 'flash',
        note: 'old snapshot of a2',
      },
      { t: 'B', kind: 'note', text: 'B computes total = 400 + 500 = 900' },
      { t: 'B', kind: 'commit', text: 'total = 900, not 1000', flash: 'bad' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: '$100 appears to have vanished \u2014 B read one account before the transfer and the other after it.',
    },
  },
  {
    id: 'lost-update',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Lost update',
    aka: 'the read-modify-write race',
    desc: "Two transactions read the same value, each adds to it, each writes back. One increment silently disappears. The canonical case: two clients incrementing the same counter, or two people editing one wiki page.",
    dbStart: '10',
    dbLabel: 'counter',
    steps: [
      {
        t: 'A',
        kind: 'read',
        text: 'read counter \u2192 <b>10</b>',
        packet: { from: 'db', to: 'A', val: '10' },
        flash: 'flash',
      },
      {
        t: 'B',
        kind: 'read',
        text: 'read counter \u2192 <b>10</b>',
        packet: { from: 'db', to: 'B', val: '10' },
        flash: 'flash',
      },
      {
        t: 'A',
        kind: 'write',
        text: 'write 10 + 1 = <b>11</b>',
        db: '11',
        packet: { from: 'A', to: 'db', val: '11' },
        flash: 'flash',
      },
      {
        t: 'B',
        kind: 'write',
        text: 'write 10 + 1 = <b>11</b>',
        db: '11',
        packet: { from: 'B', to: 'db', val: '11' },
        flash: 'bad',
      },
      { t: 'B', kind: 'note', text: 'two increments, but counter is 11' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: "Two +1s should give 12. The counter reads 11 \u2014 A's update was lost.",
    },
  },
  {
    id: 'write-skew',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Write skew',
    aka: 'the general case of lost update',
    desc: "Two transactions read the same rows, each checks a condition that's still true, then each writes to a different row — together breaking an invariant that each preserved alone. Two on-call doctors both go off shift because each sees the other is still covering.",
    dbStart: '2 on call',
    dbLabel: 'on-call',
    steps: [
      {
        t: 'A',
        kind: 'read',
        text: 'on-call count \u2192 <b>2</b>',
        packet: { from: 'db', to: 'A', val: '2' },
        flash: 'flash',
        note: '"Bob covers, I can leave"',
      },
      {
        t: 'B',
        kind: 'read',
        text: 'on-call count \u2192 <b>2</b>',
        packet: { from: 'db', to: 'B', val: '2' },
        flash: 'flash',
        note: '"Alice covers, I can leave"',
      },
      { t: 'A', kind: 'write', text: 'Alice \u2192 off call', db: '1 on call', flash: 'flash' },
      { t: 'B', kind: 'write', text: 'Bob \u2192 off call', db: '0 on call', flash: 'bad' },
      { t: 'B', kind: 'commit', text: 'both committed' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: 'Zero doctors on call. Each transaction was individually valid; together they broke the rule.',
    },
  },
  {
    id: 'phantom',
    tag: 't-bug',
    tagText: 'Anomaly',
    title: 'Phantom',
    aka: "a write changes a query's result set",
    desc: 'One transaction asks "does anything match X?" and acts on the answer. Another inserts a matching row, invalidating the premise. Two people check "is this room free?", both see yes, both book it. Nasty because there\u2019s no existing row to lock.',
    dbStart: 'room free',
    dbLabel: '10am slot',
    steps: [
      {
        t: 'A',
        kind: 'read',
        text: 'any booking 10am? \u2192 <b>none</b>',
        packet: { from: 'db', to: 'A', val: '\u2205' },
        flash: 'flash',
      },
      {
        t: 'B',
        kind: 'read',
        text: 'any booking 10am? \u2192 <b>none</b>',
        packet: { from: 'db', to: 'B', val: '\u2205' },
        flash: 'flash',
      },
      { t: 'A', kind: 'write', text: 'insert booking (Alice)', db: '1 booking', flash: 'flash' },
      { t: 'B', kind: 'write', text: 'insert booking (Bob)', db: '2 bookings', flash: 'bad' },
      { t: 'B', kind: 'note', text: 'room double-booked for 10am' },
    ],
    verdict: {
      type: 'bad',
      icon: '\u2717',
      text: 'Both saw an empty slot and both inserted. The row each checked for didn\u2019t exist yet \u2014 nothing to lock.',
    },
  },
];

export const cols = ['Dirty read', 'Read skew', 'Lost update', 'Write skew / phantom'];

export const levels: LevelData[] = [
  { cls: 'r0', name: 'Read uncommitted', aka: 'weakest', pips: ['off', 'off', 'off', 'off'] },
  { cls: 'r1', name: 'Read committed', aka: 'common default', pips: ['on', 'off', 'off', 'off'] },
  { cls: 'r2', name: 'Snapshot isolation', aka: '"repeatable read" \u00B7 MVCC', pips: ['on', 'on', 'warn', 'off'] },
  { cls: 'r3', name: 'Serializable', aka: 'as if one-at-a-time', pips: ['on', 'on', 'on', 'on'] },
];

export const solutions: SolutionData[] = [
  {
    ic: '01',
    name: 'Atomic write operations',
    code: 'UPDATE c SET v = v + 1',
    text: 'Let the database do the read-modify-write in one indivisible step. It takes an exclusive lock on the row so no one can interleave. Best option when your update fits this shape — but not everything does (free-text editing).',
    anim: 'atomic',
  },
  {
    ic: '02',
    name: 'Explicit locking',
    code: 'SELECT \u2026 FOR UPDATE',
    text: "Tell the database to lock the rows you're about to change, forcing other transactions to wait their turn. You're doing manually what atomic ops do for free — and the risk is forgetting a lock.",
    anim: 'lock',
  },
  {
    ic: '03',
    name: 'Automatic detection',
    code: '(abort + retry)',
    text: 'Some databases detect a lost update and abort the loser, which retries. Works even when you forgot to add a lock. PostgreSQL repeatable read does this; MySQL/InnoDB repeatable read notably does not.',
    anim: 'detect',
  },
  {
    ic: '04',
    name: 'Compare-and-set',
    code: 'UPDATE \u2026 WHERE v = old',
    text: "Only write if the value hasn't changed since you read it. If it has, your update matches zero rows and you retry. Watch out if the WHERE reads from a stale snapshot — the check can silently no-op.",
    anim: 'cas',
  },
  {
    ic: '05',
    name: 'Conflict resolution',
    code: 'siblings \u00B7 CRDTs \u00B7 LWW',
    text: "In replicated databases there's no single copy to lock. Concurrent writes create conflicting versions, resolved by app code or merge-friendly structures like CRDTs. Last-write-wins is the common default — and it loses updates.",
    anim: 'merge',
  },
];
