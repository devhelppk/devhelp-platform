"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { ago } from "@/components/moderation/labels";

/** Manual awards and revocations, each with a reason recorded on the award row (plan decision 7). */
export function AdminBadges() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const catalogue = useQuery(trpc.badges.catalogue.queryOptions());
  const recent = useQuery(trpc.badges.adminList.queryOptions({ limit: 50 }));
  const refresh = () =>
    qc.invalidateQueries({ queryKey: trpc.badges.pathKey() });
  const award = useMutation(
    trpc.badges.award.mutationOptions({
      onSuccess: () => {
        setNote("Awarded.");
        refresh();
      },
      onError: (e) => setNote(e.message),
    }),
  );
  const revoke = useMutation(
    trpc.badges.revoke.mutationOptions({
      onSuccess: () => {
        setNote("Revoked.");
        refresh();
      },
      onError: (e) => setNote(e.message),
    }),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote(null);
    const f = new FormData(e.currentTarget);
    // Which button submitted, not React state: a keyboard submit has no click,
    // and one of these revokes.
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value === "revoke" ? "revoke" : "award";
    const input = {
      userId: String(f.get("userId") ?? "").trim(),
      badgeSlug: String(f.get("badgeSlug") ?? "").trim(),
      reason: String(f.get("reason") ?? "").trim(),
    };
    (action === "award" ? award : revoke).mutate(input);
  }
  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-lg border p-4"
      >
        <h2 className="text-base font-semibold">Award or revoke</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Learner id
            <Input
              name="userId"
              required
              placeholder="uuid from the admin certificates page"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Badge
            <select
              name="badgeSlug"
              required
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {(catalogue.data ?? []).map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Reason (recorded on the award)
          <Textarea
            name="reason"
            rows={2}
            required
            minLength={5}
            maxLength={500}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            name="action"
            value="award"
            disabled={award.isPending}
          >
            Award
          </Button>
          <Button
            type="submit"
            name="action"
            value="revoke"
            variant="destructive"
            disabled={revoke.isPending}
          >
            Revoke
          </Button>
          {note ? (
            <span role="status" className="text-sm text-muted-foreground">
              {note}
            </span>
          ) : null}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Recent awards</h2>
        <ul className="divide-y rounded-lg border">
          {(recent.data ?? []).map((a) => (
            <li
              key={`${a.user.id}-${a.badge.slug}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
            >
              <span className="font-medium">{a.badge.name}</span>
              <span className="flex-1 text-muted-foreground">
                {a.user.name} ({a.user.email})
              </span>
              {a.awarder ? (
                <Badge variant="outline">by {a.awarder.name}</Badge>
              ) : (
                <Badge variant="outline">automatic</Badge>
              )}
              {a.revokedAt ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {ago(a.awardedAt)}
              </span>
            </li>
          ))}
          {recent.data?.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No awards yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
