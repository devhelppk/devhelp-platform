import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { Page } from "@/components/shell/site-header";
import { Rating } from "@/components/companies/bits";

export const metadata: Metadata = {
  title: "Companies",
  description:
    "What it is actually like to work at software companies in Pakistan, written by the people who work there.",
};
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * The company directory. Filters are a plain GET form rendered on the server:
 * no client JavaScript, which keeps this page inside the bundle budget and
 * makes every filtered view a shareable URL.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const city = one(sp.city);
  const industry = one(sp.industry);
  const sortRaw = one(sp.sort);
  const sort =
    sortRaw === "rating" || sortRaw === "reviews" ? sortRaw : ("name" as const);
  const hiresJuniors = one(sp.juniors) === "1";
  const caller = await api(new Headers(await headers()));
  const [filters, list] = await Promise.all([
    caller.companies.filters(),
    caller.companies.list({ q, city, industry, hiresJuniors, sort, limit: 48 }),
  ]);
  return (
    <Page wide callbackURL="/companies">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Companies
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            What it is actually like to work at software companies in Pakistan,
            written by the people who work there. Missing one?{" "}
            <Link
              href="/companies/propose"
              className="underline underline-offset-4"
            >
              Propose a company
            </Link>
            .
          </p>
        </header>

        <form
          method="get"
          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-xs font-medium">
              Search
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name, technology, industry"
            />
          </div>
          <Field
            id="city"
            label="City"
            value={city}
            options={filters.cityNames}
          />
          <Field
            id="industry"
            label="Industry"
            value={industry}
            options={filters.industries}
          />
          <Field
            id="sort"
            label="Sort by"
            value={sort}
            options={["name", "rating", "reviews"]}
            allLabel={null}
          />
          <label className="flex items-center gap-2 text-sm sm:pb-2">
            <input
              type="checkbox"
              name="juniors"
              value="1"
              defaultChecked={hiresJuniors}
              className="size-4 rounded border-input accent-brand-600"
            />
            Hires juniors
          </label>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>

        <p aria-live="polite" className="text-sm text-muted-foreground">
          {list.items.length}{" "}
          {list.items.length === 1 ? "company" : "companies"}
          {q || city || industry || hiresJuniors ? " match your filters" : ""}.
        </p>

        {list.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No companies match that. Try fewer filters, or{" "}
            <Link
              href="/companies/propose"
              className="underline underline-offset-4"
            >
              propose one
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/companies/${c.slug}` as Route}
                  className="flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex flex-col gap-1">
                    <h2 className="font-medium">{c.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {[c.industry, c.cities.join(", ") || c.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {c.description ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {c.description}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-col gap-2 pt-1 text-sm">
                    <Rating value={c.ratingAvg} count={c.reviewCount} />
                    <div className="flex flex-wrap gap-1.5">
                      {c.hiresJuniors ? (
                        <Badge variant="secondary" className="text-xs">
                          Hires juniors
                        </Badge>
                      ) : null}
                      {c.stack.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}

/** A native select styled like the rest of the form; no client island needed. */
function Field({
  id,
  label,
  value,
  options,
  allLabel = "Any",
}: {
  id: string;
  label: string;
  value?: string;
  options: readonly string[];
  allLabel?: string | null;
}) {
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value ?? ""}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm capitalize shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
