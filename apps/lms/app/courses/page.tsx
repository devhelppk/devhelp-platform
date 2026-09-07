import { listCoursesInput } from "@repo/api";
import { api } from "@repo/api/server";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/page-header";
import Link from "next/link";
import { CourseCard } from "@/components/learning/course-card";
import { Page } from "@/components/shell/site-header";

// Reads searchParams and renders the session-aware header: dynamic by nature.
export const dynamic = "force-dynamic";

const tracks = [
  { value: undefined, label: "All" },
  { value: "technical", label: "Technical" },
  { value: "career", label: "Career" },
] as const;
const levels = ["beginner", "intermediate", "advanced"] as const;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = listCoursesInput.safeParse({
    track: typeof raw.track === "string" ? raw.track : undefined,
    level: typeof raw.level === "string" ? raw.level : undefined,
    q: typeof raw.q === "string" ? raw.q : undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const caller = await api(new Headers());
  const [courses, paths] = await Promise.all([
    caller.catalogue.listCourses(filters),
    caller.catalogue.listPaths(),
  ]);
  const href = (patch: Partial<typeof filters>) => {
    const p = new URLSearchParams();
    const merged = { ...filters, ...patch };
    if (merged.track) p.set("track", merged.track);
    if (merged.level) p.set("level", merged.level);
    if (merged.q) p.set("q", merged.q);
    const s = p.toString();
    return (s ? `/courses?${s}` : "/courses") as "/courses";
  };

  return (
    <Page wide>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Courses"
          description="Every course is free and open source. Pick a track, or follow a path in order."
        />
        <p className="text-sm text-muted-foreground">
          Written and reviewed by{" "}
          <Link href="/contributors" className="underline underline-offset-4">
            people who work here
          </Link>
          .
        </p>

        {paths.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Paths</h2>
            <ul className="flex flex-wrap gap-2">
              {paths
                .filter((p) => p.courses.length > 0)
                .map((p) => (
                  <li key={p.id}>
                    <Button variant="outline" asChild>
                      <Link href={`/paths/${p.slug}`}>
                        {p.title}{" "}
                        <span className="text-muted-foreground">
                          · {p.pathCourses.length} courses
                        </span>
                      </Link>
                    </Button>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <form
            action="/courses"
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Track"
            >
              {tracks.map((t) => (
                <Button
                  key={t.label}
                  size="sm"
                  variant={filters.track === t.value ? "default" : "outline"}
                  asChild
                >
                  <Link href={href({ track: t.value })}>{t.label}</Link>
                </Button>
              ))}
              <span
                className="mx-1 hidden w-px bg-border sm:block"
                aria-hidden="true"
              />
              {levels.map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={filters.level === l ? "default" : "outline"}
                  className="capitalize"
                  asChild
                >
                  <Link
                    href={href({ level: filters.level === l ? undefined : l })}
                  >
                    {l}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {filters.track ? (
                <input type="hidden" name="track" value={filters.track} />
              ) : null}
              {filters.level ? (
                <input type="hidden" name="level" value={filters.level} />
              ) : null}
              <label className="sr-only" htmlFor="q">
                Search courses
              </label>
              <input
                id="q"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Search titles"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-56"
              />
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>
            </div>
          </form>

          {courses.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No courses match.{" "}
              <Link
                href="/courses"
                className="text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <li key={c.id}>
                  <CourseCard
                    slug={c.slug}
                    title={c.title}
                    summary={c.summary}
                    track={c.track}
                    level={c.level}
                    lessonCount={c.lessonCount}
                    durationMinutes={c.durationMinutes}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
