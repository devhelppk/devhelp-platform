import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminCompanyForm } from "@/components/companies/admin-company-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Edit company (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminCompanyPage({
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
      `/sign-in?callbackURL=${encodeURIComponent(`/admin/companies/${slug}`)}`,
    );
  if (session.user.role !== "admin") notFound();
  const caller = await api(new Headers(h));
  const company = await caller.companies.adminGet({ slug }).catch(() => null);
  if (!company) notFound();
  return (
    <Page callbackURL={`/admin/companies/${slug}`}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/admin/companies"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← All companies
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Facts an administrator owns. Reviews and interview experiences are
            decided in the moderation queue, never here.
          </p>
        </header>
        <LearnerProviders>
          <AdminCompanyForm slug={slug} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
