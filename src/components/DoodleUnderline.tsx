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
  color = '#0d2418',
}) => {
  const pathD = "M2 4c18-1.5 35-1.5 90-2";
  const pathLength = 92;

  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg
        className="absolute left-0 right-0 w-full"
        style={{
          top: '85%',
          height: '0.5em',
          overflow: 'visible',
        }}
        viewBox="0 0 92 8"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={pathD}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          className="doodle-underline-path"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: 0,
            animation: 'doodle-underline-draw 1.2s ease-out forwards',
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
