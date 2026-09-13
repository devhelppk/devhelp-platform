import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { Flame } from "lucide-react";

type Streak = inferRouterOutputs<AppRouter>["learning"]["streak"];

export function StreakLine({ streak }: { streak: Streak }) {
  if (streak.activeDays === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Finish a lesson to start a streak.
      </p>
    );
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Flame
        aria-hidden="true"
        className={
          streak.current > 0
            ? "size-4 text-primary"
            : "size-4 text-muted-foreground"
        }
      />
      {streak.current > 0 ? (
        <span>
          <span className="font-medium">{days(streak.current)} in a row</span>
          <span className="text-muted-foreground">
            , {days(streak.activeDays)} active in the last year
            {streak.longest > streak.current
              ? `, longest run ${days(streak.longest)}`
              : ""}
            .
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">
          No streak right now. Your longest run was {days(streak.longest)}.
        </span>
      )}
    </p>
  );
}
