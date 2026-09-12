import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { api } from "@repo/api/server";
import { AtAGlance, Rating } from "@/components/companies/bits";
import { auth } from "@repo/auth";
import { CompanyMark } from "@/components/companies/company-mark";
import { ContributeDialog } from "@/components/companies/contribute-dialog";
import { GateWall } from "@/components/companies/gate-wall";
import { CompanyPanels } from "@/components/companies/panels";
import { QueryState } from "@/components/companies/query-state";
import { Shell } from "@/components/shell/shell";

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
    // The gate decides *before* anything is fetched. This is the whole point:
    // a page that fetched the rows and rendered a different panel would still
    // have every review in its RSC payload, and passing them to the panels
    // island would put them there whether or not a tab renders them (the trap
    // recorded in S15 part A2). Nothing gated is read, so nothing gated can
    // leak — and the wall below is synthetic text that never touched the
    // database.
    const gate = await caller.companies.eligibility({ slug });
    if (!gate.allowed)
      return {
        company,
        gate,
        reviews: null,
        interviews: null,
        salaries: null,
        responses: null,
      };
    const [reviews, interviews, salaries, responses] = await Promise.all([
      caller.companies.reviews({ slug, limit: 20 }),
      caller.companies.interviews({ slug, limit: 20 }),
      caller.companies.salaries({ slug }),
      caller.companies.responses({ slug }),
    ]);
    return { company, gate, reviews, interviews, salaries, responses };
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

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, gate, reviews, interviews, salaries, responses } =
    await load(slug);
  // One session read for the whole page: the report controls need to know
  // whether there is anyone to report as.
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = !!session;
  const emailVerified = !!session?.user.emailVerified;
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
    <Shell wide callbackURL={`/companies/${slug}`}>
      {/* One adapter for the page: the header dialog and the panels both read
          the URL, and nesting adapters is not a thing nuqs wants. */}
      <QueryState>
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
                  <Rating
                    value={company.ratingAvg}
                    count={company.reviewCount}
                  />
                </div>
              </div>
              {/* One action, because only one of these is a learner action.
                Claiming is for a company representative and lives in About;
                Careers is an outbound link and sits with the website, also in
                About. Three buttons of three widths and three variants read as
                three competing affordances. */}
              <ContributeDialog
                slug={slug}
                companyName={company.name}
                signedIn={signedIn}
                emailVerified={emailVerified}
              />
            </div>
          </header>

          {gate.allowed ? (
            <>
              {/* At a glance: the numbers a reader decides on, above the
                sections that explain them, with jump links because the page is
                long. The recommend rate used to sit as muted text under five
                score bars; it is the one figure most people act on. */}
              <AtAGlance
                recommendPct={company.recommendPct}
                reviewCount={company.reviewCount}
                interviewCount={company.interviewCount}
                payRoleCount={salaries!.roles.length}
              />

              <CompanyPanels
                slug={slug}
                signedIn={signedIn}
                emailVerified={emailVerified}
                company={{
                  name: company.name,
                  description: company.description,
                  website: company.website,
                  stack: company.stack,
                  hiresJuniors: company.hiresJuniors,
                  careersUrl: company.careersUrl,
                  reviewCount: company.reviewCount,
                  interviewCount: company.interviewCount,
                  ratingAvg: company.ratingAvg,
                  recommendPct: company.recommendPct,
                  difficultyAvg: company.difficultyAvg,
                  learningAvg: company.learningAvg,
                  managementAvg: company.managementAvg,
                  workLifeAvg: company.workLifeAvg,
                  compensationAvg: company.compensationAvg,
                  growthAvg: company.growthAvg,
                }}
                facts={facts}
                reviews={reviews!.items}
                interviews={interviews!.items}
                salaries={salaries!}
                responses={responses!}
              />
            </>
          ) : (
            /* Tier one stays public (D1): what the company is, checked by us
               against public sources, is not somebody's contribution and
               nothing is gained by hiding it. What people wrote is tier two,
               and below this the page has not read a word of it. */
            <>
              {/* The same two-column shape as the About panel, so a reader
                  who signs in and comes back sees the facts where they left
                  them rather than in a rearranged card. */}
              <div className="grid gap-4 text-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
                <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                  <h2 className="text-base font-medium">
                    About {company.name}
                  </h2>
                  {company.description ? (
                    <p className="text-muted-foreground">
                      {company.description}
                    </p>
                  ) : null}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                    {facts.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                  {company.website || company.careersUrl ? (
                    <div className="flex min-w-0 flex-col gap-2">
                      <h2 className="text-base font-medium">Links</h2>
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
                      {company.careersUrl ? (
                        <a
                          href={company.careersUrl}
                          rel="nofollow noopener"
                          target="_blank"
                          className="break-all underline underline-offset-4"
                        >
                          Careers at {company.name}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Facts are checked by the devhelp team against public
                    sources. Reviews and interviews are contributed by learners
                    and published after review. Nothing here identifies its
                    author.
                  </p>
                </section>
              </div>

              <GateWall
                kind={gate.reason}
                slug={slug}
                companyName={company.name}
                signedIn={signedIn}
                emailVerified={emailVerified}
              />
            </>
          )}
        </div>
      </QueryState>
    </Shell>
  );
}
