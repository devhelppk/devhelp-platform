"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { ResendVerification } from "@/components/account/resend-verification";

const TRACKS = [
  {
    value: "technical",
    label: "Technical",
    hint: "Web, backend, AI engineering",
  },
  {
    value: "career",
    label: "Career",
    hint: "Interviews, freelancing, communication",
  },
] as const;

export function ApplyForm({
  emailVerified,
  policyUrl,
}: {
  emailVerified: boolean;
  policyUrl: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mine = useQuery(trpc.mentor.myApplication.queryOptions());
  const [tracks, setTracks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const apply = useMutation(
    trpc.mentor.submitApplication.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.mentor.myApplication.queryKey(),
        }),
      onError: (e) => setError(e.message),
    }),
  );
  if (mine.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  const app = mine.data?.application;
  if (mine.data?.role === "mentor" || mine.data?.role === "admin")
    return (
      <p className="text-sm">
        You are already a <span className="capitalize">{mine.data.role}</span>
        {mine.data.mentorTracks.length
          ? ` for ${mine.data.mentorTracks.join(" and ")}`
          : ""}
        .
      </p>
    );
  if (app && app.status === "pending")
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">In review</Badge>
          <span className="text-sm text-muted-foreground">
            Submitted{" "}
            {new Date(app.createdAt).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          An administrator will decide and you will be notified here and by
          email.
        </p>
      </div>
    );
  if (!emailVerified)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Applying needs a verified email. Confirm the link we sent you, or send
          a new one.
        </p>
        <ResendVerification size="sm" />
      </div>
    );
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (tracks.length === 0) return setError("Pick at least one track.");
    apply.mutate({
      tracks: tracks as ("technical" | "career")[],
      github: String(f.get("github") ?? "").trim(),
      why: String(f.get("why") ?? "").trim(),
      link: String(f.get("link") ?? "").trim() || undefined,
    });
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {app && app.status === "rejected" ? (
        <div className="rounded-lg border border-destructive/60 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium">
            Your previous application was not approved.
          </p>
          {app.reason ? (
            <p className="text-muted-foreground">{app.reason}</p>
          ) : null}
          {app.policyClause ? (
            <a
              href={`${policyUrl}#${app.policyClause}`}
              className="underline underline-offset-4"
            >
              Policy clause {app.policyClause}
            </a>
          ) : null}
        </div>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Tracks you can review</legend>
        {TRACKS.map((t) => (
          <label
            key={t.value}
            className="flex items-start gap-3 rounded-md border px-3 py-2"
          >
            <Checkbox
              checked={tracks.includes(t.value)}
              onCheckedChange={(c) =>
                setTracks((s) =>
                  c ? [...s, t.value] : s.filter((x) => x !== t.value),
                )
              }
              aria-label={t.label}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="github">GitHub handle</Label>
        <Input
          id="github"
          name="github"
          placeholder="octocat"
          required
          pattern="[A-Za-z0-9-]{1,39}"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="why">Why you, and what you would review</Label>
        <Textarea
          id="why"
          name="why"
          rows={5}
          required
          minLength={40}
          maxLength={2000}
          placeholder="Two or three sentences about your experience and the kind of content you want to keep honest."
        />
        <p className="text-xs text-muted-foreground">At least 40 characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="link">A link to your work (optional)</Label>
        <Input id="link" name="link" type="url" placeholder="https://" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={apply.isPending}
        className="self-start"
      >
        {apply.isPending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
