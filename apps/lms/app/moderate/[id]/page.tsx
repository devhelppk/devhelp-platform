import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { clientEnv } from "@repo/env/client";
import { Button } from "@repo/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ModerationItem } from "@/components/moderation/item";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Moderation item" };
export const dynamic = "force-dynamic";

export default async function ModerateItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Fresh read: a just-approved mentor must not wait for the session cookie cache.
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session)
    redirect(`/sign-in?callbackURL=${encodeURIComponent(`/moderate/${id}`)}`);
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  return (
    <Page wide callbackURL={`/moderate/${id}`}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" asChild className="self-start">
            <Link href="/moderate">← Queue</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Review
          </h1>
        </header>
        <LearnerProviders>
          <ModerationItem
            id={id}
            isAdmin={session.user.role === "admin"}
            policyUrl={`${clientEnv.NEXT_PUBLIC_WEB_URL}/policy`}
          />
        </LearnerProviders>
      </div>
    </Page>
  );
}
