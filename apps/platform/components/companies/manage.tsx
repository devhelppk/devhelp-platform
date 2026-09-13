"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Month, Rating } from "@/components/companies/bits";
import { useTRPC } from "@/lib/trpc/client";

const statusText = {
  pending: "Waiting for review",
  published: "Published",
  hidden: "Hidden by a moderator",
  rejected: "Not published",
} as const;

/** What a representative sees: everything written about them, and their replies. */
export function Manage({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.claims.inbox.queryOptions({ slug }));
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error)
    return <p className="text-sm text-destructive">{q.error.message}</p>;
  const { reviews, interviews, responses } = q.data;
  const replyTo = (type: string, id: string) =>
    responses.find((r) => r.subjectType === type && r.subjectId === id);
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">
          Reviews{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({reviews.length})
          </span>
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody has reviewed you yet.
          </p>
        ) : (
          reviews.map((r) => (
            <article
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Rating value={r.rating} />
                {r.roleText ? (
                  <span className="text-muted-foreground">{r.roleText}</span>
                ) : null}
                <span className="ml-auto">
                  <Month value={r.createdMonth} />
                </span>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Pros
                  </h3>
                  <p className="whitespace-pre-wrap">{r.pros}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Cons
                  </h3>
                  <p className="whitespace-pre-wrap">{r.cons}</p>
                </div>
              </div>
              <Reply
                slug={slug}
                subjectType="company_review"
                subjectId={r.id}
                existing={replyTo("company_review", r.id)}
              />
            </article>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">
          Interview experiences{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({interviews.length})
          </span>
        </h2>
        {interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          interviews.map((i) => (
            <article
              key={i.id}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{i.roleText ?? "Interview"}</span>
                <Badge variant="outline" className="text-xs">
                  {i.outcome.replace(/_/g, " ")}
                </Badge>
                <span className="ml-auto">
                  <Month value={i.yearMonth} />
                </span>
              </div>
              {i.advice ? (
                <p className="text-sm whitespace-pre-wrap">{i.advice}</p>
              ) : null}
              <Reply
                slug={slug}
                subjectType="interview_experience"
                subjectId={i.id}
                existing={replyTo("interview_experience", i.id)}
              />
            </article>
          ))
        )}
      </section>
    </div>
  );
}

/** One reply box. A right of reply, not a thread: editing replaces. */
function Reply({
  slug,
  subjectType,
  subjectId,
  existing,
}: {
  slug: string;
  subjectType: "company_review" | "interview_experience";
  subjectId: string;
  existing?: {
    body: string;
    bodyHtml: string;
    status: "pending" | "published" | "hidden" | "rejected";
  };
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const respond = useMutation(
    trpc.claims.respond.mutationOptions({
      onSuccess: () => {
        setError(null);
        setOpen(false);
        qc.invalidateQueries({ queryKey: trpc.claims.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = String(new FormData(e.currentTarget).get("body") ?? "").trim();
    respond.mutate({ slug, subjectType, subjectId, body });
  }
  if (existing && !open)
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Your reply</span>
          <Badge
            variant={existing.status === "published" ? "secondary" : "outline"}
            className="text-xs"
          >
            {statusText[existing.status]}
          </Badge>
          {existing.status !== "hidden" && existing.status !== "rejected" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setOpen(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          // Rendered and sanitised when it was written, as everywhere else.
          dangerouslySetInnerHTML={{ __html: existing.bodyHtml }}
        />
        {existing.status === "hidden" || existing.status === "rejected" ? (
          <p className="text-xs text-muted-foreground">
            A moderator took this down. Rewriting it will not put it back;
            contact the devhelp team if you think that was wrong.
          </p>
        ) : null}
      </div>
    );
  if (!open)
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        Reply publicly
      </Button>
    );
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border p-3"
    >
      <label htmlFor={`reply-${subjectId}`} className="text-xs font-medium">
        Your reply, shown under this post and attributed to the company
      </label>
      <Textarea
        id={`reply-${subjectId}`}
        name="body"
        rows={4}
        required
        minLength={20}
        maxLength={4000}
        defaultValue={existing?.body ?? ""}
      />
      <p className="text-xs text-muted-foreground">
        Markdown. An administrator reads it before it appears, and the same
        content policy applies to you as to everyone else.
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={respond.isPending}>
          {respond.isPending ? "Sending…" : "Send for review"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
