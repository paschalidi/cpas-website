import React from 'react';

export interface DecisionOption {
  name: string;
  color: string;
  pro: string;
  con: string;
  use: string;
}

interface DecisionCardProps {
  /** Small label above the title (e.g. "the decision") */
  eyebrow: string;
  /** The question or decision being framed */
  title: string;
  /** Context that sets up the tradeoff. May contain HTML for inline emphasis. */
  frame: string;
  /** 1–3 options, each with pro/con/use lines */
  options: DecisionOption[];
  /** The staff-level recommended answer. May contain HTML. */
  verdict: string;
}

export default function DecisionCard({
  eyebrow,
  title,
  frame,
  options,
  verdict,
}: DecisionCardProps) {
  return (
    <div className="relative overflow-hidden bg-blog-surface border border-blog-border/15 rounded-xl p-6 md:p-7 mt-5">
      {/* left accent bar */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blog-accent" />
      <div className="font-mono text-[0.7rem] tracking-[0.14em] uppercase text-blog-accent mb-2">
        {eyebrow}
      </div>
      <h3 className="text-xl md:text-2xl font-semibold text-blog-text mb-3 leading-snug">{title}</h3>
      <p className="text-blog-muted/70 text-base md:text-lg leading-relaxed max-w-[80ch] mb-6" dangerouslySetInnerHTML={{ __html: frame }} />
      <div className="flex flex-col gap-3.5">
        {options.map((o) => (
          <div key={o.name} className="bg-[#070b0d] border border-forest-800/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ background: o.color }}
              />
              <span className="text-blog-text font-semibold text-base">{o.name}</span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3 text-sm leading-relaxed">
                <span className="shrink-0 w-[40px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-green-500 pt-0.5">pro</span>
                <span className="text-blog-muted/70">{o.pro}</span>
              </div>
              <div className="flex gap-3 text-sm leading-relaxed">
                <span className="shrink-0 w-[40px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-red-400 pt-0.5">con</span>
                <span className="text-blog-muted/70">{o.con}</span>
              </div>
              <div className="flex gap-3 text-sm leading-relaxed">
                <span className="shrink-0 w-[40px] font-mono text-[0.65rem] tracking-[0.08em] uppercase text-peach-300 pt-0.5">use</span>
                <span className="text-blog-muted/70">{o.use}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 rounded-xl border border-blog-accent/20 text-base leading-relaxed" style={{ background: 'rgba(243,198,173,0.06)' }}>
        <b className="block font-mono text-[0.68rem] tracking-[0.1em] uppercase mb-1 text-blog-accent">
          the staff answer
        </b>
        <span className="text-blog-text/90" dangerouslySetInnerHTML={{ __html: verdict }} />
      </div>
    </div>
  );
}
