import type { Metadata } from "next";
import { api } from "@repo/api/server";
import { headers } from "next/headers";
import { BadgeGrid } from "@/components/badges/badge-grid";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Badges" };
export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const caller = await api(new Headers(await headers()));
  const badges = await caller.badges.catalogue();
  const earned = badges.filter((b) => b.earnedAt);
  return (
    <Page callbackURL="/badges">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Badges
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Awarded automatically from what you do on the platform.{" "}
            {earned.length} of {badges.length} earned.
          </p>
        </header>
        <BadgeGrid items={badges} />
      </div>
    </Page>
  );
}
