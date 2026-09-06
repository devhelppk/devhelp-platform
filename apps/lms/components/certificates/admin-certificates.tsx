"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const list = useQuery(
    trpc.certificates.adminList.queryOptions({ q: q || undefined, limit: 30 }),
  );
  const refresh = () =>
    qc.invalidateQueries({ queryKey: trpc.certificates.pathKey() });
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
        <ul className="divide-y rounded-lg border">
          {list.data.items.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/verify/${c.id}` as Route}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {c.learnerName}
                </Link>
                <span className="text-muted-foreground">{c.user.email}</span>
                <span className="flex-1">{c.courseTitle}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.issuedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {c.revokedAt ? (
                  <Badge variant="destructive">Revoked</Badge>
                ) : (
                  <Badge variant="outline">Valid</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                >
                  {c.revokedAt ? "Restore" : "Revoke"}
                </Button>
              </div>
              {open === c.id ? (
                <form
                  onSubmit={submit(c.id, !!c.revokedAt)}
                  className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3"
                >
                  <label
                    className="text-xs font-medium"
                    htmlFor={`reason-${c.id}`}
                  >
                    Reason (sent to the learner and logged)
                  </label>
                  <Textarea
                    id={`reason-${c.id}`}
                    name="reason"
                    rows={2}
                    required
                    minLength={5}
                    maxLength={500}
                  />
                  {error ? (
                    <p className="text-xs text-destructive">{error}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant={c.revokedAt ? "default" : "destructive"}
                      disabled={revoke.isPending || restore.isPending}
                    >
                      {c.revokedAt
                        ? "Restore certificate"
                        : "Revoke certificate"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpen(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
          {list.data.items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No certificates match.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
