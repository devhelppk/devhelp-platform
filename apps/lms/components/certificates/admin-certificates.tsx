"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { invalidateVerifyPage } from "@/app/admin/certificates/actions";

/** Admin list with revoke / restore, both requiring a reason that is logged and sent to the learner. */
export function AdminCertificates() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `adminList` has taken a cursor and returned a `nextCursor` since S7; this
  // asked for one page and rendered it, so an admin could reach thirty
  // certificates and no more — the same defect the moderation queue had.
  const list = useInfiniteQuery(
    trpc.certificates.adminList.infiniteQueryOptions(
      { q: q || undefined, limit: 30 },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () =>
    qc.invalidateQueries({ queryKey: trpc.certificates.pathKey() });
  /** The row the dialog is about, found in the page already loaded. */
  const target = items.find((c) => c.id === open) ?? null;
  // The public verify page is cached; drop it so a decision shows at once.
  const done = async (id: string) => {
    setOpen(null);
    setError(null);
    await invalidateVerifyPage(id);
    refresh();
  };
  const revoke = useMutation(
    trpc.certificates.revoke.mutationOptions({
      onSuccess: (_r, vars) => done(vars.id),
      onError: (e) => setError(e.message),
    }),
  );
  const restore = useMutation(
    trpc.certificates.restore.mutationOptions({
      onSuccess: (_r, vars) => done(vars.id),
      onError: (e) => setError(e.message),
    }),
  );
  function submit(id: string, revoked: boolean) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const reason = String(
        new FormData(e.currentTarget).get("reason") ?? "",
      ).trim();
      (revoked ? restore : revoke).mutate({ id, reason });
    };
  }
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by learner or course"
        aria-label="Search certificates"
        className="max-w-sm"
      />
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{list.error.message}</p>
      ) : (
        /* A table: learner, course, issued, state, action — the columns an admin
           scans. The reason form opens in a row beneath the one being decided,
           so the list keeps its place. `revokedReason` was already returned and
           never shown; a revoked certificate now says why. */
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">Learner</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="w-28">Issued</TableHead>
                <TableHead className="w-44">State</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="align-top">
                    <Link
                      href={`/verify/${c.id}` as Route}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {c.learnerName}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.user.email}
                    </span>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    {c.courseTitle}
                  </TableCell>
                  <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(c.issuedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    {c.revokedAt ? (
                      <>
                        <Badge variant="destructive">Revoked</Badge>
                        {c.revokedReason ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {c.revokedReason}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <Badge variant="outline">Valid</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setOpen(open === c.id ? null : c.id)}
                    >
                      {c.revokedAt ? "Restore" : "Revoke"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No certificates match.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
      {list.hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}

      {/* Revoking and restoring ask for a reason in a dialog that names the
          certificate, rather than an inline form that expanded inside the
          table and pushed every row below it down. */}
      <Dialog
        open={Boolean(open)}
        onOpenChange={(next) => (next ? undefined : setOpen(null))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {target?.revokedAt ? "Restore" : "Revoke"} certificate
            </DialogTitle>
            <DialogDescription>
              {target
                ? `${target.learnerName} — ${target.courseTitle}. The reason is logged and sent to the learner, and the verify page and PDF say so.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {target ? (
            <form
              onSubmit={submit(target.id, !!target.revokedAt)}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1 text-sm" htmlFor="reason">
                Reason
                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  required
                  minLength={5}
                  maxLength={500}
                />
              </label>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant={target.revokedAt ? "default" : "destructive"}
                  disabled={revoke.isPending || restore.isPending}
                >
                  {target.revokedAt
                    ? "Restore certificate"
                    : "Revoke certificate"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
