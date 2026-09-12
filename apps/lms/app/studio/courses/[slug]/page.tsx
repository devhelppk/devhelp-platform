import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/page-header";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";
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
    <Shell wide callbackURL={`/studio/courses/${slug}`}>
      <div className="flex flex-col gap-6">
        <Link
          href="/studio"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Studio
        </Link>
        <PageHeader
          title="Course metadata"
          description="The title, summary and publish state the catalogue shows. What the course teaches is a pull request on the content repo; what it is called is yours."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${slug}` as Route}>View in catalogue</Link>
            </Button>
          }
        />
        <LearnerProviders>
          <CourseForm slug={slug} />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
