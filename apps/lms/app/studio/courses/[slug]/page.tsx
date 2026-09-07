import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";
import { CourseForm } from "@/components/studio/course-form";

export const metadata: Metadata = { title: "Course metadata" };
export const dynamic = "force-dynamic";

export default async function StudioCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session)
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/studio/courses/${slug}`)}`,
    );
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  return (
    <Page callbackURL={`/studio/courses/${slug}`}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/studio"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Studio
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Course metadata
          </h1>
        </header>
        <LearnerProviders>
          <CourseForm slug={slug} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
