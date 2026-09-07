import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import type { Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Manage } from "@/components/companies/manage";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Manage a company" };
export const dynamic = "force-dynamic";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session)
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}/manage`)}`,
    );
  const caller = await api(new Headers(h));
  let company;
  try {
    company = await caller.companies.bySlug({ slug });
    // Membership is the gate; the router checks it too, this is for the 404.
    await caller.claims.inbox({ slug });
  } catch (e) {
    // Only "you may not see this" is a 404. A transient failure must surface
    // as an error, or a representative sees a 404 and we see nothing.
    if (
      e instanceof TRPCError &&
      (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
    )
      notFound();
    throw e;
  }
  return (
    <Page wide callbackURL={`/companies/${slug}/manage`}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link
            href={`/companies/${slug}` as Route}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← {company.name}
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            What people say about {company.name}
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            You can answer any of these in public. You cannot edit or remove
            what somebody wrote, and you cannot see who wrote it.
          </p>
        </header>
        <LearnerProviders>
          <Manage slug={slug} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
