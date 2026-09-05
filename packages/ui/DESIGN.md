# devhelp design system

devhelp.pk is a free, open-source learning platform for Pakistan's software
engineers and students. The audience reads on mid-range Android phones and
laptops, often on slow connections, often at night. The tone is serious,
generous, modern, and Pakistani without being a tourist poster. This document
is the source of truth for tokens, type, layout and component conventions in
`@repo/ui`; the living style guide is `/design` in `apps/web`.

## Direction in one paragraph

The palette comes from ajrak, the Sindhi block-printed cloth: deep indigo,
madder red, and undyed cotton. Indigo is the working colour (buttons, links,
focus); madder is spent sparingly (the wordmark block,
destructive actions). Headlines and reading prose are set in Literata, a serif
that TypeTogether drew for Google Play Books and tuned for reading on Android
screens, which is literally where our students read. Interface text stays in
Geist Sans. The signature is the pairing itself: a reading serif against a
plain interface sans, indigo doing the work, a single small madder block in the
wordmark. Nothing else is decorated.

## What we deliberately did not do

We reviewed the first draft against the generic "learning platform" page and
changed these things:

- Flag green as the brand colour. It is the first thing anyone reaches for with
  "Pakistan" and it makes every screen look like a government portal. Ajrak
  indigo and madder are just as rooted and far less used.
- A cream background with a serif display and a terracotta accent. That is
  today's default AI page. Our background is near-white paper, the accent is a
  cold madder, and the serif is a reading face rather than a display face.
- Gradient hero, stat row with invented numbers, and feature cards with icons
  in circles. A page opens with a headline and the thing itself.
- Tracked-out all-caps eyebrows, middle-dot meta strings, monospace labels,
  arrows appended to buttons. Meta reads as a sentence: "3 sections, 12 pages".
- Identical rounded cards with soft drop shadows. Cards are 1px-bordered, flat,
  6px radius; only floating surfaces (menus, dialogs, toasts) get a shadow.

## Colour

Base palette (light):

| Name   | Hex       | oklch                    | Use                                 |
| ------ | --------- | ------------------------ | ----------------------------------- |
| Ink    | `#141831` | `oklch(0.22 0.05 275)`   | Text, headings, dark-mode ground    |
| Indigo | `#313E8C` | `oklch(0.40 0.13 272)`   | Primary actions, links, focus       |
| Madder | `#B63132` | `oklch(0.52 0.17 25)`    | Wordmark block, destructive actions |
| Paper  | `#FEFDFC` | `oklch(0.995 0.002 90)`  | Page background                     |
| Mist   | `#F2F3F8` | `oklch(0.965 0.006 275)` | Muted and secondary surfaces        |
| Line   | `#DCDEE5` | `oklch(0.90 0.01 275)`   | Borders, inputs                     |

Dark mode inverts onto an indigo-tinted ground, not a neutral black:
background `oklch(0.19 0.04 275)` (`#101430`), card `oklch(0.23 0.04 275)`,
foreground `oklch(0.96 0.01 90)`, primary becomes `brand-300` (`#A9BBF8`) with
ink text on it, madder becomes `madder-300`.

Contrast (WCAG): ink/paper 17.2, indigo/paper 9.4, madder/paper 5.9,
muted-foreground/paper 5.9, white on indigo 9.5, white on madder 6.0. Dark:
foreground/background 17.1, primary/background 10.2, muted/background 7.7.

Tailwind scales (in `packages/tailwind-config/shared-styles.css`):

- `brand-50…950` — indigo, hue 272. `brand-600` is the primary in light mode.
- `madder-50…950` — madder, hue 25. `madder-600` is the accent in light mode.
- Semantic shadcn tokens (`background`, `primary`, `muted`, `ring`, ...) live in
  `packages/ui/src/styles/globals.css` and map onto these. Use the semantic
  token first; reach for `brand-*`/`madder-*` only for swatches, tinted
  badges, and the wordmark.

