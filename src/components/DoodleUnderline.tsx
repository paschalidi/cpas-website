import React from 'react';

interface DoodleUnderlineProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
}

/**
 * A hand-drawn style underline that animates in using SVG stroke-dashoffset.
 * Inspired by Novoda's doodle underline effect.
 */
export const DoodleUnderline: React.FC<DoodleUnderlineProps> = ({
  children,
  className = '',
  color = 'rgb(var(--color-forest-700))',
}) => {
  const pathD = "M1 5 Q8 2, 15 5 T30 5 T45 4 T60 5 T75 4 T90 5";
  const pathLength = 120;

  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg
        className="absolute left-0 right-0 w-full"
        style={{
          top: '82%',
          height: '0.5em',
          overflow: 'visible',
        }}
        viewBox="0 0 92 10"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={pathD}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: 0,
            animation: 'doodle-underline-draw 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />
      </svg>
      <style>{`
        @keyframes doodle-underline-draw {
          from {
            stroke-dashoffset: ${pathLength};
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </span>
  );
};
