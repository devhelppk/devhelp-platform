import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@repo/ui/components/page-header";
import { AdminBadges } from "@/components/badges/admin-badges";
import { AwardBadgeDialog } from "@/components/badges/award-badge-dialog";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";

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
    <Shell wide callbackURL="/admin/badges">
      <div className="flex flex-col gap-6">
        <LearnerProviders>
          <PageHeader
            title="Badges"
            description="Badges award themselves from the event stream. Award or revoke by hand only when something went wrong; the reason is kept on the award."
            actions={<AwardBadgeDialog />}
          />
          <AdminBadges />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
