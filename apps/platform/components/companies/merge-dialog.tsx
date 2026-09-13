"use client";

import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Merge one company into another (F2.9).
 *
 * A dialog behind a row action rather than a form on the page: this is rare and
 * it cannot be undone through the API, which is exactly the shape the design
 * guideline reserves for a dialog. The company to merge into is an async
 * search, the same control as the learner picker, because an admin should not
 * have to go and find a slug.
 *
 * The confirmation is the losing company's name, typed. A merge in the wrong
 * direction moves every review about the surviving company onto the duplicate
 * and needs another merge to undo, so the cost of a mis-click is high enough
 * to be worth one deliberate act.
 */
export function MergeDialog({
  company,
  onDone,
}: {
  company: { slug: string; name: string };
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [into, setInto] = useState<{ slug: string; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function onType(next: string) {
    setTerm(next);
    clearTimeout((onType as { t?: ReturnType<typeof setTimeout> }).t);
    (onType as { t?: ReturnType<typeof setTimeout> }).t = setTimeout(
      () => setDebounced(next),
      250,
    );
  }

  // The admin list is already the search this page uses; no second endpoint.
  const results = useQuery({
    ...trpc.companies.adminList.queryOptions({
      q: debounced,
      status: "published",
      limit: 10,
    }),
    enabled: debounced.trim().length >= 2,
  });

  const merge = useMutation(
    trpc.companies.merge.mutationOptions({
      onSuccess: (r) => {
        setError(null);
        setResult(
          `Merged into ${r.into}. Moved ${r.moved.reviews.moved} reviews, ` +
            `${r.moved.interviews.moved} interviews, ${r.moved.salaries.moved} pay points` +
            (r.moved.reviews.left + r.moved.salaries.left > 0
              ? `; ${r.moved.reviews.left + r.moved.salaries.left} stayed behind because the same person had already written about the other company.`
              : "."),
        );
        void qc.invalidateQueries({
          queryKey: trpc.companies.adminList.queryKey(),
        });
      },
      onError: (e) => setError(e.message),
    }),
  );

  const ready =
    into && confirmName.trim().toLowerCase() === company.name.toLowerCase();

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onDone())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {company.name}</DialogTitle>
          <DialogDescription>
            Every review, interview experience, pay point, reply, claim and
            representative moves to the company you pick. {company.name} stays
            in the database as a merged record, so its old links redirect and
            its name still finds the surviving company.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <p className="text-sm">{result}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Merge into</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                  >
                    {into ? (
                      <span className="truncate">{into.name}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Search for the company to keep
                      </span>
                    )}
                    <ChevronsUpDown aria-hidden="true" className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-(--radix-popover-trigger-width) p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Company name…"
                      value={term}
                      onValueChange={onType}
                    />
                    <CommandList>
                      {debounced.trim().length < 2 ? (
                        <CommandEmpty>
                          Type at least two characters.
                        </CommandEmpty>
                      ) : results.isPending ? (
                        <CommandEmpty>Searching…</CommandEmpty>
                      ) : !results.data?.filter((c) => c.slug !== company.slug)
                          .length ? (
                        <CommandEmpty>No other company matches.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {results.data
                            .filter((c) => c.slug !== company.slug)
                            .map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.slug}
                                onSelect={() => {
                                  setInto({ slug: c.slug, name: c.name });
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  aria-hidden="true"
                                  className={
                                    into?.slug === c.slug
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate">{c.name}</span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {c.reviewCount ?? 0} reviews · {c.slug}
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-name">
                Type “{company.name}” to confirm
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onDone}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onDone}>
                Cancel
              </Button>
              <Button
                disabled={!ready || merge.isPending}
                onClick={() =>
                  into &&
                  merge.mutate({
                    from: company.slug,
                    into: into.slug,
                    confirmName,
                  })
                }
              >
                {merge.isPending ? "Merging…" : "Merge"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
