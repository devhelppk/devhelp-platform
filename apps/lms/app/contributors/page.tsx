import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import type { Metadata } from "next";
import type { Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "Contributors",
  description:
    "The people who write and review the devhelp.pk curriculum, and what each of them worked on.",
};
export const dynamic = "force-dynamic";

/** Public attribution (F3.9). Credits are devhelp accounts, so each one is a person you can find. */
export default async function ContributorsPage() {
  const caller = await api(new Headers(await headers()));
  const people = await caller.contributors.list();
  return (
    <Page callbackURL="/contributors">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Contributors
          </h1>
          <p className="max-w-prose text-muted-foreground">
            The curriculum is written and reviewed by people, and it is theirs
            as much as anyone's. Everything here is CC BY-SA: use it, fork it,
            teach from it — and credit the people below.
          </p>
        </header>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody is credited yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {people.map((p) => (
              <li
                key={p.userId}
                className="flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {p.profilePublic && p.handle ? (
                    <Link
                      href={`/u/${p.handle}` as Route}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{p.name}</span>
                  )}
                  {p.courses.length ? (
                    <Badge variant="secondary" className="text-xs">
                      {p.courses.length}{" "}
                      {p.courses.length === 1 ? "course" : "courses"}
                    </Badge>
                  ) : null}
                  {p.lessonCount ? (
                    <Badge variant="outline" className="text-xs">
                      {p.lessonCount}{" "}
                      {p.lessonCount === 1 ? "lesson" : "lessons"}
                    </Badge>
                  ) : null}
                  {p.reviewCount ? (
                    <Badge variant="outline" className="text-xs">
                      reviewed {p.reviewCount}
                    </Badge>
                  ) : null}
                </div>
                {p.courses.length ? (
                  <p className="text-sm text-muted-foreground">
                    {p.courses.map((c, i) => (
                      <span key={c.slug}>
                        {i > 0 ? ", " : ""}
                        <Link
                          href={`/courses/${c.slug}` as Route}
                          className="underline underline-offset-4"
                        >
                          {c.title}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
