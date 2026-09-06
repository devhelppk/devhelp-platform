import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { api } from "@repo/api/server";
import {
  Affiliation,
  Month,
  Rating,
  ScoreBar,
} from "@/components/companies/bits";
import { Pay } from "@/components/companies/pay";
import { Page } from "@/components/shell/site-header";

export const dynamic = "force-dynamic";

/**
 * Deduped within a request: `generateMetadata` and the page both need it.
 *
 * Read fresh on every request, not cached. A cached read was tried and removed:
 * a moderator who hid a review still saw it on the public page seconds later,
 * which is the exact failure the freshness rule exists to prevent. These are
 * three indexed selects, so the page is cheap without a cache.
 */
const load = cache(async (slug: string) => {
  try {
    const caller = await api(new Headers(await headers()));
    const company = await caller.companies.bySlug({ slug });
    const [reviews, interviews, salaries] = await Promise.all([
      caller.companies.reviews({ slug, limit: 20 }),
      caller.companies.interviews({ slug, limit: 20 }),
      caller.companies.salaries({ slug }),
    ]);
    return { company, reviews, interviews, salaries };
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { company } = await load(slug);
  return {
    title: `${company.name} — reviews and interviews`,
    description:
      company.description ??
      `What it is like to work at ${company.name}, from the people who work there.`,
  };
}

const outcomeLabels = {
  offer: "Offer",
  rejected: "Rejected",
  withdrew: "Withdrew",
  no_response: "No response",
} as const;
const employmentLabels = {
  current: "Current employee",
  former: "Former employee",
  intern: "Intern",
} as const;
const tenureLabels = {
  under_1: "Under a year",
  "1_2": "1–2 years",
  "3_5": "3–5 years",
  "6_10": "6–10 years",
  over_10: "Over 10 years",
} as const;

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, reviews, interviews, salaries } = await load(slug);
  const facts: [string, string][] = [
    ["Industry", company.industry ?? ""],
    ["Size", company.size ?? ""],
    ["Founded", company.founded ? String(company.founded) : ""],
    ["Cities", company.cities.join(", ")],
    [
      "Hires juniors",
      company.hiresJuniors === null
        ? ""
        : company.hiresJuniors
          ? "Yes"
          : "Not usually",
    ],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  return (
    <Page wide callbackURL={`/companies/${slug}`}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href="/companies"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← All companies
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {company.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[company.industry, company.cities.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Rating value={company.ratingAvg} count={company.reviewCount} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/companies/${slug}/contribute` as Route}>
                  Share your experience
                </Link>
              </Button>
              {company.careersUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={company.careersUrl}
                    rel="nofollow noopener"
                    target="_blank"
                  >
                    Careers
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* `min-w-0`: a grid item will not shrink below its content by
              default, so without it the pay table's min-width pushes the whole
              page into a horizontal scroll on a phone. */}
          <div className="flex min-w-0 flex-col gap-10">
            {company.description || company.stack.length ? (
              <div className="flex flex-col gap-3">
                {company.description ? (
                  <p className="max-w-prose text-sm">{company.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {company.hiresJuniors ? (
                    <Badge variant="secondary">Hires juniors</Badge>
                  ) : null}
                  {company.stack.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold">
                Reviews{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({company.reviewCount})
                </span>
              </h2>
              {company.reviewCount > 0 ? (
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <ScoreBar label="Learning" value={company.learningAvg} />
                  <ScoreBar label="Management" value={company.managementAvg} />
                  <ScoreBar label="Work / life" value={company.workLifeAvg} />
                  <ScoreBar
                    label="Compensation"
                    value={company.compensationAvg}
                  />
                  <ScoreBar label="Growth" value={company.growthAvg} />
                  {company.recommendPct !== null ? (
                    <p className="pt-1 text-sm text-muted-foreground">
                      {company.recommendPct}% would recommend working here.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {reviews.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nobody has reviewed {company.name} yet. If you have worked
                  here,{" "}
                  <Link
                    href={`/companies/${slug}/contribute` as Route}
                    className="underline underline-offset-4"
                  >
                    you can be the first
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {reviews.items.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Rating value={r.rating} />
                        <Badge variant="outline" className="text-xs">
                          {employmentLabels[r.employmentStatus]}
                        </Badge>
                        {r.roleText ? (
                          <span className="text-sm text-muted-foreground">
                            {r.roleText}
                          </span>
                        ) : null}
                        {r.tenure ? (
                          <span className="text-xs text-muted-foreground">
                            {tenureLabels[r.tenure]}
                          </span>
                        ) : null}
                        <Affiliation value={r.affiliation} />
                        {/* Its own line below `sm`, so a wrapped meta row does
                            not strand the month in the middle of the badges. */}
                        <span className="w-full sm:ml-auto sm:w-auto">
                          <Month value={r.createdMonth} />
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">
                            Pros
                          </h3>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.pros}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">
                            Cons
                          </h3>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.cons}
                          </p>
                        </div>
                      </div>
                      {r.advice ? (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">
                            Advice
                          </h3>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.advice}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold">Pay</h2>
              <Pay
                roles={salaries.roles}
                detail={salaries.detail}
                fx={salaries.fx}
                companyName={company.name}
              />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold">
                Interviews{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({company.interviewCount})
                </span>
              </h2>
              {interviews.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No interview experiences yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {interviews.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-col gap-2 rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {i.roleText ?? "Interview"}
                          {i.level ? ` · ${i.level}` : ""}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {outcomeLabels[i.outcome]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Difficulty {i.difficulty}/5
                        </span>
                        <Affiliation value={i.affiliation} />
                        <span className="w-full sm:ml-auto sm:w-auto">
                          <Month value={i.yearMonth} />
                        </span>
                      </div>
                      <ol className="flex flex-col gap-1 text-sm">
                        {i.rounds.map((round, n) => (
                          <li key={n} className="flex gap-2">
                            <span className="text-muted-foreground tabular-nums">
                              {n + 1}.
                            </span>
                            <span>
                              <span className="capitalize">
                                {round.type.replace(/_/g, " ")}
                              </span>
                              {" — "}
                              {round.description}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {i.questions ? (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">
                            Questions asked
                          </h3>
                          <p className="text-sm whitespace-pre-wrap">
                            {i.questions}
                          </p>
                        </div>
                      ) : null}
                      {i.advice ? (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">
                            Advice
                          </h3>
                          <p className="text-sm whitespace-pre-wrap">
                            {i.advice}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex h-fit flex-col gap-4 rounded-lg border p-4 text-sm">
            <h2 className="font-medium">Facts</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {company.website ? (
              <a
                href={company.website}
                rel="nofollow noopener"
                target="_blank"
                className="break-all underline underline-offset-4"
              >
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Facts are checked by the devhelp team against public sources.
              Reviews and interviews are contributed by learners and published
              after review. Nothing here identifies its author.
            </p>
          </aside>
        </div>
      </div>
    </Page>
  );
}
