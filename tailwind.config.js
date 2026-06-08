/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Cabinet Grotesk"', 'sans-serif'],
      },
      colors: {
        forest: {
          950: 'rgb(var(--color-forest-950) / <alpha-value>)',
          925: 'rgb(var(--color-forest-925) / <alpha-value>)',
          900: 'rgb(var(--color-forest-900) / <alpha-value>)',
          800: 'rgb(var(--color-forest-800) / <alpha-value>)',
          700: 'rgb(var(--color-forest-700) / <alpha-value>)',
        },
        peach: {
          300: 'rgb(var(--color-peach-300) / <alpha-value>)',
          200: 'rgb(var(--color-peach-200) / <alpha-value>)',
        },
        sand: {
          300: 'rgb(var(--color-sand-300) / <alpha-value>)',
        },
        cream: {
          200: 'rgb(var(--color-cream-200) / <alpha-value>)',
          50: 'rgb(var(--color-cream-50) / <alpha-value>)',
        },
        blog: {
          background: 'rgb(var(--color-blog-background) / <alpha-value>)',
          surface: 'rgb(var(--color-blog-surface) / <alpha-value>)',
          border: 'rgb(var(--color-blog-border) / <alpha-value>)',
          text: 'rgb(var(--color-blog-text) / <alpha-value>)',
          muted: 'rgb(var(--color-blog-muted) / <alpha-value>)',
          accent: 'rgb(var(--color-blog-accent) / <alpha-value>)',
          'accent-muted': 'rgb(var(--color-blog-accent-muted) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [typography],
};
