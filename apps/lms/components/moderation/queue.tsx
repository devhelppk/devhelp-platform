"use client";

import { Badge } from "@repo/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { useTRPC } from "@/lib/trpc/client";
import { ago, statusLabels, subjectLabels } from "./labels";

type Status = keyof typeof statusLabels;
const TABS: Status[] = ["pending", "approved", "rejected", "hidden"];

export function ModerationQueue({ status }: { status: Status }) {
  const trpc = useTRPC();
  const counts = useQuery(trpc.moderation.counts.queryOptions());
  const queue = useQuery(trpc.moderation.queue.queryOptions({ status }));
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Queue status" className="flex flex-wrap gap-1 border-b">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/moderate?status=${s}` as Route}
            aria-current={s === status ? "page" : undefined}
            className={
              s === status
                ? "-mb-px border-b-2 border-primary px-3 py-2 text-sm font-medium"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {statusLabels[s]}
            {counts.data?.[s] ? (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {counts.data[s]}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {queue.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : queue.error ? (
        <p className="text-sm text-destructive">{queue.error.message}</p>
      ) : queue.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing {statusLabels[status].toLowerCase()}
          {queue.data.tracks
            ? ` in your tracks (${queue.data.tracks.join(", ") || "none granted yet"})`
            : ""}
          .
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {queue.data.items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/moderate/${it.id}` as Route}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex-1 text-sm font-medium">
                  {subjectLabels[it.subjectType]}
                  <span className="ml-2 font-normal text-muted-foreground">
                    by {it.submitter?.name ?? "someone"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {it.track ? (
                    <Badge variant="outline" className="capitalize">
                      {it.track}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Admin</Badge>
                  )}
                  <span>{ago(it.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
