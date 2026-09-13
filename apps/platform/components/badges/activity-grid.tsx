import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { cn } from "@repo/ui/lib/utils";

/**
 * A year of activity as 53 columns of 7 days, server-rendered: no charting
 * library, no client JS. Colour is four steps of the brand token, so the dark
 * theme needs no second palette.
 */
type ActivityDay =
  inferRouterOutputs<AppRouter>["learning"]["activity"][number];

export function ActivityGrid({ days }: { days: ActivityDay[] }) {
  // Pad the first column so each row is a weekday (Monday first).
  const first = days[0];
  const lead = first
    ? (new Date(`${first.day}T00:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const cells: (ActivityDay | null)[] = [...Array(lead).fill(null), ...days];
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = days.reduce((n, d) => n + d.events, 0);
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="flex gap-[3px] overflow-x-auto pb-1"
        role="img"
        aria-label={`${total} actions over the last year`}
      >
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((d, j) =>
              d ? (
                <span
                  key={d.day}
                  title={`${d.events === 0 ? "Nothing" : `${d.events} action${d.events === 1 ? "" : "s"}`} on ${d.day}`}
                  className={cn(
                    "size-[11px] rounded-[2px]",
                    d.events === 0
                      ? "bg-muted"
                      : d.events < 3
                        ? "bg-primary/30"
                        : d.events < 6
                          ? "bg-primary/60"
                          : "bg-primary",
                  )}
                />
              ) : (
                <span key={`pad-${i}-${j}`} className="size-[11px]" />
              ),
            )}
          </div>
        ))}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {total} action{total === 1 ? "" : "s"} in the last year, counted in
        Pakistan time.
      </figcaption>
    </figure>
  );
}
