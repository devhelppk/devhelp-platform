"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { ago, clauses, statusLabels, subjectLabels } from "./labels";

export function ModerationItem({
  id,
  isAdmin,
  policyUrl,
}: {
  id: string;
  isAdmin: boolean;
  policyUrl: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const item = useQuery(trpc.moderation.item.queryOptions({ id }));
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation(
    trpc.moderation.decide.mutationOptions({
      onSuccess: async () => {
        setError(null);
        await qc.invalidateQueries({ queryKey: trpc.moderation.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (item.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (item.error || !item.data)
    return (
      <p className="text-sm text-destructive">
        {item.error?.message ?? "Not found."}
      </p>
    );
  const it = item.data;
  const payload = it.payload;
  const canDecide = it.subjectType !== "mentor_application" || isAdmin;

  function submit(action: "approve" | "reject" | "hide" | "unhide") {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const reason = String(f.get("reason") ?? "").trim() || undefined;
      const clause = String(f.get("clause") ?? "") || undefined;
      decide.mutate({
        id,
        action,
        reason,
        policyClause: clause as `c${number}` | undefined,
      });
    };
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              it.status === "pending"
                ? "secondary"
                : it.status === "approved"
                  ? "default"
                  : "outline"
            }
          >
            {statusLabels[it.status]}
          </Badge>
          {it.track ? (
            <Badge variant="outline" className="capitalize">
              {it.track}
            </Badge>
          ) : (
            <Badge variant="outline">Admin only</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            submitted {ago(it.createdAt)}
          </span>
        </div>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Submitted by</dt>
          <dd>
            {it.submitter?.name ?? "Unknown"}{" "}
            <span className="text-muted-foreground">
              ({it.submitter?.email}, {it.submitter?.role ?? "student"}, joined{" "}
              {it.submitter
                ? new Date(it.submitter.createdAt).toLocaleDateString("en-PK", {
                    month: "short",
                    year: "numeric",
                  })
                : "?"}
              )
            </span>
          </dd>
          {payload.kind === "mentor_application" ? (
            <>
              <dt className="text-muted-foreground">Tracks</dt>
              <dd className="capitalize">{payload.data.tracks.join(", ")}</dd>
              <dt className="text-muted-foreground">GitHub</dt>
              <dd>
                <a
                  href={`https://github.com/${payload.data.github}`}
                  className="underline underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  {payload.data.github}
                </a>
              </dd>
              {payload.data.link ? (
                <>
                  <dt className="text-muted-foreground">Work</dt>
                  <dd>
                    <a
                      href={payload.data.link}
                      className="underline underline-offset-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {payload.data.link}
                    </a>
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Why</dt>
              <dd className="whitespace-pre-wrap">{payload.data.why}</dd>
            </>
          ) : payload.kind === "comment" ? (
            <>
              <dt className="text-muted-foreground">On</dt>
              <dd>
                <Link
                  href={
                    (payload.data.subjectType === "lesson"
                      ? `/courses/${payload.data.courseSlug}/${payload.data.subjectSlug}#discussion`
                      : `/courses/${payload.data.courseSlug}#discussion`) as Route
                  }
                  className="underline underline-offset-4"
                >
                  {payload.data.subjectTitle}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  ({payload.data.kind})
                </span>
              </dd>
              <dt className="text-muted-foreground">Held because</dt>
              <dd>{payload.data.holdReason}</dd>
              <dt className="text-muted-foreground">Text</dt>
              <dd className="font-mono text-xs whitespace-pre-wrap">
                {payload.data.body}
              </dd>
            </>
          ) : payload.kind === "certificate" ? (
            <>
              <dt className="text-muted-foreground">Certificate</dt>
              <dd>
                <Link
                  href={`/verify/${it.subjectId}` as Route}
                  className="underline underline-offset-4"
                >
                  {payload.data.learnerName}: {payload.data.courseTitle}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  issued{" "}
                  {new Date(payload.data.issuedAt).toLocaleDateString("en-GB")}
                </span>
              </dd>
            </>
          ) : payload.kind === "course_review" ? (
            <>
              <dt className="text-muted-foreground">Course</dt>
              <dd>
                <Link
                  href={`/courses/${payload.data.courseSlug}` as Route}
                  className="underline underline-offset-4"
                >
                  {payload.data.courseTitle}
                </Link>
              </dd>
              <dt className="text-muted-foreground">Rating</dt>
              <dd>{payload.data.rating} / 5</dd>
              {payload.data.title ? (
                <>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd>{payload.data.title}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Review</dt>
              <dd className="whitespace-pre-wrap">{payload.data.body}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">Target</dt>
              <dd>
                {payload.data.targetType} {payload.data.targetId}
              </dd>
              <dt className="text-muted-foreground">Contact</dt>
              <dd>{payload.data.contactEmail}</dd>
              <dt className="text-muted-foreground">Message</dt>
              <dd className="whitespace-pre-wrap">{payload.data.message}</dd>
            </>
          )}
          {it.reason ? (
            <>
              <dt className="text-muted-foreground">Decision</dt>
              <dd>
                {it.reason}
                {it.policyClause ? (
                  <>
                    {" "}
                    <a
                      href={`${policyUrl}#${it.policyClause}`}
                      className="underline underline-offset-4"
                    >
                      ({it.policyClause})
                    </a>
                  </>
                ) : null}
              </dd>
            </>
          ) : null}
        </dl>

        {it.status === "pending" && canDecide ? (
          <form
            onSubmit={submit("approve")}
            className="flex flex-col gap-4 rounded-lg border p-4"
            id="decide"
          >
            <h2 className="text-base font-semibold">Decide</h2>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">
                Reason (required to reject; sent to the submitter)
              </Label>
              <Textarea id="reason" name="reason" rows={3} maxLength={1000} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clause">Policy clause</Label>
              <select
                id="clause"
                name="clause"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {clauses.map(([id, title]) => (
                  <option key={id} value={id}>
                    {id}. {title}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={decide.isPending}>
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={decide.isPending}
                onClick={(e) => {
                  const form = e.currentTarget.form!;
                  const f = new FormData(form);
                  const reason = String(f.get("reason") ?? "").trim();
                  if (!reason)
                    return setError("A reason is required to reject.");
                  decide.mutate({
                    id,
                    action: "reject",
                    reason,
                    policyClause: (String(f.get("clause") ?? "") ||
                      undefined) as `c${number}` | undefined,
                  });
                }}
              >
                Reject
              </Button>
            </div>
          </form>
        ) : it.status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Only administrators decide mentor applications.
          </p>
        ) : null}
        {it.status === "approved" && canDecide ? (
          <form onSubmit={submit("hide")} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="reason">Hide with reason</Label>
              <Textarea id="reason" name="reason" rows={2} required />
            </div>
            <Button type="submit" variant="outline" disabled={decide.isPending}>
              Hide
            </Button>
          </form>
        ) : null}
        {it.status === "hidden" && canDecide ? (
          <form onSubmit={submit("unhide")}>
            <Button type="submit" variant="outline" disabled={decide.isPending}>
              Unhide
            </Button>
          </form>
        ) : null}
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">History</h2>
        <ol className="flex flex-col gap-3 border-l pl-4 text-sm">
          {it.actions.map((a) => (
            <li key={a.id} className="flex flex-col">
              <span>
                <span className="font-medium capitalize">
                  {a.action.replace("_", " ")}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  by {a.actor?.name ?? "system"}, {ago(a.createdAt)}
                </span>
              </span>
              {a.reason ? (
                <span className="text-muted-foreground">{a.reason}</span>
              ) : null}
              {a.policyClause ? (
                <span className="text-xs text-muted-foreground">
                  clause {a.policyClause}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Every action here is permanent and visible to administrators. The
          policy is at{" "}
          <Link
            href={policyUrl as `https://${string}`}
            className="underline underline-offset-4"
          >
            {policyUrl.replace(/^https?:\/\//, "")}
          </Link>
          . Subject {subjectLabels[it.subjectType]} id{" "}
          {it.subjectId.slice(0, 8)}.
        </p>
      </aside>
    </div>
  );
}
