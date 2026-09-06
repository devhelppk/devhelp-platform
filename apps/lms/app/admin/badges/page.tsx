import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminBadges } from "@/components/badges/admin-badges";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Badges (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminBadgesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fadmin%2Fbadges");
  if (session.user.role !== "admin") notFound();
  return (
    <Page wide callbackURL="/admin/badges">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Badges
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Badges award themselves from the event stream. Award or revoke by
            hand only when something went wrong; the reason is kept on the
            award.
          </p>
        </header>
        <LearnerProviders>
          <AdminBadges />
        </LearnerProviders>
      </div>
    </Page>
  );
}
