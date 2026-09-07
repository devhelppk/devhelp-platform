"use client";

import { Badge } from "@repo/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";

/** The studio home: what needs describing, then what readers are struggling with. */
export function StudioOverview() {
  const trpc = useTRPC();
  const q = useQuery(trpc.studio.overview.queryOptions());
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error)
    return <p className="text-sm text-destructive">{q.error.message}</p>;
  const { needsMetadata, paths, flagged, recent } = q.data;
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">
          Waiting to be described{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({needsMetadata.length})
          </span>
        </h2>
        {needsMetadata.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Every course has a title and a summary.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {needsMetadata.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Link
                  href={`/studio/courses/${c.slug}` as Route}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {c.title}
                </Link>
                <Badge variant="outline" className="ml-auto">
                  Not published
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="max-w-prose text-xs text-muted-foreground">
          A course arrives from the content repo with its slug as a placeholder.
          It cannot be published until somebody writes what it is.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">
          Paths{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({paths.length})
          </span>
        </h2>
        {paths.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paths yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {paths.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Link
                  href={`/studio/paths/${p.slug}` as Route}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>
                {p.needsMetadata ? (
                  <Badge variant="secondary">Needs a description</Badge>
                ) : null}
                <Badge variant="outline" className="ml-auto">
                  {p.isPublished ? "Published" : "Not published"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">
          Lessons worth a look{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({flagged.length})
          </span>
        </h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No lesson is rated low, tagged unclear, or sitting on an unanswered
            question.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {flagged.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <Link
                  href={`/studio/lessons/${l.id}` as Route}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {l.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {l.courseTitle}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                  {l.needsMetadata ? (
                    <Badge variant="outline">No title yet</Badge>
                  ) : null}
                  {l.ratingAvg && l.ratingCount >= 3 ? (
                    <Badge variant="outline">
                      {Number(l.ratingAvg).toFixed(1)} from {l.ratingCount}
                    </Badge>
                  ) : null}
                  {l.unclearCount >= 3 ? (
                    <Badge variant="destructive">
                      {l.unclearCount} found it unclear
                    </Badge>
                  ) : null}
                  {l.openQuestionCount > 0 ? (
                    <Badge variant="secondary">
                      {l.openQuestionCount} open{" "}
                      {l.openQuestionCount === 1 ? "question" : "questions"}
                    </Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Recent changes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing edited yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {recent.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap gap-2 text-muted-foreground"
              >
                <span className="text-foreground">
                  {e.actorName ?? "Someone"}
                </span>
                changed {e.changes.map((c) => c.field).join(", ")} on a{" "}
                {e.subjectType}
                <span className="ml-auto text-xs">
                  {e.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
