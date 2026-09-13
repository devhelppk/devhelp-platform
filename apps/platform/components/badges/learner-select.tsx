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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Find a learner by name or email.
 *
 * This replaced a text input whose placeholder read "uuid from the admin
 * certificates page" — it asked an administrator to visit another page, find a
 * row, copy a uuid and paste it here, with no feedback if they got it wrong.
 *
 * The search runs on the server (`badges.searchLearners`), so `Command`'s own
 * filtering is off: it would otherwise filter the ten rows the server already
 * chose and hide matches it never saw. Debounced, because this types one
 * character at a time into a query that reads the users table.
 *
 * The chosen id still reaches the form through a hidden input, so the surrounding
 * `FormData` submit is unchanged.
 */
export function LearnerSelect({ name }: { name: string }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  // A plain timer rather than a hook: one input, one query, no shared state.
  function onType(next: string) {
    setTerm(next);
    clearTimeout((onType as { t?: ReturnType<typeof setTimeout> }).t);
    (onType as { t?: ReturnType<typeof setTimeout> }).t = setTimeout(
      () => setDebounced(next),
      250,
    );
  }

  const results = useQuery({
    ...trpc.badges.searchLearners.queryOptions({ q: debounced }),
    enabled: debounced.trim().length >= 2,
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {picked ? (
              <span className="truncate">
                {picked.name}{" "}
                <span className="text-muted-foreground">({picked.email})</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Search by name or email
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
              placeholder="Name or email…"
              value={term}
              onValueChange={onType}
            />
            <CommandList>
              {debounced.trim().length < 2 ? (
                <CommandEmpty>Type at least two characters.</CommandEmpty>
              ) : results.isPending ? (
                <CommandEmpty>Searching…</CommandEmpty>
              ) : !results.data?.length ? (
                <CommandEmpty>Nobody matches that.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.data.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => {
                        setPicked(u);
                        setOpen(false);
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className={
                          picked?.id === u.id ? "opacity-100" : "opacity-0"
                        }
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{u.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {u.email}
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
      <input type="hidden" name={name} value={picked?.id ?? ""} />
    </>
  );
}
