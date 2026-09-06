import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { clientEnv } from "@repo/env/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/mentor/apply-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Apply to mentor" };
export const dynamic = "force-dynamic";

export default async function MentorApplyPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fmentor%2Fapply");
  return (
    <Page callbackURL="/mentor/apply">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Apply to be a mentor
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Mentors review contributions in their tracks, answer questions on
            lessons, and propose content changes. Applications are decided by an
            administrator; you hear back here and by email.
          </p>
        </header>
        <LearnerProviders>
          <ApplyForm
            emailVerified={session.user.emailVerified}
            policyUrl={`${clientEnv.NEXT_PUBLIC_WEB_URL}/policy`}
          />
        </LearnerProviders>
      </div>
    </Page>
  );
}
