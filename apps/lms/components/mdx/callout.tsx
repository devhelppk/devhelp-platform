import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

type Kind = "note" | "tip" | "warning";
const styles: Record<Kind, string> = {
  note: "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40",
  tip: "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40",
  warning:
    "border-madder-300 bg-madder-50 dark:border-madder-700 dark:bg-madder-950/40",
};

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: Kind;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "my-6 rounded-md border-l-4 px-4 py-3 text-[0.95em]",
        styles[kind],
      )}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </aside>
  );
}
