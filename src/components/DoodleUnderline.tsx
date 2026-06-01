import React, { useEffect, useRef } from 'react';

interface DoodleUnderlineProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  delay?: number;
}

/**
 * Novoda-style doodle underline — wavy scribble line that draws in on mount.
 * Thin, positioned just below text, 450ms linear animation.
 */
export const DoodleUnderline: React.FC<DoodleUnderlineProps> = ({
  children,
  className = '',
  color = 'rgb(var(--color-forest-700))',
  delay = 400,
}) => {
  const pathRef = useRef<SVGPathElement>(null);

  // Novoda's wavy scribble path
  const pathD = "M1.3 3.675c17.188-1.444 33.392-1.079 89.886-2.05L.712 5.075C51.4 2.2 30.899 3.827 89.5 3.375";
  const pathLength = 272;

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    // Start hidden
    path.style.strokeDashoffset = `${pathLength}`;

    const timer = setTimeout(() => {
      path.style.strokeDashoffset = '0';
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, pathLength]);

  return (
    <span
      className={`relative inline-flex ${className}`}
      style={{ lineHeight: 1 }}
    >
      {children}
      <svg
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          top: '0.80em',
          width: '100%',
          height: 'max(0.4rem, 0.3em)',
          overflow: 'visible',
        }}
        viewBox="0 0 92 5"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          ref={pathRef}
          d={pathD}
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="square"
          fill="none"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength,
            transition: 'stroke-dashoffset 380ms linear',
          }}
        />
      </svg>
    </span>
  );
};
