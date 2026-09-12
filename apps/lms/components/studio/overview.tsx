"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { ago } from "@/components/moderation/labels";

/**
 * The studio home: what needs describing, then what readers are struggling with.
 *
 * Two columns, and tables rather than flex rows with `ml-auto` badges. Stacked
 * in one column the seventeen undescribed courses pushed paths, flagged lessons
 * and the edit trail below the fold; and because the badges were pushed right
 * individually rather than sharing a column, nothing lined up to be scanned.
 */
export function StudioOverview() {
  const trpc = useTRPC();
  const q = useQuery(trpc.studio.overview.queryOptions());
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error)
    return <p className="text-sm text-destructive">{q.error.message}</p>;
  const { needsMetadata, paths, flagged, recent } = q.data;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Waiting to be described{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({needsMetadata.length})
              </span>
            </CardTitle>
            <CardDescription>
              A course arrives from the content repo with its slug as a
              placeholder. It cannot be published until somebody writes what it
              is.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needsMetadata.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting. Every course has a title and a summary.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placeholder</TableHead>
                      <TableHead className="w-28">Track</TableHead>
                      <TableHead className="w-28">Arrived</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {needsMetadata.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/studio/courses/${c.slug}` as Route}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {c.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {c.track}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ago(c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Lessons worth a look{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({flagged.length})
              </span>
            </CardTitle>
            <CardDescription>
              Rated low, tagged unclear, or sitting on an unanswered question.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {flagged.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No lesson is rated low, tagged unclear, or sitting on an
                unanswered question.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lesson</TableHead>
                      <TableHead className="w-24">Rating</TableHead>
                      <TableHead className="w-24">Unclear</TableHead>
                      <TableHead className="w-24">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flagged.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-normal">
                          <Link
                            href={`/studio/lessons/${l.id}` as Route}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {l.title}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {l.courseTitle}
                            {l.needsMetadata ? " · no title yet" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {l.ratingAvg && l.ratingCount >= 3
                            ? `${Number(l.ratingAvg).toFixed(1)} (${l.ratingCount})`
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {l.unclearCount >= 3 ? (
                            <Badge variant="destructive">
                              {l.unclearCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              {l.unclearCount || "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {l.openQuestionCount > 0 ? (
                            <Badge variant="secondary">
                              {l.openQuestionCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Paths{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({paths.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {paths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paths yet.</p>
            ) : (
              paths.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 text-sm"
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
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent changes</CardTitle>
            <CardDescription>
              Every studio edit is recorded with who made it and what changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing edited yet.
              </p>
            ) : (
              recent.map((e) => (
                <div key={e.id} className="flex flex-col gap-0.5 text-sm">
                  <span>
                    <span className="font-medium">
                      {e.actorName ?? "Someone"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      changed {e.changes.map((c) => c.field).join(", ")} on
                      a{" "}
                    </span>
                    {/* Only a lesson can be linked: the studio routes for a
                        course and a path are keyed by slug, and the edit trail
                        records a subject id. */}
                    {e.subjectType === "lesson" ? (
                      <Link
                        href={`/studio/lessons/${e.subjectId}` as Route}
                        className="underline underline-offset-4"
                      >
                        lesson
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {e.subjectType}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ago(e.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
