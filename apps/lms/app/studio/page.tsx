import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";
import { StudioOverview } from "@/components/studio/overview";

export const metadata: Metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fstudio");
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  return (
    <Page wide callbackURL="/studio">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Studio
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            How courses and lessons are described: titles, summaries, how long
            they take, who wrote them. What a lesson teaches is a pull request
            on the content repo; what it is called is yours.
          </p>
        </header>
        <LearnerProviders>
          <StudioOverview />
        </LearnerProviders>
      </div>
    </Page>
  );
}
