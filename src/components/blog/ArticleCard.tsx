import React from 'react';
import { cn } from '../../lib/utils';

interface ArticleCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  tagColor?: 'accent' | 'muted' | 'surface';
  children: React.ReactNode;
  className?: string;
}

const tagStyles = {
  accent: 'text-blog-accent border-blog-accent/40',
  muted: 'text-blog-muted/50 border-blog-border/10',
  surface: 'text-blog-muted/60 border-blog-border/10',
};

export function ArticleCard({
  title,
  subtitle,
  tag,
  tagColor = 'accent',
  children,
  className,
}: ArticleCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-blog-border/10',
        'bg-blog-surface',
        'p-6 md:p-8 mt-8',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl md:text-2xl font-[350] tracking-tight text-blog-text">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 font-mono text-xs text-blog-muted/40">
              {subtitle}
            </p>
          )}
        </div>
        {tag && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center px-3 py-1 rounded-full',
              'font-mono text-[0.65rem] tracking-widest uppercase border',
              tagStyles[tagColor],
            )}
          >
            {tag}
          </span>
        )}
      </div>
      <div className="mt-4 space-y-4 text-blog-muted/60 text-base leading-relaxed max-w-[62ch]">
        {children}
      </div>
    </div>
  );
}
