import { Badge } from "@repo/ui/components/badge";

/**
 * A 1-5 score as stars. The fill is clipped to the exact value rather than
 * rounded, so 3.5 does not read as 4, and the empty track is a real border
 * colour so filled and empty are still distinct in dark mode.
 */
export function Rating({
  value,
  count,
}: {
  value: number | null;
  count?: number;
}) {
  if (value === null)
    return <span className="text-muted-foreground">No reviews yet</span>;
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="flex items-center gap-2">
      <span
        className="relative inline-block leading-none"
        role="img"
        aria-label={`${value.toFixed(1)} out of 5`}
      >
        <span aria-hidden className="text-border dark:text-muted-foreground/40">
          ★★★★★
        </span>
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden text-brand-600 dark:text-brand-400"
          style={{ width: `${pct}%` }}
        >
          ★★★★★
        </span>
      </span>
      <span className="font-medium">{value.toFixed(1)}</span>
      {count !== undefined ? (
        <span className="text-muted-foreground">
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      ) : null}
    </span>
  );
}

/** One sub-score row on the company page. */
export function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-brand-600 dark:bg-brand-400"
          style={{ width: `${((value ?? 0) / 5) * 100}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right tabular-nums">
        {value === null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

const affiliationLabels = {
  employee: "Verified employee",
  student: "Verified student",
  unverified: null,
} as const;

/** Says what we can stand behind about a contributor, and nothing more. */
export function Affiliation({
  value,
}: {
  value: keyof typeof affiliationLabels;
}) {
  const label = affiliationLabels[value];
  if (!label) return null;
  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}

/** `YYYY-MM` as a readable month. */
export function Month({ value }: { value: string | null }) {
  if (!value) return null;
  const [y, m] = value.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return (
    <span className="text-xs text-muted-foreground">
      {date.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
    </span>
  );
}

/**
 * The numbers a reader decides on, in one strip above the sections that explain
 * them, doubling as the page's jump navigation.
 *
 * Before this, the recommend rate was muted text at the foot of the score-bar
 * card, below five bars that merely break it down, and a long page offered no
 * way to reach pay or interviews except scrolling past every review.
 */
export function AtAGlance({
  recommendPct,
  reviewCount,
  interviewCount,
  payRoleCount,
}: {
  recommendPct: number | null;
  reviewCount: number;
  interviewCount: number;
  payRoleCount: number;
}) {
  const stats: { value: string; label: string; href?: string }[] = [];
  if (recommendPct !== null)
    stats.push({
      value: `${recommendPct}%`,
      label: "would recommend",
      href: "#reviews",
    });
  if (payRoleCount > 0)
    stats.push({
      value: String(payRoleCount),
      label: payRoleCount === 1 ? "role with pay" : "roles with pay",
      href: "#pay",
    });
  stats.push({
    value: String(reviewCount),
    label: reviewCount === 1 ? "review" : "reviews",
    href: reviewCount > 0 ? "#reviews" : undefined,
  });
  stats.push({
    value: String(interviewCount),
    label: interviewCount === 1 ? "interview" : "interviews",
    href: interviewCount > 0 ? "#interviews" : undefined,
  });
  if (stats.every((s) => s.value === "0")) return null;
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border p-4">
      {stats.map((s) => (
        <li key={s.label}>
          {s.href ? (
            <a
              href={s.href}
              className="group flex flex-col rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="font-display text-2xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
                {s.value}
              </span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </a>
          ) : (
            <span className="flex flex-col">
              <span className="font-display text-2xl font-semibold tracking-tight text-muted-foreground">
                {s.value}
              </span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
