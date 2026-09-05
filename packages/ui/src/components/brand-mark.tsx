import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type BrandMarkProps = React.ComponentProps<"svg"> & {
  /** Pixel size of the square mark. Defaults to 24. */
  size?: number;
};

/**
 * The devhelp mark, redrawn from the legacy devhelppk avatar: a speech-bubble
 * tile (square bottom-left corner) carrying a `</>` glyph. The tile takes
 * `currentColor`; the glyph takes `--brand-mark-glyph` (default: the page
 * background), so set `text-primary`, `text-foreground`, or `text-madder-600`
 * on it, and override the glyph variable on inverted surfaces.
 */
function BrandMark({ size = 24, className, ...props }: BrandMarkProps) {
  return (
    <svg
      data-slot="brand-mark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 text-primary", className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M10 3h12a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H3V10a7 7 0 0 1 7-7Z"
      />
      <path
        fill="none"
        stroke="var(--brand-mark-glyph, var(--background))"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.5 12L8.5 16L12.5 20M19.5 12L23.5 16L19.5 20M17.75 10.25L14.25 21.75"
      />
    </svg>
  );
}

export { BrandMark };
