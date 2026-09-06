"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { ResendVerification } from "./resend-verification";

export function AccountForm() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const me = useQuery(trpc.account.me.queryOptions());
  const [note, setNote] = useState<string | null>(null);
  const update = useMutation(
    trpc.account.updateProfile.mutationOptions({
      onSuccess: async () => {
        setNote("Saved.");
        await qc.invalidateQueries({ queryKey: trpc.account.me.queryKey() });
        router.refresh();
      },
      onError: (e) => setNote(e.message),
    }),
  );
  if (me.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (me.error || !me.data)
    return (
      <p className="text-sm text-destructive">Could not load your account.</p>
    );
  const u = me.data;
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update.mutate({
      name: String(f.get("name") ?? ""),
      city: String(f.get("city") ?? ""),
    });
  }
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Email</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{u.email}</span>
          {u.emailVerified ? (
            <Badge>Verified</Badge>
          ) : (
            <Badge variant="outline">Not verified</Badge>
          )}
        </div>
        {u.emailVerified ? (
          <p className="text-sm text-muted-foreground">
            You can contribute reviews, questions, projects, and apply to
            mentor.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Learning works without verification. Contributing needs it:
              confirm the link we emailed, or send a new one.
            </p>
            <ResendVerification size="sm" />
          </>
        )}
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={u.name}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={u.city ?? ""}
            placeholder="Karachi"
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground">
            Used for cohorts and local meetups. Optional.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          {note ? (
            <span role="status" className="text-sm text-muted-foreground">
              {note}
            </span>
          ) : null}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          Change your password through a reset link sent to your email.
        </p>
        <Button variant="outline" size="sm" asChild className="self-start">
          <Link href="/forgot-password">Send password reset link</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Role</h2>
        <p className="text-sm">
          <span className="capitalize">{u.role ?? "student"}</span>
          {u.mentorTracks.length ? (
            <span className="text-muted-foreground">
              {" "}
              · tracks: {u.mentorTracks.join(", ")}
            </span>
          ) : null}
        </p>
        {u.role === "student" || !u.role ? (
          <Button variant="outline" size="sm" asChild className="self-start">
            <Link href="/mentor/apply">Apply to be a mentor</Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
