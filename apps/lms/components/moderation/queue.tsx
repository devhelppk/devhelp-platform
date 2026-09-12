"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { parseAsString, useQueryState } from "nuqs";
import { useTRPC } from "@/lib/trpc/client";
import { moderationParams } from "@/lib/search-params";
import { ago, statusLabels, subjectLabels } from "./labels";
import { itemSummary } from "./summary";

type Status = keyof typeof statusLabels;
const TABS: Status[] = ["pending", "approved", "rejected", "hidden"];
const ANY = "__any";

/**
 * The queue as a table a moderator can actually work from.
 *
 * Two things were wrong with the list it replaces. Every row read
 * "<kind> by someone", so a thousand pending items were indistinguishable and
 * each had to be opened to learn anything — the payload snapshot was stored and
 * never shown. And the `queue` procedure has taken a `cursor` and returned a
 * `nextCursor` since S5, while the client asked for one page and rendered it:
 * with 1015 pending items a moderator could reach thirty of them and no more.
 *
 * Pagination is the API's cursor through `useInfiniteQuery` rather than a
 * client-side table library: the server already orders and filters, so nothing
 * here needs to sort rows it does not have.
 */
export function ModerationQueue({ status }: { status: Status }) {
  const trpc = useTRPC();
  const counts = useQuery(trpc.moderation.counts.queryOptions());
  const [type, setType] = useQueryState(
    "type",
    moderationParams.type.withOptions({ shallow: true }),
  );
  // The open item is server-owned (`shallow: false`), so a refresh or a shared
  // link lands on the same dialog.
  const [, setItem] = useQueryState(
    "item",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );

  const queue = useInfiniteQuery(
    trpc.moderation.queue.infiniteQueryOptions(
      { status, subjectType: (type || undefined) as never },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const items = queue.data?.pages.flatMap((p) => p.items) ?? [];
  const tracks = queue.data?.pages[0]?.tracks;

  return (
    <div className="flex flex-col gap-4">
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

      {/* One kind at a time is the only way through a queue where 800 of 1015
          pending items are salary points. */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={type || ANY}
          onValueChange={(v) => void setType(v === ANY ? "" : v)}
        >
          <SelectTrigger size="sm" aria-label="Filter by kind" className="w-64">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All kinds</SelectItem>
            {Object.entries(subjectLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* `counts` is per status, not per kind, so the total is only true
            while no kind is selected — claiming "of 1014" under a filter that
            leaves 60 was worse than saying nothing. */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length} shown
          {!type && counts.data?.[status] ? ` of ${counts.data[status]}` : ""}
        </span>
      </div>

      {queue.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : queue.error ? (
        <p className="text-sm text-destructive">{queue.error.message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing {statusLabels[status].toLowerCase()}
          {tracks
            ? ` in your tracks (${tracks.join(", ") || "none granted yet"})`
            : ""}
          .
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Kind</TableHead>
                  <TableHead>What it says</TableHead>
                  <TableHead className="w-40">Submitted by</TableHead>
                  <TableHead className="w-24">Age</TableHead>
                  <TableHead className="w-24 text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="align-top font-medium">
                      {subjectLabels[it.subjectType]}
                      {it.track ? (
                        <Badge
                          variant="outline"
                          className="ml-2 align-middle text-xs capitalize"
                        >
                          {it.track}
                        </Badge>
                      ) : null}
                    </TableCell>
                    {/* The snapshot, finally on screen. Clamped rather than
                        truncated at a character count so a long review still
                        shows its first two lines. */}
                    {/* `whitespace-normal` because shadcn's TableCell sets `whitespace-nowrap`,
                        which silently defeats the line clamp and clips the text
                        to one row instead of wrapping it to two. */}
                    <TableCell className="max-w-xl align-top whitespace-normal text-muted-foreground">
                      <span className="line-clamp-2">
                        {itemSummary(it) || "—"}
                      </span>
                      {it.reason ? (
                        <span className="mt-1 block text-xs">
                          Reason: {it.reason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top text-muted-foreground">
                      {it.submitter?.name ?? "—"}
                    </TableCell>
                    <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                      {ago(it.createdAt)}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void setItem(it.id)}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {queue.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={queue.isFetchingNextPage}
              onClick={() => void queue.fetchNextPage()}
            >
              {queue.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
