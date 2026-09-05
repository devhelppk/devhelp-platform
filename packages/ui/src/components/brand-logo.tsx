import * as React from "react";
import { BrandMark } from "@repo/ui/components/brand-mark";
import { cn } from "@repo/ui/lib/utils";

type BrandLogoProps = React.ComponentProps<"span"> & {
  /** Product name shown after the wordmark, e.g. "Learn" for the LMS. */
  product?: string;
};

/**
 * The devhelp wordmark: the `</>` speech-bubble mark, "devhelp", and a quiet
 * ".pk". Server-safe; wrap in a link from the app.
 */
function BrandLogo({ product, className, ...props }: BrandLogoProps) {
  return (
    <span
      data-slot="brand-logo"
      className={cn(
        "inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    >
      <BrandMark className="size-[1.35em]" size={22} />
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
