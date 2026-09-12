"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { MergeDialog } from "./merge-dialog";

/**
 * Every company in the bank, pending ones first.
 *
 * A table rather than a list of sentences: these are records an admin scans and
 * acts on, and the counts are the whole reason to act — a duplicate with four
 * reviews is worth merging, one with none is worth hiding. Editing the facts
 * and merging a duplicate are row actions, because both are about one row.
 */
export function AdminCompanies() {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
  const [merging, setMerging] = useState<{ slug: string; name: string } | null>(
    null,
  );
  const list = useQuery(
    trpc.companies.adminList.queryOptions({ q: q || undefined }),
  );
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name"
        aria-label="Search companies"
        className="max-w-sm"
      />
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{list.error.message}</p>
      ) : list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companies match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead className="text-right">Reviews</TableHead>
                <TableHead className="text-right">Interviews</TableHead>
                <TableHead>Facts</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/companies/${c.slug}` as Route}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === "published"
                          ? "secondary"
                          : c.status === "pending"
                            ? "default"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.industry ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.reviewCount ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.interviewCount ?? 0}
                  </TableCell>
                  <TableCell>
                    {c.verifiedAt ? (
                      <span className="text-xs text-muted-foreground">
                        checked {c.verifiedAt.toLocaleDateString("en-GB")}
                      </span>
                    ) : (
                      <span className="text-xs text-madder-600">unchecked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontal aria-hidden="true" />
                          <span className="sr-only">Actions for {c.name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/companies/${c.slug}` as Route}>
                            Edit facts
                          </Link>
                        </DropdownMenuItem>
                        {/* A company that has already been merged away has
                            nothing left to move. */}
                        {c.status === "merged" ? null : (
                          <DropdownMenuItem
                            // Deferred to the next tick on purpose: Radix
                            // closes the menu after `onSelect` and returns
                            // focus to the trigger, which closes a dialog
                            // opened synchronously in the same tick. The menu
                            // finishes unmounting, then the dialog mounts.
                            onSelect={() =>
                              setTimeout(
                                () =>
                                  setMerging({ slug: c.slug, name: c.name }),
                                0,
                              )
                            }
                          >
                            Merge into…
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {merging ? (
        <MergeDialog company={merging} onDone={() => setMerging(null)} />
      ) : null}
    </div>
  );
}
