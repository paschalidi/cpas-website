import React from 'react';

interface MiniDiagramProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  caption: string;
}

export default function MiniDiagram({
  title,
  subtitle,
  children,
  caption,
}: MiniDiagramProps) {
  return (
    <div className="bg-blog-surface border border-blog-border/15 rounded-xl p-4">
      <h4 className="text-base font-semibold text-blog-text mb-0.5">{title}</h4>
      <div className="font-mono text-[0.64rem] tracking-[0.06em] mb-3 text-blog-muted/50">
        {subtitle}
      </div>
      {children}
      <p className="text-xs mt-3 text-blog-muted/70">{caption}</p>
    </div>
  );
}