Madder is an accent, not a second brand colour. It appears in the wordmark
block and on destructive actions. Never use it for emphasis in running text.
Product areas may later assign the two colours to categories; that mapping is
not part of the base system.

## Typography

- Display and prose: **Literata** (variable, optical size 7–72, weight 400–700)
  via `next/font/google` as `--font-literata`, exposed as `font-display`.
  Headings use weight 500–600 and tight leading. Long-form bodies use the
  `prose-lesson` utility: 400 at 17px with 1.65 line height and a 65ch
  measure; serif prose gets a little more leading.
- Interface and body: **Geist Sans** (`font-sans`), weights 400/500/600.
- Code: **Geist Mono** (`font-mono`). Only for code, never for labels or meta.

Type scale is a major third (1.25) from 16px, rounded, and overrides
Tailwind's `text-2xl` and up so utilities stay familiar:

| Utility     | Size | Line height | Role                       |
| ----------- | ---- | ----------- | -------------------------- |
| `text-xs`   | 12px | 1.33        | Captions, badge text       |
| `text-sm`   | 14px | 1.43        | UI text, meta, form labels |
| `text-base` | 16px | 1.5         | Body                       |
| `text-lg`   | 18px | 1.55        | Lead paragraphs            |
| `text-xl`   | 20px | 1.4         | h4, card titles            |
| `text-2xl`  | 25px | 1.25        | h3                         |
| `text-3xl`  | 31px | 1.2         | h2, section titles         |
| `text-4xl`  | 39px | 1.1         | h1, page titles            |
| `text-5xl`  | 49px | 1.05        | Landing hero on tablet     |
| `text-6xl`  | 61px | 1.0         | Landing hero on desktop    |

Rules: headings are sentence case. No all-caps labels, no letter-spaced
eyebrows. Do not colour a single word in a headline. Keep measures under 70
characters (`max-w-prose` is set to 65ch). Use `text-balance` on headings and
`text-pretty` on lead paragraphs.

## Spacing, radius, elevation

- 4px base grid. Component padding uses 3/4/5/6 (12–24px). Section rhythm is
  `py-16` on mobile and `py-24` from `md`.
- Page container: `max-w-6xl` (72rem) with `px-4` on mobile and `px-6` from
  `sm`. Reading column: `max-w-prose`.
- Radius: `--radius: 0.375rem` (6px). Controls `rounded-md`, cards
  `rounded-lg`, badges `rounded-sm` (badges are rectangular, not pills; a pill
  every 40px is the SaaS tell).
- Elevation: static surfaces have a 1px `border` and no shadow. Floating
  surfaces (dropdown, dialog, sheet, tooltip, toast) use `shadow-lg`.
- Motion: only in response to a person's action (open, expand, confirm). No
  entrance animations on scroll. `prefers-reduced-motion` is respected by
  `tw-animate-css` variants; do not add custom keyframes without a reduced-
  motion guard.

## Layout

Everything is left-aligned. Centred text is reserved for empty states.

A page opens with a `PageHeader` (title in Literata, one-line description,
primary action to the right), then sections separated by a 1px rule with
`py-12`. A typical page:

```
| [block] devhelp.pk                          Design  GitHub  [theme] |
|                                                                      |
| Page title                                            [Primary act.] |
| One line that says what this page is for.                            |
| -------------------------------------------------------------------- |
| Section title                                                        |
| Content in a max-w-prose column, or a 2-3 column grid of cards       |
| -------------------------------------------------------------------- |
| footer: wordmark, "Free, open source, made in Pakistan."             |
```

## Components

Base components are shadcn/ui (new-york style, Radix primitives) added via the
CLI into `packages/ui/src/components`. After every `shadcn add`, fix the
import to `@repo/ui/lib/utils` and remove any `cn` package from
`package.json`.

devhelp composites (generic; product-specific components come later):

