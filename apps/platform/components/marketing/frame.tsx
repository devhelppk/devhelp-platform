import type * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type FrameProps = React.ComponentProps<"div"> & {
  /** The address shown in the title bar. */
  path?: string;
  /** Classes for the content box under the title bar. */
  contentClassName?: string;
};

/**
 * A product frame: a miniature of a real screen, drawn with static JSX.
 *
 * Decorative only (`aria-hidden`); whatever it shows must also be said in the
 * surrounding text. The content box is a fixed aspect ratio and clips, so a
 * miniature can never push the page wider.
 */
export function Frame({
  path = "learn.devhelp.pk",
  className,
  contentClassName,
  children,
  ...props
}: FrameProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none min-w-0 overflow-hidden rounded-lg border bg-card text-sm text-card-foreground select-none",
        className,
      )}
      {...props}
    >
      <div className="flex h-8 items-center gap-3 border-b bg-muted/40 px-3">
        <div className="flex shrink-0 gap-1.5">
          <span className="size-2 rounded-sm bg-border" />
          <span className="size-2 rounded-sm bg-border" />
          <span className="size-2 rounded-sm bg-border" />
        </div>
        <span className="truncate text-xs text-muted-foreground">{path}</span>
      </div>
      <div
        className={cn(
          "@container relative aspect-[4/3] overflow-hidden md:aspect-[16/10]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
