"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { ResendVerification } from "./resend-verification";
import { ProfileForm } from "@/components/profile/profile-form";

export function AccountForm({ lmsUrl }: { lmsUrl: string }) {
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
    /* Two columns from `lg`: the forms people fill in on the left, the short
       status-and-one-button blocks on the right. Stacked in a single centred
       768px column these were five full-width sections and roughly 1700px of
       page for content that fits on one screen. */
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {/* Paired, as the GitHub / Website / LinkedIn row already is —
                  two short fields on separate rows contradicted it. */}
              <div className="grid gap-4 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initial={{
                handle: u.handle,
                profilePublic: u.profilePublic,
                bio: u.bio,
                links: u.links,
              }}
              lmsUrl={lmsUrl}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm break-all">{u.email}</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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
              <Button
                variant="outline"
                size="sm"
                asChild
                className="self-start"
              >
                <Link href="/mentor/apply">Apply to be a mentor</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Change your password through a reset link sent to your email.
            </p>
            <Button variant="outline" size="sm" asChild className="self-start">
              <Link href="/forgot-password">Send password reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
