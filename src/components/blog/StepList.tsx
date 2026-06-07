import React from 'react';
import { cn } from '../../lib/utils';

export interface Step {
  label: string;
  description: string | React.ReactNode;
}

interface StepListProps {
  steps: Step[];
  className?: string;
}

export function StepList({ steps, className }: StepListProps) {
  return (
    <ol className={cn('divide-y divide-blog-border/10', className)}>
      {steps.map((step, i) => (
        <li key={i} className="relative pl-[3.25rem] py-3.5">
          <span
            className={cn(
              'absolute left-0 top-3.5 flex items-center justify-center',
              'w-7 h-7 rounded-lg',
              'bg-blog-surface border border-blog-border/10',
              'font-mono text-xs font-bold text-blog-accent',
            )}
          >
            {i + 1}
          </span>
          <strong className="text-blog-text font-[350]">{step.label}</strong>{' '}
          <span className="text-blog-muted/60 text-base leading-relaxed">
            {step.description}
          </span>
        </li>
      ))}
    </ol>
  );
}
