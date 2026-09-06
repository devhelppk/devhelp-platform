import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminCertificates } from "@/components/certificates/admin-certificates";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

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
    <Page wide callbackURL="/admin/certificates">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Certificates
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Every issued certificate. Revoking needs a reason; it is logged, the
            learner is notified, and the verify page and PDF say so.
          </p>
        </header>
        <LearnerProviders>
          <AdminCertificates />
        </LearnerProviders>
      </div>
    </Page>
  );
}
