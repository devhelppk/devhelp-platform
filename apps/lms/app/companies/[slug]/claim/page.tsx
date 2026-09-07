import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ClaimForm } from "@/components/companies/claim-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Claim a company" };
export const dynamic = "force-dynamic";

export default async function ClaimPage({
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
      `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}/claim`)}`,
    );
  const caller = await api(new Headers(h));
  let company;
  try {
    company = await caller.companies.bySlug({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <Page callbackURL={`/companies/${slug}/claim`}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Do you work at {company.name}?
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Representatives can answer reviews and interview experiences in
            public. They cannot edit the facts, delete anything, or find out who
            wrote what — those stay with the devhelp team.
          </p>
        </header>
        <LearnerProviders>
          <ClaimForm
            slug={slug}
            companyName={company.name}
            emailVerified={session.user.emailVerified}
          />
        </LearnerProviders>
      </div>
    </Page>
  );
}
