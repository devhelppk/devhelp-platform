import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ModerationQueue } from "@/components/moderation/queue";
import { statusLabels } from "@/components/moderation/labels";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

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
    <Page wide callbackURL="/moderate">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Moderation
          </h1>
          <p className="max-w-prose text-muted-foreground">
            {session.user.role === "admin"
              ? "Everything submitted, across all tracks."
              : "Submissions in your tracks. Every decision is logged with your name."}
          </p>
        </header>
        <LearnerProviders>
          <ModerationQueue status={status} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
