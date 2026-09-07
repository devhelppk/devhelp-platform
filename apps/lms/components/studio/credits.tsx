"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

type Credit = { userId: string; name: string; role: "author" | "reviewer" };

/**
 * Who wrote and who reviewed. Credits are devhelp accounts (founder decision,
 * S11), so this searches people rather than accepting a typed name.
 */
export function Credits({
  subjectType,
  subjectId,
  credits,
}: {
  subjectType: "course" | "lesson";
  subjectId: string;
  credits: Credit[];
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [role, setRole] = useState<"author" | "reviewer">("author");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const people = useQuery({
    ...trpc.studio.findPeople.queryOptions({ q }),
    enabled: q.trim().length >= 2,
  });
  const save = useMutation(
    trpc.studio.setCredits.mutationOptions({
      onSuccess: () => {
        setError(null);
        setQ("");
        qc.invalidateQueries({ queryKey: trpc.studio.pathKey() });
        qc.invalidateQueries({ queryKey: trpc.contributors.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  const forRole = (r: "author" | "reviewer") =>
    credits.filter((c) => c.role === r);
  const set = (r: "author" | "reviewer", userIds: string[]) =>
    save.mutate({ subjectType, subjectId, role: r, userIds });

  return (
    <div className="flex flex-col gap-4">
      {(["author", "reviewer"] as const).map((r) => (
        <div key={r} className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-sm text-muted-foreground capitalize">
            {r}s
          </span>
          {forRole(r).length === 0 ? (
            <span className="text-sm text-muted-foreground">Nobody yet</span>
          ) : (
            forRole(r).map((c) => (
              <Badge key={c.userId} variant="secondary" className="gap-1">
                {c.name}
                <button
                  type="button"
                  aria-label={`Remove ${c.name} as ${r}`}
                  // Disabled while a change is in flight: this list comes from
                  // the last fetch, so two quick removals would send a stale
                  // set and put the first person back.
                  disabled={save.isPending}
                  className="ml-1 rounded-sm px-1 hover:bg-background/60 disabled:opacity-50"
                  onClick={() =>
                    set(
                      r,
                      forRole(r)
                        .filter((x) => x.userId !== c.userId)
                        .map((x) => x.userId),
                    )
                  }
                >
                  ×
                </button>
              </Badge>
            ))
          )}
        </div>
      ))}

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="credit-role" className="text-xs font-medium">
              Credit as
            </label>
            <select
              id="credit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "author")}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="author">Author</option>
              <option value="reviewer">Reviewer</option>
            </select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor="credit-search" className="text-xs font-medium">
              Find someone
            </label>
            <Input
              id="credit-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or handle"
            />
          </div>
        </div>
        {q.trim().length >= 2 ? (
          people.isPending ? (
            <p className="text-xs text-muted-foreground">Searching…</p>
          ) : people.data?.length ? (
            <ul className="flex flex-wrap gap-2">
              {people.data.map((p) => (
                <li key={p.id}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      set(role, [...forRole(role).map((c) => c.userId), p.id])
                    }
                  >
                    {p.name}
                    {p.handle ? ` (@${p.handle})` : ""}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nobody matches. A credit has to be a devhelp account.
            </p>
          )
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
