import { PageHeader } from "@repo/ui/components/page-header";
import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminCertificates } from "@/components/certificates/admin-certificates";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";

export const metadata: Metadata = { title: "Certificates (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fadmin%2Fcertificates");
  if (session.user.role !== "admin") notFound();
  return (
    <Shell wide callbackURL="/admin/certificates">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Certificates"
          description="Every issued certificate. Revoking needs a reason; it is logged, the learner is notified, and the verify page and PDF say so."
        />
        <LearnerProviders>
          <AdminCertificates />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
