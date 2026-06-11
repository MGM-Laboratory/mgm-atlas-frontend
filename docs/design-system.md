# MGM Atlas design system

The visual identity is locked into design tokens in
[`tailwind.config.ts`](../tailwind.config.ts). Components consume tokens —
never literals. This page is the human-readable reference.

<img src="screenshots/main-header.png" alt="Atlas header showing the wordmark, navigation, search, and user menu" width="100%">

## The five laws

1. **Tokens, not literals.** No hand-rolled hex values, no custom
   `transition-duration`, no arbitrary shadows. If a value isn't a token,
   it doesn't ship.
2. **One leading brand color per surface.** Each component picks blue,
   yellow, red, *or* green deliberately. The only place all four appear
   together is the geometric pattern (`<PatternCorner>` / `<PatternDado>`
   in `components/brand/`).
3. **Stroke icons only.** Lucide with `strokeWidth={2.25}`. No filled
   variants, no mixed icon sets.
4. **Restrained motion.** Compose from the duration + easing tokens;
   `prefers-reduced-motion` is honored globally via `globals.css`.
5. **Pattern as accent, never wallpaper.** Corners and dadoes only — the
   pattern is a signature, not a texture.

## Color

| Token | Hex | Use |
|---|---|---|
| `brand.blue` | `#3a6dc5` | Primary actions, links, focus ring |
| `brand.yellow` | `#f7bf33` | Highlights, warm accents |
| `brand.red` | `#f94141` | Destructive, alerts |
| `brand.green` | `#0f8657` | Success, growth |
| `brand.blue-50` | `#ecf1fa` | Tinted blue surfaces |
| `brand.yellow-50` | `#fef6e0` | Tinted yellow surfaces |
| `brand.red-50` | `#fee5e5` | Tinted red surfaces |
| `brand.green-50` | `#e2f1ea` | Tinted green surfaces |
| `brand.yellow-ink` | `#8a6d18` | Readable text on yellow tints |
| `ink` | `#0e1116` | Primary text |
| `ink-2` / `ink-3` / `ink-4` | `#3b4150` / `#6b7280` / `#9aa1ad` | Secondary → quaternary text |
| `line` / `line-strong` | `#ececea` / `#d8d8d2` | Hairlines and borders |
| `focus` | `#3a6dc5` | Keyboard focus outline |

Light mode only — there is deliberately no dark theme today.

## Typography

Fonts load via `next/font` and are exposed as CSS variables:
`--font-bricolage` (display), `--font-geist` (sans), `--font-geist-mono` (mono).

Type ramp (each step defines size, line-height, letter-spacing):

| Token | Shape |
|---|---|
| `display-2xl` | `clamp(2.5rem → 4.5rem)`, weight 600, −0.03em |
| `display-xl` / `display-lg` | Hero and section displays |
| `h1` … `h4` | Headings |
| `body-lg` / `body` / `body-sm` | Copy sizes |
| `caption` | Metadata |
| `eyebrow` | Small caps labels above titles |

## Radii & elevation

| Token | Value |
|---|---|
| `rounded-sm` | 8 px |
| `rounded` (default) | 12 px |
| `rounded-lg` | 20 px |
| `rounded-xl` | 28 px |
| `shadow-1` → `shadow-3` | Three elevation steps — nothing beyond `3` |

## Motion

| Token | Value |
|---|---|
| Durations | `120` · `200` · `320` · `520` · `800` (ms) |
| `out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `in-out-soft` | Symmetric soft ease |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Keyframes | `fade-up` · `fade-in` · `modal-in` · `shimmer` · `spin-slow` |

Micro-interactions use `120–200`; entrances `320`; celebratory moments `520+`.

## Components

- **Primitives** (`src/components/ui/`) — Radix wrapped with CVA variants:
  avatar, badge, button, card, checkbox, dialog, dropdown-menu, empty-state,
  input, label, popover, scroll-row, select, skeleton, switch, tabs,
  textarea, toast, tooltip. Build features by composing these; never reach
  for raw Radix in feature code.
- **Brand** (`src/components/brand/`) — `Wordmark`, `ShapeSignature`,
  `PatternCorner`, `PatternDado`.

## Voice & tone in UI copy

Short, confident, lowercase-friendly. Empty states explain the next action
("Start a project", "Invite your first contributor") rather than apologize.
