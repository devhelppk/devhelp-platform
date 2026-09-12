"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ago } from "@/components/moderation/labels";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Manual awards and revocations, each with a reason recorded on the award row
 * (plan decision 7).
 *
 * The award form is behind a button rather than always open: awarding by hand
 * is the rare repair, not the page's purpose, and an open form at the top pushed
 * the awards themselves below the fold. Revoking is a row action, because a
 * revocation is always *of* a particular award — the old shared form asked an
 * admin to retype the learner and badge they were already looking at, and put a
 * destructive submit next to the constructive one.
 */
export function AdminBadges() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  /** The award being revoked, or null. Identifies the row and names it in the dialog. */
  const [target, setTarget] = useState<{
    userId: string;
    badgeSlug: string;
    badgeName: string;
    learner: string;
  } | null>(null);

  const recent = useQuery(trpc.badges.adminList.queryOptions({ limit: 50 }));
  const refresh = () =>
    qc.invalidateQueries({ queryKey: trpc.badges.pathKey() });

  const revoke = useMutation(
    trpc.badges.revoke.mutationOptions({
      onSuccess: () => {
        setNote("Revoked.");
        setTarget(null);
        refresh();
      },
      onError: (e) => setNote(e.message),
    }),
  );

  function submitRevoke(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    setNote(null);
    const f = new FormData(e.currentTarget);
    revoke.mutate({
      userId: target.userId,
      badgeSlug: target.badgeSlug,
      reason: String(f.get("reason") ?? ""),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Recent awards</h2>
        {/* The reason is shown: the page promises it is kept on the award, and
            the API returns `awardReason` and `revokedReason`. The old list
            rendered neither, so the one thing a manual award records was
            invisible. */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Badge</TableHead>
                <TableHead className="w-72">Learner</TableHead>
                <TableHead className="w-36">Source</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24">When</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent.data ?? []).map((a) => (
                <TableRow key={`${a.user.id}-${a.badge.slug}`}>
                  <TableCell className="align-top font-medium">
                    {a.badge.name}
                    {a.revokedAt ? (
                      <Badge
                        variant="destructive"
                        className="ml-2 align-middle"
                      >
                        Revoked
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="block truncate">{a.user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.user.email}
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    {a.awarder ? (
                      <Badge variant="outline">by {a.awarder.name}</Badge>
                    ) : (
                      <Badge variant="outline">automatic</Badge>
                    )}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal text-muted-foreground">
                    {a.revokedAt
                      ? (a.revokedReason ?? "—")
                      : (a.awardReason ?? "—")}
                  </TableCell>
                  <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground">
                    {ago(a.awardedAt)}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    {a.revokedAt ? null : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          setTarget({
                            userId: a.user.id,
                            badgeSlug: a.badge.slug,
                            badgeName: a.badge.name,
                            learner: a.user.name,
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {recent.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No awards yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Revoking names the award it is about, so an admin cannot mistype their
          way into revoking the wrong one. */}
      <Dialog
        open={Boolean(target)}
        onOpenChange={(next) => (next ? undefined : setTarget(null))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revoke “{target?.badgeName}”</DialogTitle>
            <DialogDescription>
              From {target?.learner}. The reason is recorded on the award and
              stays visible in this list.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRevoke} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Reason
              <Textarea name="reason" required minLength={5} maxLength={500} />
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="destructive"
                disabled={revoke.isPending}
              >
                {revoke.isPending ? "Revoking…" : "Revoke badge"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTarget(null)}
              >
                Cancel
              </Button>
              {note ? (
                <span role="status" className="text-sm text-muted-foreground">
                  {note}
                </span>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
