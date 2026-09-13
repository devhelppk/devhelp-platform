"use client";

import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ThumbsUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FlagControl } from "@/components/moderation/flag-control";
import { useTRPC } from "@/lib/trpc/client";
import { ago } from "@/components/moderation/labels";

type List = inferRouterOutputs<AppRouter>["comments"]["list"];
type Item = List["items"][number];
type Reply = Item["replies"][number];
type Subject = { courseSlug: string; lessonSlug?: string };

/** Discussion island (F4.3): loads after the body, one level of replies, votes, accepted answers, flags. */
export function Discussion({
  courseSlug,
  lessonSlug,
  signInHref,
}: Subject & { signInHref: string }) {
  const trpc = useTRPC();
  const [sort, setSort] = useState<"top" | "new">("top");
  const subject = { courseSlug, lessonSlug };
  const list = useQuery(trpc.comments.list.queryOptions({ ...subject, sort }));
  const qc = useQueryClient();
  const refresh = () =>
    qc.invalidateQueries({
      queryKey: trpc.comments.list.queryKey({ ...subject, sort }),
    });
  const watch = useMutation(
    trpc.comments.watch.mutationOptions({ onSuccess: refresh }),
  );
  if (list.isPending)
    return <p className="text-sm text-muted-foreground">Loading discussion…</p>;
  if (list.error)
    return <p className="text-sm text-destructive">{list.error.message}</p>;
  const d = list.data;
  return (
    <section
      id="discussion"
      aria-labelledby="discussion-heading"
      className="flex scroll-mt-20 flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="discussion-heading" className="text-lg font-semibold">
          Discussion
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {d.items.length
              ? `${d.items.length} thread${d.items.length === 1 ? "" : "s"}`
              : "no threads yet"}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {d.canAccept && lessonSlug ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                watch.mutate({ courseSlug, lessonSlug, on: !d.watching })
              }
              disabled={watch.isPending}
            >
              {d.watching ? "Watching" : "Watch questions"}
            </Button>
          ) : null}
          <div
            role="group"
            aria-label="Sort"
            className="flex rounded-md border text-xs"
          >
            {(["top", "new"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
                className={cn(
                  "px-2.5 py-1",
                  sort === s ? "bg-muted font-medium" : "text-muted-foreground",
                )}
              >
                {s === "top" ? "Top" : "Newest"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {d.signedIn ? (
        d.verified ? (
          <Composer subject={subject} onDone={refresh} />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/account" className="underline underline-offset-4">
              Verify your email
            </Link>{" "}
            to ask a question or leave a note.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link
            href={signInHref as Route}
            className="underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}
      <ol className="flex flex-col gap-4">
        {d.items.map((item) => (
          <li key={item.id}>
            <Thread
              item={item}
              subject={subject}
              canAccept={d.canAccept}
              verified={d.verified}
              signedIn={d.signedIn}
              onChange={refresh}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Composer({
  subject,
  parentId,
  onDone,
  onCancel,
}: {
  subject: Subject;
  parentId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const trpc = useTRPC();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"question" | "note">("question");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const create = useMutation(
    trpc.comments.create.mutationOptions({
      onSuccess: (r) => {
        setBody("");
        setPreview(null);
        setNote(
          r.status === "held"
            ? "Posted. A moderator will look at it before it appears, because it contains a link from a new account."
            : null,
        );
        onDone();
        onCancel?.();
      },
      onError: (e) => setError(e.message),
    }),
  );
  const previewMut = useMutation(
    trpc.comments.preview.mutationOptions({
      onSuccess: (r) => setPreview(r.html),
    }),
  );
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    create.mutate({ ...subject, body: body.trim(), kind, parentId });
  }
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      {!parentId ? (
        <div role="group" aria-label="Kind" className="flex gap-1 text-xs">
          {(["question", "note"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-3 py-1 capitalize",
                kind === k
                  ? "border-primary bg-primary/10"
                  : "text-muted-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}
      {preview !== null ? (
        <div
          className="prose-comment min-h-16 rounded-md bg-muted/40 px-3 py-2 text-sm"
          dangerouslySetInnerHTML={{
            __html: preview || "<p><em>Nothing to preview.</em></p>",
          }}
        />
      ) : (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={parentId ? 3 : 4}
          maxLength={5000}
          required
          minLength={2}
          placeholder={
            parentId
              ? "Write a reply. Markdown and ``` code blocks work."
              : kind === "question"
                ? "What are you stuck on? Include the code or the error. Markdown works."
                : "A note for other learners."
          }
          aria-label={parentId ? "Reply" : "New comment"}
        />
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="text-xs text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending || body.trim().length < 2}
        >
          {create.isPending
            ? "Posting…"
            : parentId
              ? "Reply"
              : kind === "question"
                ? "Ask"
                : "Post note"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!body.trim()}
          onClick={() =>
            preview === null ? previewMut.mutate({ body }) : setPreview(null)
          }
        >
          {preview === null ? "Preview" : "Edit"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          Markdown, fenced code. Be kind; see the policy.
        </span>
      </div>
    </form>
  );
}

function Thread({
  item,
  subject,
  canAccept,
  verified,
  signedIn,
  onChange,
}: {
  item: Item;
  subject: Subject;
  canAccept: boolean;
  verified: boolean;
  signedIn: boolean;
  onChange: () => void;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <article className="rounded-lg border">
      <CommentBody
        c={item}
        canAccept={false}
        signedIn={signedIn}
        onChange={onChange}
        isTop
      />
      {item.replies.length ? (
        <ol className="flex flex-col divide-y border-t bg-muted/30">
          {item.replies.map((r) => (
            <li key={r.id} className="pl-4">
              <CommentBody
                c={r}
                canAccept={canAccept}
                signedIn={signedIn}
                onChange={onChange}
              />
            </li>
          ))}
        </ol>
      ) : null}
      {!item.removed && signedIn ? (
        <div className="border-t px-3 py-2">
          {replying ? (
            <Composer
              subject={subject}
              parentId={item.id}
              onDone={onChange}
              onCancel={() => setReplying(false)}
            />
          ) : verified ? (
            <Button variant="ghost" size="sm" onClick={() => setReplying(true)}>
              Reply
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Verify your email to reply.
            </span>
          )}
        </div>
      ) : null}
    </article>
  );
}

function CommentBody({
  c,
  canAccept,
  signedIn,
  onChange,
  isTop = false,
}: {
  c: Item | Reply;
  canAccept: boolean;
  signedIn: boolean;
  onChange: () => void;
  isTop?: boolean;
}) {
  const trpc = useTRPC();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const vote = useMutation(
    trpc.comments.vote.mutationOptions({
      onSuccess: onChange,
      onError: (e) => setErr(e.message),
    }),
  );
  const accept = useMutation(
    trpc.comments.accept.mutationOptions({
      onSuccess: onChange,
      onError: (e) => setErr(e.message),
    }),
  );
  const remove = useMutation(
    trpc.comments.remove.mutationOptions({ onSuccess: onChange }),
  );
  const edit = useMutation(
    trpc.comments.edit.mutationOptions({
      onSuccess: () => {
        setEditing(false);
        onChange();
      },
      onError: (e) => setErr(e.message),
    }),
  );
  const accepted = !!c.acceptedAt;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-3 py-3",
        accepted && "border-l-2 border-primary",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {c.author?.name ?? "Former member"}
        </span>
        {c.author?.role === "mentor" || c.author?.role === "admin" ? (
          <Badge variant="outline" className="capitalize">
            {c.author.role}
          </Badge>
        ) : null}
        {isTop ? (
          <Badge variant="secondary" className="capitalize">
            {c.kind}
          </Badge>
        ) : null}
        {accepted ? (
          <Badge>
            <Check aria-hidden="true" className="size-3" /> Accepted answer
          </Badge>
        ) : null}
        {c.status === "held" ? (
          <Badge variant="outline">Waiting for a moderator</Badge>
        ) : null}
        <span>{ago(c.createdAt)}</span>
        {c.editedAt ? <span>(edited)</span> : null}
      </div>
      {c.removed ? (
        <p className="text-sm text-muted-foreground italic">
          {c.status === "deleted"
            ? "Deleted by the author."
            : "Removed by a moderator."}
        </p>
      ) : editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            edit.mutate({ id: c.id, body: draft.trim() });
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={5000}
            aria-label="Edit comment"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={edit.isPending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div
          className="prose-comment text-sm"
          dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
        />
      )}
      {!c.removed && !editing ? (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2"
            aria-pressed={c.voted}
            disabled={!signedIn || c.mine || vote.isPending}
            onClick={() => vote.mutate({ id: c.id, on: !c.voted })}
            aria-label={`${c.voteCount} votes`}
          >
            <ThumbsUp
              aria-hidden="true"
              className={cn("size-3.5", c.voted && "fill-current")}
            />{" "}
            {c.voteCount}
          </Button>
          {canAccept && !isTop && !accepted ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => accept.mutate({ id: c.id })}
              disabled={accept.isPending}
            >
              Accept answer
            </Button>
          ) : null}
          {c.mine && c.status !== "hidden" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setDraft(c.body);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => remove.mutate({ id: c.id })}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </>
          ) : null}
          {signedIn && !c.mine ? (
            <FlagControl subjectType="comment" subjectId={c.id} />
          ) : null}
          {err ? <span className="text-destructive">{err}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
