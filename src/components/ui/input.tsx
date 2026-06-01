import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  animated?: boolean;
  variant?: 'dark' | 'light';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, animated = true, variant = 'dark', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [dims, setDims] = useState({ width: 0, height: 0 });
    const wrapRef = useRef<HTMLDivElement>(null);
    const hasValue = props.value !== undefined && props.value !== '';

    const isLight = variant === 'light';
    const textColor = isLight ? 'text-forest-700' : 'text-white';
    const underlineColor = isLight ? 'bg-forest-700/20' : 'bg-white/20';
    const labelColor = isLight ? 'rgb(13 36 24 / 0.5)' : 'rgb(255 255 255 / 0.5)';
    const labelActiveColor = isLight ? 'rgb(13 36 24)' : 'rgb(255 255 255)';

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        setDims({ width, height });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Full closed rounded-rect path: bottom-left → up left → top-left arc → top → top-right arc → right down → bottom-right arc → bottom → bottom-left arc → close
    const rx = 16; // matches rounded-2xl (1rem = 16px)
    const { width, height } = dims;
    const svgPath = width > 0 && height > 0
      ? `M 0.5 ${height - rx} L 0.5 ${rx} A ${rx} ${rx} 0 0 1 ${rx} 0.5 L ${width - rx} 0.5 A ${rx} ${rx} 0 0 1 ${width - 0.5} ${rx} L ${width - 0.5} ${height - rx} A ${rx} ${rx} 0 0 1 ${width - rx} ${height - 0.5} L ${rx} ${height - 0.5} A ${rx} ${rx} 0 0 1 0.5 ${height - rx} Z`
      : '';

    return (
      <div className="space-y-1 relative">
        {label && (
          <motion.label
            className={cn("block text-sm transition-all duration-300", textColor)}
            variants={{
              initial: { y: 0, color: labelColor },
              active: { y: -8, color: labelActiveColor, fontWeight: 600, transition: { duration: 0.3 } },
            }}
            initial="initial"
            animate={isFocused || hasValue ? "active" : "initial"}
          >
            {label}
          </motion.label>
        )}
        <div ref={wrapRef} className="relative rounded-2xl">
          <input
            ref={ref}
            className={cn(
              "bg-transparent border-0 rounded-2xl px-6 py-4 focus-visible:ring-0 focus-visible:ring-offset-0 w-full outline-none",
              textColor,
              className
            )}
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            style={{ cursor: 'none' }}
            {...props}
          />

          {/* Underline — fades out when SVG border takes over */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-[1px] rounded-full transition-opacity duration-200",
              underlineColor,
              (isFocused || hasValue) ? 'opacity-0' : 'opacity-100'
            )}
          />

          {animated && svgPath && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <AnimatePresence>
                {(isFocused || hasValue) && (
                  <motion.path
                    key="border-trace"
                    d={svgPath}
                    fill="none"
                    stroke="rgb(var(--color-forest-700))"
                    strokeWidth="1"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                      pathLength: { duration: 0.55, ease: 'easeInOut' },
                      opacity: { duration: 0.15 },
                    }}
                  />
                )}
              </AnimatePresence>
            </svg>
          )}
        </div>
      </div>
    );
  }
);
Input.displayName = 'Input';
