import { auth } from "@repo/auth";
import { PageHeader } from "@repo/ui/components/page-header";
import { Button } from "@repo/ui/components/button";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Shell } from "@/components/shell/shell";
import { PathForm } from "@/components/studio/path-form";

export const metadata: Metadata = { title: "Path metadata" };
export const dynamic = "force-dynamic";

export default async function StudioPathPage({
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
      `/sign-in?callbackURL=${encodeURIComponent(`/studio/paths/${slug}`)}`,
    );
  if (session.user.role !== "mentor" && session.user.role !== "admin")
    notFound();
  return (
    <Shell wide callbackURL={`/studio/paths/${slug}`}>
      <div className="flex flex-col gap-6">
        <Link
          href="/studio"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Studio
        </Link>
        <PageHeader
          title="Path metadata"
          description="The title, summary and publish state the catalogue shows. Which courses a path contains, and their order, come from the content repo."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/paths/${slug}` as Route}>View path</Link>
            </Button>
          }
        />
        <LearnerProviders>
          <PathForm slug={slug} />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
