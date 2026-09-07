import { api } from "@repo/api/server";
import type { Route } from "next";
import Link from "next/link";

/**
 * Who wrote and reviewed a lesson (F3.9). Renders nothing when nobody is
 * credited, which is most of the curriculum until someone fills it in.
 */
export async function Byline({ lessonId }: { lessonId: string }) {
  const credits = await api(new Headers()).then((c) =>
    c.contributors.forLesson({ lessonId }).catch(() => []),
  );
  if (!credits.length) return null;
  const named = (role: "author" | "reviewer") =>
    credits.filter((c) => c.role === role);
  const people = (list: typeof credits) =>
    list.map((c, i) => (
      <span key={c.userId}>
        {i > 0 ? ", " : ""}
        {c.profilePublic && c.handle ? (
          <Link
            href={`/u/${c.handle}` as Route}
            className="underline underline-offset-4"
          >
            {c.name}
          </Link>
        ) : (
          c.name
        )}
      </span>
    ));
  return (
    <p className="text-xs text-muted-foreground">
      {named("author").length ? (
        <>Written by {people(named("author"))}</>
      ) : null}
      {named("author").length && named("reviewer").length ? " · " : null}
      {named("reviewer").length ? (
        <>Reviewed by {people(named("reviewer"))}</>
      ) : null}
    </p>
  );
}