- `brand-logo.tsx` — `BrandLogo`: madder block + "devhelp" + ".pk", optional
  product name. Server-safe; wrap in a link from the app.
- `page-header.tsx` — `PageHeader`: title (Literata h1), description, actions.
- `theme-provider.tsx`, `theme-toggle.tsx` — next-themes; the toggle cycles
  light → dark → system and its accessible name says what pressing it does.
- `app-shell.tsx` — `AppShell`, `AppShellHeader`, `AppShellContent`: the
  reading layout (sidebar, top bar, content column, optional aside).
- `sidebar-nav.tsx` — `SidebarNav`, `SidebarNavGroup`, `SidebarNavItem`:
  grouped page links; the active item has a 2px primary rail and
  `aria-current="page"`.
- `mobile-nav.tsx` — `MobileNav`: the same navigation behind a button in a
  sheet below `lg`.
- `sonner.tsx` re-exports `toast` so apps do not need a direct dependency.

Conventions:

- Every component takes `className` and spreads `...props`; use `cn`.
- Server components by default; add `"use client"` only for hooks or Radix.
- Icons are lucide, 16px in text, 20px in buttons, never in circles.
- Buttons name the outcome: "Save changes", "Delete draft", "Continue".
- Meta reads as prose: "3 sections, 12 pages, about 4 hours".
- Empty states say what to do next, in one sentence, with one button.

## Do / don't

Do:

- Set headings in `font-display`, UI in `font-sans`.
- Use `text-muted-foreground` for secondary text and nothing lighter.
- Test at 390px; content must never scroll horizontally.

Don't:

- Don't use gradients, glassmorphism, or blurred colour blobs.
- Don't use pills for badges, or shadows on cards.
- Don't use `font-mono` for anything that is not code.
- Don't append arrows to button or link text.
- Don't introduce a third colour; if it needs a colour it is indigo or madder.

## Reference: Compass

The client likes Tailwind Plus's "Compass" course template. We studied its
live preview (overview and lesson pages, desktop and 390px) and took the
structure, not the skin. Its code is licensed and none of it is used here.

What we took:

- The reading shell. A 16rem sidebar of module headings with lesson links
  underneath, a 2px rail on the current lesson, a slim breadcrumb bar across
  the top, a bounded content column, and an "On this page" outline on wide
  screens. Below the laptop breakpoint the sidebar folds behind a single
  panel button. This is `AppShell` + `SidebarNav` + `MobileNav`.
- Reading rhythm. Body text in a ~65ch column with roomy leading (we use 1.7),
  block spacing of about one line, figures and code in a bordered box, and
  section headings that carry a lot of space above and little below. This is
  the `prose-lesson` utility.
- Restraint. Hairline dividers instead of boxes, one accent used rarely, no
  decorative gradients, and a header that stays quiet while you read.
- A media-first page top: on a lesson page the video (or figure) comes before
  the title, full width of the column, with rounded corners and a border.

What we deliberately changed:

- Ground. Compass is dark-first on near-black navy. devhelp is paper-first,
  because most of our readers are on mid-range Android screens in daylight;
  dark mode is an indigo-tinted ground, not a neutral black.
- Type. Compass uses a single neutral grotesk. We pair Literata (headings and
  prose) with Geist (interface), which gives lessons a book-like voice and
  keeps the interface crisp.
- Colour. Compass has one hot accent used almost only in diagrams. We have
  indigo doing the everyday work and madder as the rare accent, both drawn
  from ajrak so the palette is ours.
- Meta and labels. Compass writes "4 modules · 20 lessons · 3 hr 26 min" with
  icons and tracked "Part 1" labels. We write sentences ("4 sections, 20
  pages, about 3 hours") and use sentence-case headings only.
- Shape. Compass buttons are pills; ours are 6px. Cards and figures are
  bordered, never shadowed.

The Compass patterns that are product-specific (video player, lesson
completion, interview index) are not part of the base system and will be
designed with the LMS research.
