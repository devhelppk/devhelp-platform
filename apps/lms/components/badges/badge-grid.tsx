import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { cn } from "@repo/ui/lib/utils";
import { BadgeIcon } from "./badge-icon";

type BadgeRule =
  inferRouterOutputs<AppRouter>["badges"]["catalogue"][number]["rule"];

type Item = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rule?: BadgeRule;
  earnedAt?: Date | null;
};

/** What a rule asks for, in words, so a locked badge reads as a goal. */
export function ruleText(rule: BadgeRule): string {
  switch (rule.kind) {
    case "lessons_in_window":
      return rule.days >= 365
        ? `Finish ${rule.count} lesson${rule.count === 1 ? "" : "s"}`
        : `Finish ${rule.count} lessons within ${rule.days} days`;
    case "streak_days":
      return `Be active ${rule.days} days in a row`;
    case "course_completed":
      return `Finish the ${rule.course.replace(/-/g, " ")} course`;
    case "path_completed":
      return `Finish every course in the ${rule.path.replace(/-/g, " ")} path`;
    case "first_project_accepted":
      return "Pass the checks on a project lesson (coming later)";
  }
}

export function BadgeGrid({
  items,
  compact = false,
}: {
  items: Item[];
  compact?: boolean;
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No badges yet.</p>;
  return (
    <ul
      className={cn(
        "grid gap-3",
        compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {items.map((b) => {
        const earned = !!b.earnedAt;
        return (
          <li
            key={b.slug}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              !earned && "opacity-60",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                earned
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <BadgeIcon name={b.icon} className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-xs text-muted-foreground">
                {b.description}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {earned
                  ? `Earned ${b.earnedAt!.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}`
                  : b.rule
                    ? ruleText(b.rule)
                    : "Not earned yet"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
