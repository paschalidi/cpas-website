import React from 'react';

interface TipCardProps {
  title: string;
  children: React.ReactNode;
  /** Hex/CSS colour for the left accent bar. Defaults to the peach blog-accent. */
  accent?: string;
}

export default function TipCard({ title, children, accent = '#f3c6ad' }: TipCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-blog-border/15 bg-blog-surface p-5 pl-6">
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: accent }}
      />
      <h4 className="text-base font-semibold text-blog-text mb-2">{title}</h4>
      <p className="text-sm leading-relaxed text-blog-muted/70">{children}</p>
    </div>
  );
}
