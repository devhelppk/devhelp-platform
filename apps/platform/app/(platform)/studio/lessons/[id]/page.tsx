import { auth } from "@repo/auth";
import { PageHeader } from "@repo/ui/components/page-header";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";
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
    <Shell wide callbackURL={`/studio/lessons/${id}`}>
      <div className="flex flex-col gap-6">
        <Link
          href="/studio"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Studio
        </Link>
        <PageHeader
          title="Lesson metadata"
          description="The title, duration and credits shown around a lesson. What the lesson teaches is a pull request on the content repo."
        />
        <LearnerProviders>
          <LessonForm id={id} />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
