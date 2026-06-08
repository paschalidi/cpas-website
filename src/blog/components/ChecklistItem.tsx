import React from 'react';

interface ChecklistItemProps {
  num: string;
  label: string;
  children: React.ReactNode;
}

export default function ChecklistItem({ num, label, children }: ChecklistItemProps) {
  return (
    <div className="flex gap-3.5 py-3 border-b border-blog-border/15 text-sm last:border-b-0">
      <span className="font-mono shrink-0 text-sm text-blog-accent">{num}</span>
      <span>
        <b className="font-semibold text-blog-text">{label}</b>{' '}
        <span className="text-blog-muted/70">{children}</span>
      </span>
    </div>
  );
}
