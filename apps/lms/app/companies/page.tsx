import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { DirectoryFilters } from "@/components/companies/directory-filters";
import { loadCompanyList } from "@/lib/search-params";
import { Page } from "@/components/shell/site-header";
import { Rating } from "@/components/companies/bits";
import { CompanyMark } from "@/components/companies/company-mark";

export const metadata: Metadata = {
  title: "Companies",
  description:
    "What it is actually like to work at software companies in Pakistan, written by the people who work there.",
};
export const dynamic = "force-dynamic";

/**
 * The company directory. Parameters are parsed by the shared nuqs loader, so the
 * page and the client filter row agree on every name, type and default; the list
 * itself is still a server query, and every filtered view is a shareable URL.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {
    q,
    city,
    industry,
    sort,
    juniors: hiresJuniors,
  } = await loadCompanyList(searchParams);
  const caller = await api(new Headers(await headers()));
  const [filters, list] = await Promise.all([
    caller.companies.filters(),
    caller.companies.list({
      q: q || undefined,
      city: city || undefined,
      industry: industry || undefined,
      hiresJuniors,
      sort,
      limit: 48,
    }),
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

        <DirectoryFilters
          cityNames={filters.cityNames}
          industries={filters.industries}
        />

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
                  <div className="flex items-start gap-3">
                    <CompanyMark id={c.id} version={c.markVersion} />
                    <div className="flex flex-col gap-1">
                      <h2 className="font-medium">{c.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {[c.industry, c.cities.join(", ") || c.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
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
