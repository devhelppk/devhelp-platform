import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type BrandLogoProps = React.ComponentProps<"span"> & {
  /** Product name shown after the wordmark, e.g. "Learn" for the LMS. */
  product?: string;
};

/**
 * The devhelp wordmark: a madder block (a nod to ajrak block printing),
 * "devhelp", and a quiet ".pk". Server-safe; wrap in a link from the app.
 */
function BrandLogo({ product, className, ...props }: BrandLogoProps) {
  return (
    <span
      data-slot="brand-logo"
      className={cn(
        "inline-flex items-baseline gap-2 text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 self-center rounded-[2px] bg-madder-600 dark:bg-madder-300"
      />
      <span>
        devhelp
        <span className="font-normal text-muted-foreground">.pk</span>
      </span>
      {product ? (
        <span className="font-normal text-muted-foreground">{product}</span>
      ) : null}
    </span>
  );
}

export { BrandLogo };
