"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Search, X } from "lucide-react";
import { debounce, useQueryState } from "nuqs";
import { useTransition } from "react";
import { companyListParams } from "@/lib/search-params";

/**
 * Directory filters, applied as they change.
 *
 * Every control is `shallow: false`: the list is a server query, so each change
 * has to reach the server. That replaced an Apply button — a second deliberate
 * act between "I want fewer companies" and seeing them.
 *
 * The search box is the exception that makes this affordable: it is debounced,
 * so typing "arbisoft" is one server round trip rather than eight, and the URL
 * gets one history entry rather than a word's worth. Selects and the checkbox
 * are discrete, so they fire at once.
 */
export function DirectoryFilters(props: {
  cityNames: string[];
  industries: string[];
}) {
  return <Filters {...props} />;
}

function Filters({
  cityNames,
  industries,
}: {
  cityNames: string[];
  industries: string[];
}) {
  const [pending, start] = useTransition();
  const opts = { shallow: false, startTransition: start } as const;
  const [q, setQ] = useQueryState(
    "q",
    companyListParams.q.withOptions({
      ...opts,
      limitUrlUpdates: debounce(350),
    }),
  );
  const [city, setCity] = useQueryState(
    "city",
    companyListParams.city.withOptions(opts),
  );
  const [industry, setIndustry] = useQueryState(
    "industry",
    companyListParams.industry.withOptions(opts),
  );
  const [sort, setSort] = useQueryState(
    "sort",
    companyListParams.sort.withOptions(opts),
  );
  const [juniors, setJuniors] = useQueryState(
    "juniors",
    companyListParams.juniors.withOptions(opts),
  );

  const active = Boolean(q || city || industry || juniors || sort !== "name");
  const clear = () =>
    void Promise.all([
      setQ(null),
      setCity(null),
      setIndustry(null),
      setJuniors(null),
      setSort(null),
    ]);

  return (
    <div
      // `aria-busy` rather than a spinner: the list below is still readable
      // while the next one loads, and a filter row that flickers is worse than
      // one that waits.
      aria-busy={pending}
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor="q" className="text-xs font-medium">
          Search
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="q"
            type="search"
            defaultValue={q}
            onChange={(e) => void setQ(e.target.value)}
            placeholder="Name, technology, industry"
            className="pl-8"
          />
        </div>
      </div>
      <Select
        id="city"
        label="City"
        value={city}
        onChange={setCity}
        options={cityNames}
      />
      <Select
        id="industry"
        label="Industry"
        value={industry}
        onChange={setIndustry}
        options={industries}
      />
      <Select
        id="sort"
        label="Sort by"
        value={sort}
        onChange={(v) => void setSort(v as "name" | "rating" | "reviews")}
        options={["name", "rating", "reviews"]}
        allLabel={null}
      />
      <label className="flex items-center gap-2 text-sm sm:pb-2">
        <input
          type="checkbox"
          checked={juniors}
          onChange={(e) => void setJuniors(e.target.checked || null)}
          className="size-4 rounded border-input accent-brand-600"
        />
        Hires juniors
      </label>
      {active ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clear}
          aria-label="Clear filters"
          title="Clear filters"
          className="sm:mb-0.5"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel?: string | null;
}) {
  // shadcn/Radix rather than a native `<select>`: a native option list is drawn
  // by the OS and does not inherit the page's theme, so in dark mode it rendered
  // the theme's light foreground on the system's white popup.
  const ANY = "__any";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <UiSelect
        value={value || (allLabel ? ANY : value)}
        onValueChange={(v) => onChange(v === ANY ? "" : v)}
      >
        <SelectTrigger id={id} size="sm" className="capitalize">
          <SelectValue placeholder={allLabel ?? label} />
        </SelectTrigger>
        <SelectContent>
          {allLabel ? <SelectItem value={ANY}>{allLabel}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </UiSelect>
    </div>
  );
}
