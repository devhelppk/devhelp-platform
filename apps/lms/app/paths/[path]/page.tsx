import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration } from "@/components/learning/course-card";
import { Page } from "@/components/shell/site-header";

// The header reads the session, so this is dynamic; the catalogue queries are cheap.
export const dynamic = "force-dynamic";

export default async function PathPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path: slug } = await params;
  const caller = await api(new Headers());
  const path = await caller.catalogue.getPath({ slug });
  if (!path) notFound();

  return (
    <Page>
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/courses" className="hover:text-foreground">
            Courses
          </Link>{" "}
          / Path
        </p>
        <PageHeader
          title={path.title}
          description={path.description ?? path.summary}
        />
        <ol className="relative flex flex-col gap-6 border-l pl-6">
          {path.courses.map((c, i) => (
            <li key={c.id} className="relative">
              <span className="absolute top-1 -left-[31px] flex size-6 items-center justify-center rounded-full border bg-background text-xs font-medium">
                {i + 1}
              </span>
              <div className="flex flex-col gap-2 rounded-lg border p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {c.track === "technical" ? "Technical" : "Career"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {c.level}
                  </Badge>
                  {c.estimatedHours ? (
                    <Badge variant="outline">
                      {formatDuration(c.estimatedHours * 60)}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="font-display text-xl font-semibold">
                  {c.title}
                </h2>
                <p className="text-sm text-muted-foreground">{c.summary}</p>
                <div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/courses/${c.slug}`}>Open course</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Page>
  );
}
