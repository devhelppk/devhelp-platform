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

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, reviews, interviews, salaries, responses } =
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
            reviews={reviews.items}
            interviews={interviews.items}
            salaries={salaries}
            responses={responses}
          />
        </div>
      </QueryState>
    </Shell>
  );
}
