import { ReactNode } from 'react';

export type Tone = 'default' | 'acc' | 'ok' | 'bad' | 'info' | 'warn' | 'mut';

export const stroke: Record<Tone, string> = {
  default: 'var(--ink)',
  acc: 'var(--accent)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  info: 'var(--info)',
  warn: 'var(--warn)',
  mut: 'var(--muted)',
};

export function VizDefs() {
  const tones: Tone[] = ['default', 'acc', 'ok', 'bad', 'info', 'warn', 'mut'];
  return (
    <defs>
      {tones.map((t) => (
        <marker
          key={t}
          id={`arr-${t}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={stroke[t]} />
        </marker>
      ))}
    </defs>
  );
}

export function NodeBox({
  x,
  y,
  w,
  h,
  label,
  sub,
  tone = 'default',
  dim = false,
  fillTone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: Tone;
  dim?: boolean;
  fillTone?: 'acc' | 'ok' | 'bad' | 'info' | 'warn';
}) {
  const fills: Record<string, string> = {
    acc: 'color-mix(in srgb, var(--accent) 14%, var(--bg))',
    ok: 'color-mix(in srgb, var(--ok) 12%, var(--bg))',
    bad: 'color-mix(in srgb, var(--bad) 12%, var(--bg))',
    info: 'color-mix(in srgb, var(--info) 12%, var(--bg))',
    warn: 'color-mix(in srgb, var(--warn) 14%, var(--bg))',
  };
  return (
    <g className="tr" opacity={dim ? 0.32 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={fillTone ? fills[fillTone] : 'var(--bg)'}
        stroke={stroke[tone]}
        strokeWidth={tone === 'default' ? 1.2 : 1.6}
        className="tr"
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 6 : y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight={600}
        fill="var(--ink)"
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 11}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="10.5"
          fill="var(--muted)"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function Arrow({
  x1,
  y1,
  x2,
  y2,
  tone = 'default',
  dashed = false,
  label,
  labelDy = -7,
  show = true,
  curve = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone?: Tone;
  dashed?: boolean;
  label?: string;
  labelDy?: number;
  show?: boolean;
  curve?: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const d =
    curve === 0
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} Q ${mx} ${my - curve} ${x2} ${y2}`;
  return (
    <g className="tr" opacity={show ? 1 : 0}>
      <path
        d={d}
        fill="none"
        stroke={stroke[tone]}
        strokeWidth={1.6}
        strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={`url(#arr-${tone})`}
      />
      {label ? (
        <text
          x={mx}
          y={my - curve / 2 + labelDy}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight={600}
          fill={stroke[tone]}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function Chip({
  cx,
  cy,
  label,
  tone = 'default',
  w = 52,
  h = 22,
  filled = false,
  dim = false,
}: {
  cx: number;
  cy: number;
  label: string;
  tone?: Tone;
  w?: number;
  h?: number;
  filled?: boolean;
  dim?: boolean;
}) {
  return (
    <g className="tr" opacity={dim ? 0.3 : 1} transform={`translate(${cx - w / 2}, ${cy - h / 2})`} style={{ transition: 'transform .55s ease, opacity .55s ease' }}>
      <rect
        width={w}
        height={h}
        rx={h / 2}
        fill={filled ? stroke[tone] : 'var(--bg)'}
        stroke={stroke[tone]}
        strokeWidth={1.3}
        className="tr"
      />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10.5"
        fontWeight={600}
        fill={filled ? 'var(--bg)' : 'var(--ink)'}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

export function Packet({
  cx,
  cy,
  tone = 'acc',
  r = 6,
  show = true,
  label,
}: {
  cx: number;
  cy: number;
  tone?: Tone;
  r?: number;
  show?: boolean;
  label?: string;
}) {
  return (
    <g className="tr" opacity={show ? 1 : 0} transform={`translate(${cx}, ${cy})`} style={{ transition: 'transform .6s ease, opacity .45s ease' }}>
      <circle r={r} fill={stroke[tone]} />
      {label ? (
        <text x={0} y={-r - 5} textAnchor="middle" fontSize="10" fontWeight={700} fill={stroke[tone]}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function Txt({
  x,
  y,
  children,
  size = 11,
  tone = 'mut',
  weight = 500,
  anchor = 'start',
  mono = false,
  show = true,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  tone?: Tone | 'ink';
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  mono?: boolean;
  show?: boolean;
}) {
  return (
    <text
      className="tr"
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill={tone === 'ink' ? 'var(--ink)' : stroke[tone]}
      opacity={show ? 1 : 0}
      fontFamily={mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined}
    >
      {children}
    </text>
  );
}

export function Badge({
  x,
  y,
  label,
  tone = 'acc',
  show = true,
}: {
  x: number;
  y: number;
  label: string;
  tone?: Tone;
  show?: boolean;
}) {
  const w = label.length * 6.4 + 16;
  return (
    <g className="tr" opacity={show ? 1 : 0} transform={`translate(${x - w / 2}, ${y - 11})`}>
      <rect width={w} height={22} rx={11} fill={stroke[tone]} />
      <text
        x={w / 2}
        y={11}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10.5"
        fontWeight={700}
        fill="var(--bg)"
      >
        {label}
      </text>
    </g>
  );
}
