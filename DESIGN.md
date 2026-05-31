# DESIGN.md

## Theme

Dark mode only. Background: `#000000` (pure black). No light mode variant. The black canvas is intentional — it lets the aurora shader and white typography own the visual space.

## Color Palette

### Dark Theme (Hero, Footer)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `black` | Page background, hero, footer |
| `--text-primary` | `white` | Headings, primary body text |
| `--text-secondary` | `neutral-700/80` | Subheadings, supporting copy |
| `--text-gradient-start` | `white` | Gradient text start (bg-clip-text) |
| `--text-gradient-end` | `white/50` | Gradient text end |
| `--accent-surface` | `purple-500/10` | Tag/chip backgrounds |
| `--accent-text` | `purple-200/80` | Tag/chip text |
| `--icon-color` | `white` | Social icons, UI icons |

### Light Theme (Work Section)

Derived from the aurora gradient. Used as a warm contrast break from the dark hero:

| Role | Hex | Usage |
|------|-----|-------|
| **Base / Background** | `#fcfaf5` | Work section background |
| **Cream** | `#f0e8c4` | Pale buttery yellow band |
| **Sky** | `#b0d1eb` | Soft powder blue band |
| **Coral** | `#f2bca6` | Light peach tint |
| **Peach** | `#f5a885` | Primary accent / CTAs / focal hero |
| **Deep Peach** | `#e8865f` | Hover/active states |

**Suggested usage:**
- Background / surfaces → `#fcfaf5`
- Primary accent / CTAs / focal hero → `#f5a885` (or `#e8865f` for hover/active)
- Secondary accent / links / info → `#b0d1eb`
- Tertiary / highlights / badges → `#f0e8c4`
- Soft fills / dividers → `#f2bca6`

**Badge color (single, warm):**
- Background: `#fef0e6`
- Text: `#b8722d`

**Rules:**
- Dark hero bg is pure black; no cream/sand/beige warm-tinted neutrals in dark sections.
- Light section bg is `#fcfaf5` warm off-white — derived from the aurora palette.
- No gray text on colored backgrounds.
- Contrast: white on black is ∞:1. Dark text (`#1a1a1a`) on `#fcfaf5` is ~15:1.

## Typography

**Primary font:** `Cabinet Grotesk` (Fontshare CDN), weights 100–400.
- Loaded via: `@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@100,200,300,400&display=swap');`
- Tailwind config: `fontFamily: { sans: ['"Cabinet Grotesk"', 'sans-serif'] }`

**Scale (from current usage):**
- Hero H1: `text-6xl` (~60px), `font-semibold`, gradient via `bg-clip-text`
- Subheadline: `text-2xl`, `text-neutral-700/80`, max-width ~700px
- Section headings: inherited from project cards
- Body: default sans, white on black

**Rules:**
- Cap font-family count at 2 (Cabinet Grotesk + optional mono for code blocks in blog).
- No all-caps body copy.
- Use `text-wrap: balance` on h1–h3.

## Layout

- Single-page vertical scroll. No routing.
- Section spacing: generous, rhythm-driven. Hero is `h-screen`. Projects follows with natural flow.
- Cards: shadcn-style primitives (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) used in `Projects.tsx`.
- Grid: `grid-cols-1 md:grid-cols-2` for project cards.
- Responsive: mobile-first, Tailwind breakpoints.

## Components

### Card (shadcn/ui style)
- `Card`: rounded corners, border, hover lift (`-translate-y-1`)
- `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- Used for project showcase cards

### AuroraBackground
- Full-screen Three.js fragment shader
- Colors: pink → violet → blue → mint, flowing gradient
- Reacts to cursor movement via uniform updates
- Mounted behind Hero, `z-index` below content

### Cursor
- Custom ring + dot follower
- `backdrop-filter: invert(1)` + `mix-blend-mode: difference`
- `cursor: none` on root
- Must propagate to all new interactive elements

### Social Links
- Icon-only, hover lift (`-translate-y-1`, `duration-300`)
- Icons: GitHub, LinkedIn, Resume (custom SVG), Toptal, Email
- White fill, no labels

## Motion

- **Hero text**: subtle parallax on mousemove (`translate` based on cursor position, `duration-200 ease-out`)
- **Chevron**: `animate-bounce` at bottom of hero
- **Card hover**: `-translate-y-1`, `transition-all duration-300`
- **Social link hover**: same lift pattern
- **Aurora**: continuous WebGL animation, cursor-reactive
- **Reduced motion**: all animations must respect `prefers-reduced-motion: reduce` (instant or fade, no parallax)

## Iconography

- **Project icons**: Lucide React (e.g. `ChevronDown`)
- **Social icons**: Custom inline SVGs (GitHub, LinkedIn, Toptal, Email, Resume)
- **Rule**: one coherent set. If adding new icons, use Lucide for UI elements. Keep custom SVGs for brand-specific marks only.

## Signature Moves

These are the design elements that make this site *this site*. Preserve them in all new work:

1. **Aurora shader background** — the flowing pink-violet-blue-mint gradient. Never replace with a static gradient or image.
2. **Custom inverted cursor** — the ring/dot with `invert(1)` and `difference` blend. Every new interactive element must respect `cursor-none`.
3. **Gradient text on hero** — `bg-gradient-to-r from-white to-white/50` with `bg-clip-text text-transparent`.
4. **Hover lift** — `-translate-y-1` on cards and social links. Consistent `duration-300` timing.
5. **Black canvas** — no exceptions without a scene-level justification.
6. **Playful copy moments** — the cheeky email subject/body is part of the brand voice. New copy can be straightforward, but the personality should remain discoverable.

## Anti-Patterns (Banned)

- Side-stripe borders on cards
- Gradient text (the hero gradient is the *only* exception, and it's monochrome white)
- Glassmorphism as default
- Hero-metric template (big number + small label)
- Identical card grids without variation
- Tiny uppercase tracked eyebrows above every section
- Numbered section markers (01 / 02 / 03) as default scaffolding
- Text overflow at any breakpoint

## Responsive

- Mobile: single column, adjusted hero text size, touch-friendly targets (≥44px)
- Tablet: 2-column project grid
- Desktop: full experience, aurora at full resolution
- Test hero heading overflow at every breakpoint

## Accessibility

- WCAG AA minimum
- Focus indicators visible on dark background
- Keyboard navigation for all interactive elements
- `prefers-reduced-motion` support
- Alt text on all images
- Semantic HTML landmarks
