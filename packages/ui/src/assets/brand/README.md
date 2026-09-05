# devhelp brand assets

Redrawn as SVG from the legacy `devhelppk` GitHub avatar (a speech-bubble tile with a `</>` glyph).

| File             | Use                                                   |
| ---------------- | ----------------------------------------------------- |
| `mark.svg`       | Indigo tile, paper glyph. Favicon, avatars, light UI. |
| `mark-ink.svg`   | Ink tile. Print / monochrome on light.                |
| `mark-paper.svg` | Paper tile, ink glyph. On dark or photo backgrounds.  |
| `logo.svg`       | Horizontal wordmark for light backgrounds.            |
| `logo-dark.svg`  | Horizontal wordmark for dark backgrounds.             |

In React use `BrandMark` / `BrandLogo` from `@repo/ui/components/*`; they follow the theme automatically. The static files are for places that cannot run React: favicons, README badges, social cards, slides.
