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
  AtAGlance,
  Month,
  Rating,
  ScoreBar,
} from "@/components/companies/bits";
import { auth } from "@repo/auth";
import { CompanyMark } from "@/components/companies/company-mark";
import { CompanyReply } from "@/components/companies/company-reply";
import { FlagForm } from "@/components/companies/flag-form";
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
    const [reviews, interviews, salaries, responses] = await Promise.all([
      caller.companies.reviews({ slug, limit: 20 }),
      caller.companies.interviews({ slug, limit: 20 }),
      caller.companies.salaries({ slug }),
      caller.companies.responses({ slug }),
    ]);
    return { company, reviews, interviews, salaries, responses };
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

/**
 * Sub-scores are withheld below this many reviews. Five averages printed to one
 * decimal off two reviews claim a precision the sample cannot support — one more
 * review moves a bar by a whole point. Same reasoning as the salary floor in
 * S10b, applied to opinion rather than pay.
 */
const SCORE_BREAKDOWN_MIN = 5;

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
  const { company, reviews, interviews, salaries, responses } =
    await load(slug);
  const replyTo = (type: string, id: string) =>
    responses.find((r) => r.subjectType === type && r.subjectId === id);
  // One session read for the whole page: the report controls need to know
  // whether there is anyone to report as.
  const signedIn = !!(await auth.api.getSession({ headers: await headers() }));
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
            <div className="flex items-start gap-4">
              <CompanyMark
                id={company.id}
                version={company.markVersion}
                size={56}
              />
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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/companies/${slug}/contribute` as Route}>
                  Share your experience
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/companies/${slug}/claim` as Route}>
                  Do you work here?
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

        {/* At a glance: the numbers a reader decides on, above the sections
            that explain them, with jump links because the page is long. The
            recommend rate used to sit as muted text under five score bars; it
            is the one figure most people act on. */}
        <AtAGlance
          recommendPct={company.recommendPct}
          reviewCount={company.reviewCount}
          interviewCount={company.interviewCount}
          payRoleCount={salaries.roles.length}
        />

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
        {/* `Facts` is first in the DOM and placed into the right column from
            `lg` up. It used to be last, which read fine as a desktop sidebar but
            put who-the-company-is below every review, pay table and interview on
            anything under 1024px — every phone, every tablet, and a laptop in a
            split window. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* `min-w-0`: a grid item will not shrink below its content by
              default, so without it the pay table's min-width pushes the whole
              page into a horizontal scroll on a phone. */}
          <aside className="flex h-fit flex-col gap-4 rounded-lg border p-4 text-sm lg:col-start-2 lg:row-start-1">
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
          <div className="flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-1">
            <section id="pay" className="flex scroll-mt-6 flex-col gap-4">
              <h2 className="font-display text-xl font-semibold">Pay</h2>
              <Pay
                roles={salaries.roles}
                detail={salaries.detail}
                fx={salaries.fx}
                companyName={company.name}
                slug={slug}
                signedIn={signedIn}
              />
            </section>

            <section id="reviews" className="flex scroll-mt-6 flex-col gap-4">
              <h2 className="font-display text-xl font-semibold">
                Reviews{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({company.reviewCount})
                </span>
              </h2>
              {company.reviewCount >= SCORE_BREAKDOWN_MIN ? (
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <ScoreBar label="Learning" value={company.learningAvg} />
                  <ScoreBar label="Management" value={company.managementAvg} />
                  <ScoreBar label="Work / life" value={company.workLifeAvg} />
                  <ScoreBar
                    label="Compensation"
                    value={company.compensationAvg}
                  />
                  <ScoreBar label="Growth" value={company.growthAvg} />
                </div>
              ) : company.reviewCount > 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Scores for learning, management, work/life, pay and growth
                  appear once {SCORE_BREAKDOWN_MIN} people have reviewed{" "}
                  {company.name}. With {company.reviewCount}, a single review
                  would move each one too far to mean anything.
                </p>
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
                          <p className="text-xs font-medium text-muted-foreground">
                            Pros
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.pros}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Cons
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.cons}
                          </p>
                        </div>
                      </div>
                      {r.advice ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Advice
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {r.advice}
                          </p>
                        </div>
                      ) : null}
                      <CompanyReply
                        reply={replyTo("company_review", r.id)}
                        companyName={company.name}
                      />
                      <FlagForm
                        subjectType="company_review"
                        subjectId={r.id}
                        slug={slug}
                        signedIn={signedIn}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              id="interviews"
              className="flex scroll-mt-6 flex-col gap-4"
            >
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
                          <p className="text-xs font-medium text-muted-foreground">
                            Questions asked
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {i.questions}
                          </p>
                        </div>
                      ) : null}
                      {i.advice ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Advice
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {i.advice}
                          </p>
                        </div>
                      ) : null}
                      <CompanyReply
                        reply={replyTo("interview_experience", i.id)}
                        companyName={company.name}
                      />
                      <FlagForm
                        subjectType="interview_experience"
                        subjectId={i.id}
                        slug={slug}
                        signedIn={signedIn}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </Page>
  );
}
