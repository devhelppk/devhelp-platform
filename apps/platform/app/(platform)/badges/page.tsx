import type { Metadata } from "next";
import { api } from "@repo/api/server";
import { headers } from "next/headers";
import { BadgeGrid } from "@/components/badges/badge-grid";
import { PageHeader } from "@repo/ui/components/page-header";
import { Shell } from "@/components/shell/shell";

export const metadata: Metadata = { title: "Badges" };
export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const caller = await api(new Headers(await headers()));
  const badges = await caller.badges.catalogue();
  const earned = badges.filter((b) => b.earnedAt);
  return (
    <Shell wide callbackURL="/badges">
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Badges"
          description={`Awarded automatically from what you do on the platform. ${earned.length} of ${badges.length} earned.`}
        />
        <BadgeGrid items={badges} />
      </div>
    </Shell>
  );
}
