import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  animated?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, animated = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '';

    const inputAnimations = {
      borderLeft: {
        initial: { scaleY: 0, opacity: 0 },
        animate: { scaleY: 1, opacity: 1, transition: { delay: 0.1, duration: 0.25 } },
        exit: { scaleY: 0, opacity: 0, transition: { duration: 0.2 } }
      },
      borderTop: {
        initial: { scaleX: 0, opacity: 0 },
        animate: { scaleX: 1, opacity: 1, transition: { delay: 0.35, duration: 0.25 } },
        exit: { scaleX: 0, opacity: 0, transition: { duration: 0.2 } }
      },
      borderRight: {
        initial: { scaleY: 0, opacity: 0 },
        animate: { scaleY: 1, opacity: 1, transition: { delay: 0.6, duration: 0.25 } },
        exit: { scaleY: 0, opacity: 0, transition: { duration: 0.2 } }
      },
      label: {
        initial: { y: 0, color: 'rgb(255 255 255 / 0.5)' },
        animate: { y: -8, color: 'rgb(243 198 173)', fontWeight: 600, transition: { duration: 0.3 } }
      }
    };

    return (
      <div className="space-y-1 relative">
        {label && (
          <motion.label
            className="block text-sm transition-all duration-300"
            variants={inputAnimations.label}
            initial="initial"
            animate={isFocused || hasValue ? "animate" : "initial"}
          >
            {label}
          </motion.label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            className={cn(
              "bg-transparent border-0 rounded-2xl px-4 py-3 focus-visible:ring-0 focus-visible:ring-offset-0 text-white w-full outline-none resize-none min-h-[120px]",
              className
            )}
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            style={{ cursor: 'none' }}
            {...props}
          />
          
          {/* Bottom border always visible */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/20"
          />
          
          {animated && (
            <AnimatePresence>
              {(isFocused || hasValue) && (
                <>
                  <motion.div
                    className="absolute bottom-0 left-0 w-[1px] h-full bg-[rgb(243,198,173)]"
                    {...inputAnimations.borderLeft}
                  />
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[1px] bg-[rgb(243,198,173)]"
                    {...inputAnimations.borderTop}
                  />
                  <motion.div
                    className="absolute top-0 right-0 w-[1px] h-full bg-[rgb(243,198,173)]"
                    {...inputAnimations.borderRight}
                  />
                </>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
