import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";
import { LessonForm } from "@/components/studio/lesson-form";

export const metadata: Metadata = { title: "Lesson metadata" };
export const dynamic = "force-dynamic";

export default async function StudioLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session)
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/studio/lessons/${id}`)}`,
    );
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  return (
    <Page callbackURL={`/studio/lessons/${id}`}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/studio"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Studio
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Lesson metadata
          </h1>
        </header>
        <LearnerProviders>
          <LessonForm id={id} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
