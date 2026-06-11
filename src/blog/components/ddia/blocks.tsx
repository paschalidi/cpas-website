import React, { ReactNode } from 'react';

/* ─────────────────────────────────────────────
   Headings
──────────────────────────────────────────────── */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="group mb-1 mt-14 scroll-mt-20 text-[1.55rem] font-semibold tracking-tight text-[var(--ink)] first:mt-2"
    >
      <a href={`#${id}`} className="!no-underline">
        {children}
        <span
          aria-hidden
          className="ml-2 align-middle font-mono text-base text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1 mt-9 text-lg font-semibold tracking-tight text-[var(--ink)]">
      {children}
    </h3>
  );
}

/* ─────────────────────────────────────────────
   Callouts
──────────────────────────────────────────────── */
const calloutStyles = {
  definition: { label: 'Define', color: 'var(--info)' },
  insight: { label: 'Intuition', color: 'var(--accent)' },
  pitfall: { label: 'Pitfall', color: 'var(--bad)' },
  interview: { label: 'Interview angle', color: 'var(--ok)' },
} as const;

export function Callout({
  type,
  title,
  children,
}: {
  type: keyof typeof calloutStyles;
  title?: string;
  children: ReactNode;
}) {
  const s = calloutStyles[type];
  return (
    <aside
      className="my-7 rounded-r-lg border-l-2 bg-[var(--bg-soft)]/60 py-3 pl-5 pr-4 text-base leading-relaxed"
      style={{ borderLeftColor: s.color }}
    >
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.15em]" style={{ color: s.color }}>
        {s.label}
        {title ? (
          <span className="text-[var(--muted)] normal-case tracking-normal"> &middot; {title}</span>
        ) : null}
      </p>
      <div className="space-y-2 [&>p]:m-0">{children}</div>
    </aside>
  );
}

/* ─────────────────────────────────────────────
   In the Wild
──────────────────────────────────────────────── */
export interface Source {
  label: string;
  href: string;
}

export function InTheWild({
  title,
  sources,
  children,
}: {
  title: string;
  sources: Source[];
  children: ReactNode;
}) {
  return (
    <aside className="my-8 overflow-hidden rounded-lg border border-[var(--line)]">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg-soft)]/70 px-4 py-2">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
        </svg>
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
          In the wild
        </span>
        <span className="truncate text-sm font-medium text-[var(--ink)]">{title}</span>
      </div>
      <div className="space-y-2 px-4 py-3 text-base leading-relaxed [&>p]:m-0">
        {children}
      </div>
      <p className="border-t border-[var(--line)] px-4 py-2 text-xs text-[var(--muted)]">
        Sources:{" "}
        {sources.map((s, i) => (
          <span key={s.href}>
            {i > 0 && " \u00b7 "}
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-ink)] underline decoration-[var(--line)] underline-offset-2 hover:decoration-[var(--accent)]"
            >
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </aside>
  );
}

/* ─────────────────────────────────────────────
   Interview-prep block
──────────────────────────────────────────────── */
export function KeyTakeaways({ items }: { items: ReactNode[] }) {
  return (
    <div className="my-7 rounded-lg border border-[var(--line)] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-4">
        If you only remember 5 things
      </p>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-4">
            <span className="font-mono text-lg font-semibold leading-snug text-[var(--accent)]">
              {i + 1}
            </span>
            <span className="text-base leading-relaxed">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CheatTable({
  caption,
  head,
  rows,
  footnote,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  footnote?: ReactNode;
}) {
  return (
    <figure className="my-7">
      <figcaption className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
        {caption}
      </figcaption>
      <div className="thin-scroll overflow-x-auto rounded-lg border border-[var(--line)]">
        <table className="w-full border-collapse text-sm leading-[1.5]">
          <thead>
            <tr>
              {head.map((h) => (
                  <th
                  key={h}
                  className="font-mono text-xs uppercase tracking-[0.08em] text-left text-[var(--muted)] border-b-2 border-[var(--line-strong)] px-3 py-2 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="border-b border-[var(--line)] px-3 py-2 align-top text-[var(--muted)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{footnote}</p>
      ) : null}
    </figure>
  );
}

export function InterviewQA({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="my-7 space-y-2">
      {items.map((item, i) => (
        <details key={i} className="rounded-lg border border-[var(--line)] px-4 py-3">
          <summary className="text-base font-medium text-[var(--ink)] cursor-pointer list-none flex gap-2 items-baseline">
            <span className="text-[var(--accent)] font-mono font-semibold flex-shrink-0">+</span>
            {item.q}
          </summary>
          <div className="mt-2 space-y-2 pl-5 text-base leading-relaxed text-[var(--muted)] [&>p]:m-0">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}

export function Misconceptions({
  items,
}: {
  items: { myth: string; reality: ReactNode }[];
}) {
  return (
    <div className="my-7 space-y-4">
      {items.map((m, i) => (
        <div key={i} className="rounded-lg border border-[var(--line)] p-4">
          <p className="m-0 text-base leading-relaxed">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bad)]">
              Myth&nbsp;
            </span>
            <span className="italic text-[var(--muted)]">&ldquo;{m.myth}&rdquo;</span>
          </p>
          <p className="m-0 mt-2 text-base leading-relaxed">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--ok)]">
              Reality&nbsp;
            </span>
            {m.reality}
          </p>
        </div>
      ))}
    </div>
  );
}
