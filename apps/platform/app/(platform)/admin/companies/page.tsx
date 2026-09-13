import { PageHeader } from "@repo/ui/components/page-header";
import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminCompanies } from "@/components/companies/admin-companies";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";

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
    <Shell wide callbackURL="/admin/companies">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Companies"
          description="Facts about each employer, checked against public sources. Proposals and contributions are approved in the moderation queue."
        />
        <LearnerProviders>
          <AdminCompanies />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
