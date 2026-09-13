import type * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type SectionHeadingProps = React.ComponentProps<"div"> & {
  title?: React.ReactNode;
  lead?: React.ReactNode;
};

/** A section's `h2` and an optional lead paragraph. No eyebrow, no icon. */
export function SectionHeading({
  title,
  lead,
  className,
  children,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      {lead ? (
        <p className="max-w-prose text-lg text-pretty text-muted-foreground">
          {lead}
        </p>
      ) : null}
      {children}
    </div>
  );
}
