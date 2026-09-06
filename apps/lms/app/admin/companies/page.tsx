import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminCompanies } from "@/components/companies/admin-companies";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Companies (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fadmin%2Fcompanies");
  if (session.user.role !== "admin") notFound();
  return (
    <Page wide callbackURL="/admin/companies">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Companies
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Facts about each employer, checked against public sources. Proposals
            and contributions are approved in the moderation queue.
          </p>
        </header>
        <LearnerProviders>
          <AdminCompanies />
        </LearnerProviders>
      </div>
    </Page>
  );
}
