import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ContributeForm } from "@/components/companies/contribute-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Share your experience" };
export const dynamic = "force-dynamic";

export default async function ContributePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await headers();
  const session = await auth.api.getSession({
    headers: h,
    query: { disableCookieCache: true },
  });
  if (!session)
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}/contribute`)}`,
    );
  const caller = await api(new Headers(h));
  let company;
  try {
    company = await caller.companies.bySlug({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const filters = await caller.companies.filters();
  return (
    <Page callbackURL={`/companies/${slug}/contribute`}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Your name is never shown next to anything you write here. An
            administrator reads every contribution before it is published. Be
            specific and be fair: someone deciding where to work will read this.
          </p>
        </header>
        <LearnerProviders>
          <ContributeForm
            slug={slug}
            companyName={company.name}
            emailVerified={session.user.emailVerified}
            roles={filters.roles}
            cities={filters.cities}
          />
        </LearnerProviders>
      </div>
    </Page>
  );
}
