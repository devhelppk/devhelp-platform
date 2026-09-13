import type * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { Frame } from "./frame";

const LESSONS = [
  { title: "Welcome" },
  { title: "How agents work" },
  { title: "Trace the refund", current: true },
  { title: "Foundations check" },
];

const OUTLINE = ["The symptom", "Follow the data", "The fix"];

/** The lesson reader in miniature: module rail, reading column, page outline. */
export function ReaderFrame({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Frame>, "children">) {
  return (
    <Frame
      path="learn.devhelp.pk/courses/ai-engineering-foundations"
      className={className}
      {...props}
    >
      <div className="flex h-full">
        <div className="flex w-32 shrink-0 flex-col gap-3 border-r bg-muted/20 p-3 @md:w-40">
          <p className="text-xs font-medium">Foundations</p>
          <ul className="flex flex-col gap-1">
            {LESSONS.map((l) => (
              <li
                key={l.title}
                className={cn(
                  "relative truncate py-1 pl-3 text-xs",
                  l.current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {l.current ? (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                ) : null}
                {l.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 @md:p-6">
          <p className="text-xs text-muted-foreground">Foundations</p>
          <p className="font-display text-xl font-semibold tracking-tight @md:text-2xl">
            Trace the refund
          </p>
          <p className="font-display text-sm text-pretty @md:text-base">
            A customer was refunded twice. Start where they noticed it, and
            follow the money back through the code.
          </p>
          <p className="font-display text-sm text-pretty text-muted-foreground @md:text-base">
            Every step you take, write down what you expected to find.
          </p>
        </div>
        <div className="hidden w-36 shrink-0 flex-col gap-2 p-4 @xl:flex">
          <p className="text-xs font-medium">On this page</p>
          <ul className="flex flex-col gap-1.5">
            {OUTLINE.map((o) => (
              <li key={o} className="truncate text-xs text-muted-foreground">
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}
