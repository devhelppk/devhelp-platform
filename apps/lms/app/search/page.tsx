import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import type { Metadata } from "next";
import type { Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "Search",
  description: "Search courses, lessons, and companies on devhelp.pk.",
};
export const dynamic = "force-dynamic";

/**
 * Search (X3). Server-rendered from the query string: it costs nothing in the
 * bundle, every result page is a link somebody can share, and it works before
 * any JavaScript has loaded.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (raw ?? "").trim();
  const results =
    q.length >= 2
      ? await api(new Headers(await headers())).then((c) =>
          c.search.query({ q }),
        )
      : null;
  return (
    <Page callbackURL="/search">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Search
          </h1>
          <form method="get" className="flex gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Courses, lessons, companies"
              aria-label="Search"
              autoFocus
              className="max-w-md"
            />
            <Button type="submit">Search</Button>
          </form>
        </header>

        {results === null ? (
          <p className="text-sm text-muted-foreground">
            Type at least two characters.
          </p>
        ) : results.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing matches “{q}”. Try a shorter query, or browse{" "}
            <Link href="/courses" className="underline underline-offset-4">
              the courses
            </Link>{" "}
            and{" "}
            <Link href="/companies" className="underline underline-offset-4">
              the companies
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            <Group title="Courses" count={results.courses.length}>
              {results.courses.map((c) => (
                <li key={c.slug} className="px-4 py-3 text-sm">
                  <Link
                    href={`/courses/${c.slug}` as Route}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <Badge variant="outline" className="ml-2 text-xs capitalize">
                    {c.level}
                  </Badge>
                  <p className="mt-1 text-muted-foreground">{c.summary}</p>
                </li>
              ))}
            </Group>
            <Group title="Lessons" count={results.lessons.length}>
              {results.lessons.map((l) => (
                <li
                  key={`${l.courseSlug}/${l.slug}`}
                  className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                >
                  <Link
                    href={`/courses/${l.courseSlug}/${l.slug}` as Route}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {l.title}
                  </Link>
                  <Badge variant="outline" className="text-xs capitalize">
                    {l.type}
                  </Badge>
                  <span className="text-muted-foreground">
                    in {l.courseTitle}
                  </span>
                </li>
              ))}
            </Group>
            <Group title="Companies" count={results.companies.length}>
              {results.companies.map((c) => (
                <li key={c.slug} className="px-4 py-3 text-sm">
                  <Link
                    href={`/companies/${c.slug}` as Route}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.industry ? (
                    <span className="ml-2 text-muted-foreground">
                      {c.industry}
                    </span>
                  ) : null}
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {c.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </Group>
          </div>
        )}
      </div>
    </Page>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({count})
        </span>
      </h2>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </section>
  );
}
