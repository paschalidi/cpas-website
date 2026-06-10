import React from 'react';

/**
 * DDIAThemeProvider — wraps DDIA content in a scoped dark theme.
 *
 * The DDIA project uses CSS variables (--bg, --ink, --accent, etc.) and
 * Tailwind classes mapped to those variables. We replicate the dark-mode
 * palette here so every DDIA component (prose, tables, animations) looks
 * at home inside the blog's dark forest background.
 */
export default function DDIAThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ddia-scope"
      style={{
        // Dark-mode palette adapted to match the blog's forest theme
        // while keeping the amber/peach accent the DDIA uses
        '--bg': '#0a0f0c',
        '--bg-soft': '#0c1a10',
        '--bg-code': '#070b0d',
        '--ink': '#f2fafc',
        '--muted': '#8aa6b0',
        '--line': '#1c2f37',
        '--line-strong': '#2a4651',
        '--accent': '#f3c6ad',
        '--accent-ink': '#f5b73d',
        '--accent-soft': 'rgba(243, 198, 173, 0.12)',
        '--ok': '#34d399',
        '--bad': '#f87171',
        '--info': '#60a5fa',
        '--warn': '#fbbf24',
        '--shadow': '0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px -12px rgba(0, 0, 0, 0.55)',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
