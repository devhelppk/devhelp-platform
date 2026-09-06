"use client";

import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

/** Every company in the bank, pending ones first, each linking to its facts editor. */
export function AdminCompanies() {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
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
        <ul className="divide-y rounded-lg border">
          {list.data.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <Link
                href={`/admin/companies/${c.slug}` as Route}
                className="font-medium underline-offset-4 hover:underline"
              >
                {c.name}
              </Link>
              <span className="text-muted-foreground">{c.industry}</span>
              <span className="text-xs text-muted-foreground">
                {c.reviewCount ?? 0} reviews
              </span>
              <Badge
                variant={
                  c.status === "published"
                    ? "secondary"
                    : c.status === "pending"
                      ? "default"
                      : "outline"
                }
                className="ml-auto capitalize"
              >
                {c.status}
              </Badge>
              {c.verifiedAt ? (
                <span className="text-xs text-muted-foreground">
                  checked {c.verifiedAt.toLocaleDateString("en-GB")}
                </span>
              ) : (
                <span className="text-xs text-madder-600">unchecked</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
