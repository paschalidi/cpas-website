import { ReactNode } from 'react';
import { useStepper } from './useStepper';

export interface StepDef {
  caption: ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  steps: StepDef[];
  interval?: number;
  children: (step: number) => ReactNode;
}

function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function IconPrev() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconNext() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export default function AnimationShell({ title, subtitle, steps, interval, children }: Props) {
  const st = useStepper(steps.length, interval);

  const btn =
    'inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--line-strong)] disabled:opacity-40 disabled:hover:border-[var(--line)]';

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]">
      {/* Header */}
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--accent)]">Interactive</span>
        <span className="text-sm font-semibold text-[var(--ink)]">{title}</span>
        {subtitle ? <span className="text-xs text-[var(--muted)]">{subtitle}</span> : null}
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-[var(--muted)]">
          Step {st.step + 1}/{st.count}
        </span>
      </figcaption>

      {/* Stage */}
      <div
        className="stage cursor-default px-2 pb-1 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:px-4"
        tabIndex={0}
        role="group"
        aria-label={`${title} — interactive diagram, step ${st.step + 1} of ${st.count}. Use arrow keys to step.`}
        onKeyDown={st.onKeyDown}
      >
        {children(st.step)}
      </div>

      {/* Caption */}
      <div aria-live="polite" className="min-h-[3.25rem] border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[0.9rem] leading-relaxed text-[var(--ink)] sm:px-5">
        <span className="mr-2 inline-block font-mono text-[11px] font-semibold text-[var(--accent)] align-middle">
          {String(st.step + 1).padStart(2, '0')}
        </span>
        {steps[st.step]?.caption}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3 sm:px-5">
        <button type="button" className={btn} onClick={st.reset} disabled={st.step === 0 && !st.playing} aria-label="Restart">
          <IconReset />
        </button>
        <button type="button" className={btn} onClick={st.prev} disabled={st.step === 0} aria-label="Previous step">
          <IconPrev />
        </button>
        <button
          type="button"
          className={`${btn} min-w-[5.5rem] border-[var(--line-strong)]`}
          onClick={st.togglePlay}
          aria-label={st.playing ? 'Pause' : 'Play'}
        >
          {st.playing ? <IconPause /> : <IconPlay />}
          {st.playing ? 'Pause' : st.atEnd ? 'Replay' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={st.next} disabled={st.atEnd} aria-label="Next step">
          <IconNext />
        </button>

        {/* Progress */}
        <div className="ml-1 hidden h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[var(--line)] sm:block" aria-hidden>
          <div
            className="tr h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${((st.step + 1) / st.count) * 100}%` }}
          />
        </div>

        <span className="ml-auto hidden font-mono text-[10px] text-[var(--muted)] md:inline">← → step · Space play</span>
      </div>
    </figure>
  );
}
