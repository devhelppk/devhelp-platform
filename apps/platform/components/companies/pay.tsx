import { Badge } from "@repo/ui/components/badge";
import { ReportSalaries } from "./report-salaries";

type Row = {
  roleId: string | null;
  currency: "PKR" | "USD";
  n: number;
  /** Null below eight reports: three order statistics of five say too much. */
  p25: number | null;
  median: number | null;
  p75: number | null;
  firstYear: number | null;
  lastYear: number | null;
};
type RoleRow = Row & { roleName: string | null };
type DetailRow = Row & { level: string | null; cityName: string | null };

/** The period a row's reports cover, so a reader knows how current it is. */
function years(r: Row) {
  if (!r.firstYear || !r.lastYear) return null;
  return r.firstYear === r.lastYear
    ? `Reported in ${r.firstYear}`
    : `Reported ${r.firstYear} to ${r.lastYear}`;
}

/** Minor units to a readable monthly figure. */
function money(minor: number | null, currency: string) {
  if (minor === null) return "—";
  const whole = Math.round(minor / 100);
  return `${currency} ${whole.toLocaleString("en-GB")}`;
}

/**
 * What a company pays (F2.6, F2.7). Every number here is an aggregate over at
 * least five points, because the `n >= 5` floor lives in the views themselves;
 * there is no code path that could render an individual salary. Figures stay in
 * the currency they were earned in, with the converted figure only as an aid.
 */
export function Pay({
  roles,
  detail,
  fx,
  companyName,
  slug,
  signedIn,
}: {
  roles: RoleRow[];
  detail: DetailRow[];
  fx: { rate: number; asOf: string } | null;
  companyName: string;
  slug: string;
  signedIn: boolean;
}) {
  if (roles.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Not enough data yet. Pay is only shown once at least five people have
        reported the same role, so no single figure can be traced back to
        anyone. If you have worked at {companyName}, adding yours brings that
        closer.
      </p>
    );
  const rows = roles.map((r) => ({
    ...r,
    // A cell with neither a level nor a city says nothing the role row has not
    // already said, so it is dropped rather than shown as a second line.
    cells: detail.filter(
      (d) =>
        d.roleId === r.roleId &&
        d.currency === r.currency &&
        (d.level || d.cityName),
    ),
  }));
  const converted = (r: Row) =>
    r.currency === "USD" && fx && r.median !== null
      ? `\u2248 PKR ${Math.round((r.median / 100) * fx.rate).toLocaleString("en-GB")}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Below `sm` the same figures are a list of cards. A four-column table
          on a phone either overflows the page or clips inside a scroller with
          no sign that there is more to the right. */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((r) => (
          <li
            key={`${r.roleId}-${r.currency}`}
            className="flex flex-col gap-2 rounded-lg border p-4 text-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium">{r.roleName ?? "Other"}</h3>
              <Badge variant="outline" className="text-xs">
                {r.n} reports
              </Badge>
            </div>
            <p>
              <span className="text-lg font-medium">
                {money(r.median, r.currency)}
              </span>{" "}
              <span className="text-muted-foreground">a month, typically</span>
              {converted(r) ? (
                <span className="block text-xs text-muted-foreground">
                  {converted(r)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{years(r)}</p>
            <p className="text-xs text-muted-foreground">
              {r.p25 === null || r.p75 === null
                ? "The middle half needs eight reports."
                : `Middle half: ${money(r.p25, r.currency)} to ${money(r.p75, r.currency)}`}
            </p>
            {r.cells.length ? (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {r.cells.map((c) => (
                  <li key={`${c.level}-${c.cityName}`}>
                    {[c.level, c.cityName].filter(Boolean).join(", ")}:{" "}
                    <span className="text-foreground">
                      {money(c.median, c.currency)}
                    </span>{" "}
                    (n = {c.n})
                  </li>
                ))}
              </ul>
            ) : null}
            <ReportSalaries
              slug={slug}
              roleId={r.roleId}
              roleName={r.roleName ?? "this role"}
              currency={r.currency}
              signedIn={signedIn}
            />
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Monthly pay at {companyName} by role, as a median and a middle range
          </caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="border-b px-3 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="border-b px-3 py-2 font-medium">
                Median / month
              </th>
              <th scope="col" className="border-b px-3 py-2 font-medium">
                Middle half
              </th>
              <th scope="col" className="border-b px-3 py-2 font-medium">
                Based on
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.roleId}-${r.currency}`} className="align-top">
                <th
                  scope="row"
                  className="border-b px-3 py-3 text-left font-medium"
                >
                  {r.roleName ?? "Other"}
                  {r.cells.length ? (
                    <ul className="mt-1 flex flex-col gap-0.5 text-xs font-normal text-muted-foreground">
                      {r.cells.map((c) => (
                        <li key={`${c.level}-${c.cityName}`}>
                          {[c.level, c.cityName].filter(Boolean).join(", ")}:{" "}
                          <span className="text-foreground">
                            {money(c.median, c.currency)}
                          </span>{" "}
                          (n = {c.n})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </th>
                <td className="border-b px-3 py-3">
                  <span className="font-medium">
                    {money(r.median, r.currency)}
                  </span>
                  {converted(r) ? (
                    <span className="block text-xs text-muted-foreground">
                      {converted(r)}
                    </span>
                  ) : null}
                </td>
                <td className="border-b px-3 py-3 text-muted-foreground">
                  {r.p25 === null || r.p75 === null
                    ? "Needs 8 reports"
                    : `${money(r.p25, r.currency)} to ${money(r.p75, r.currency)}`}
                </td>
                <td className="border-b px-3 py-3">
                  <Badge variant="outline" className="text-xs">
                    {r.n} reports
                  </Badge>
                  <ReportSalaries
                    slug={slug}
                    roleId={r.roleId}
                    roleName={r.roleName ?? "this role"}
                    currency={r.currency}
                    signedIn={signedIn}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-prose text-xs text-muted-foreground">
        Monthly base pay for staff roles, in the currency people were paid in,
        reported in the last three years. Yearly figures are divided by twelve
        and internships are counted separately. A row appears only once five or
        more people have reported it, and every figure is rounded, so no
        individual salary is shown.
        {fx
          ? ` Conversions use USD 1 = PKR ${fx.rate.toLocaleString("en-GB")}, from ${fx.asOf}.`
          : ""}
      </p>
    </div>
  );
}
