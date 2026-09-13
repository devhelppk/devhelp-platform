import type * as React from "react";
import { cn } from "@repo/ui/lib/utils";

type Token = [kind: "c" | "k" | "s" | "p", text: string];
type Line = { tokens: Token[]; marker?: 1 | 2 | 3; cause?: boolean };

/*
 * A webhook handler that charges a customer twice: the payment provider
 * retries a delivery that timed out, and the charge carries no idempotency
 * key. Every line is at most 34 characters so the panel fits a 390px screen
 * without scrolling. Highlighting is hand-written; there is no highlighter.
 */
const LINES: Line[] = [
  { tokens: [["c", "// customer charged twice"]], marker: 1 },
  {
    tokens: [
      ["k", "export async function "],
      ["p", "onPay(req) {"],
    ],
  },
  {
    tokens: [
      ["k", "  const "],
      ["p", "evt = "],
      ["k", "await "],
      ["p", "req.json();"],
    ],
  },
  { tokens: [["c", "  // a retry arrives here too"]], marker: 2 },
  {
    tokens: [
      ["k", "  const "],
      ["p", "order = "],
      ["k", "await "],
      ["p", "db.order("],
    ],
  },
  { tokens: [["p", "    evt.orderId,"]] },
  { tokens: [["p", "  );"]] },
  {
    tokens: [
      ["k", "  await "],
      ["p", "payments.charge({"],
    ],
    marker: 3,
    cause: true,
  },
  { tokens: [["p", "    amount: order.total,"]] },
  {
    tokens: [
      ["p", "    currency: "],
      ["s", '"PKR"'],
      ["p", ","],
    ],
  },
  { tokens: [["c", "    // no idempotency key"]] },
  { tokens: [["p", "  });"]] },
  {
    tokens: [
      ["k", "  return "],
      ["p", "ok();"],
    ],
  },
  { tokens: [["p", "}"]] },
];

const TOKEN_CLASS: Record<Token[0], string> = {
  c: "text-muted-foreground",
  k: "text-brand-700 dark:text-brand-300",
  s: "text-foreground",
  p: "text-foreground",
};

const STEPS = [
  { n: 1, text: "Start at the symptom" },
  { n: 2, text: "Follow the data backwards" },
  { n: 3, text: "Prove the fix with a test" },
];

function Marker({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary font-sans text-xs font-medium text-primary-foreground",
        className,
      )}
    >
      {n}
    </span>
  );
}

/**
 * The hero device: a broken handler with the three moves of tracing marked on
 * it. The panel is decorative; the caption and the list say the same thing.
 */
export function TraceFigure({
  className,
  ...props
}: React.ComponentProps<"figure">) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-5", className)} {...props}>
      <figcaption className="sr-only">
        A payment webhook handler that charges a customer twice. Tracing it
        starts at the symptom, a customer charged twice; follows the data
        backwards through the retried delivery; and ends at the cause, a charge
        sent without an idempotency key, which a test then proves fixed.
      </figcaption>
      <div
        aria-hidden="true"
        className="min-w-0 overflow-hidden rounded-lg border bg-muted/40 py-3"
      >
        <pre className="overflow-hidden font-mono text-xs leading-6 whitespace-pre sm:text-sm">
          {LINES.map((line, i) => (
            <span
              key={i}
              className={cn(
                "flex items-center border-l-2 border-transparent pr-3",
                line.cause &&
                  "border-madder-600 bg-madder-50/60 dark:border-madder-300 dark:bg-madder-950/40",
              )}
            >
              <span className="flex w-9 shrink-0 justify-center">
                {line.marker ? <Marker n={line.marker} /> : null}
              </span>
              <code data-trace-line="">
                {line.tokens.map(([kind, text], j) => (
                  <span key={j} className={TOKEN_CLASS[kind]}>
                    {text}
                  </span>
                ))}
              </code>
            </span>
          ))}
        </pre>
      </div>
      <ol className="flex flex-col gap-3 text-sm">
        {STEPS.map((s) => (
          <li key={s.n} className="flex items-center gap-3">
            <Marker n={s.n} />
            {s.text}
          </li>
        ))}
      </ol>
    </figure>
  );
}
