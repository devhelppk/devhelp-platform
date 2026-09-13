import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ModerationItemDialog } from "@/components/moderation/item-dialog";
import { ModerationQueue } from "@/components/moderation/queue";
import { QueryState } from "@/components/companies/query-state";
import { statusLabels } from "@/components/moderation/labels";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { PageHeader } from "@repo/ui/components/page-header";
import { Shell } from "@/components/shell/shell";

export const metadata: Metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

export default async function ModeratePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Fresh read: a just-approved mentor must not wait for the session cookie cache.
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fmoderate");
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  const q = await searchParams;
  const status =
    typeof q.status === "string" && q.status in statusLabels
      ? (q.status as keyof typeof statusLabels)
      : "pending";
  return (
    <Shell wide callbackURL="/moderate">
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Moderation"
          description={
            session.user.role === "admin"
              ? "Everything submitted, across all tracks."
              : "Submissions in your tracks. Every decision is logged with your name."
          }
        />
        <LearnerProviders>
          <QueryState>
            <ModerationQueue status={status} />
            {/* One dialog for the whole queue; `?item=<id>` decides what is in
                it. See `item-dialog.tsx`. */}
            <ModerationItemDialog
              isAdmin={session.user.role === "admin"}
              policyUrl="/policy"
            />
          </QueryState>
        </LearnerProviders>
      </div>
    </Shell>
  );
}
