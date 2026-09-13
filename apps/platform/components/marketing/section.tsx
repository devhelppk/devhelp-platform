import type * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type SectionProps = React.ComponentProps<"section"> & {
  /** `paper` is the page ground; `mist` a muted band. Alternate them, never two mist in a row. */
  tone?: "paper" | "mist";
  /** Classes for the inner `max-w-6xl` container. */
  innerClassName?: string;
};

/** A full-bleed band of a marketing page, ruled at the top, with the page container inside. */
export function Section({
  tone = "paper",
  className,
  innerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("border-t", tone === "mist" && "bg-muted/30", className)}
      {...props}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24",
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
