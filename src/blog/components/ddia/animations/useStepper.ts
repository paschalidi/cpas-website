import { useCallback, useEffect, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface Stepper {
  step: number;
  count: number;
  playing: boolean;
  atEnd: boolean;
  next: () => void;
  prev: () => void;
  reset: () => void;
  togglePlay: () => void;
  goto: (s: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  reduced: boolean;
}

export function useStepper(count: number, intervalMs = 2800): Stepper {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();

  const atEnd = step >= count - 1;

  const next = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, count - 1));
  }, [count]);

  const prev = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setPlaying(false);
    setStep(0);
  }, []);

  const goto = useCallback(
    (s: number) => {
      setPlaying(false);
      setStep(Math.max(0, Math.min(s, count - 1)));
    },
    [count]
  );

  const togglePlay = useCallback(() => {
    setStep((s) => {
      if (s >= count - 1) return 0;
      return s;
    });
    setPlaying((p) => !p);
  }, [count]);

  useEffect(() => {
    if (!playing) return;
    const ms = reduced ? Math.max(intervalMs, 3600) : intervalMs;
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= count - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [playing, intervalMs, count, reduced]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Home':
          e.preventDefault();
          reset();
          break;
        case 'End':
          e.preventDefault();
          goto(count - 1);
          break;
      }
    },
    [next, prev, togglePlay, reset, goto, count]
  );

  return { step, count, playing, atEnd, next, prev, reset, togglePlay, goto, onKeyDown, reduced };
}
