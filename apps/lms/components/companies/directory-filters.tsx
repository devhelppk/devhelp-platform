"use client";

import { Input } from "@repo/ui/components/input";
import { debounce, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
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
  return (
    <NuqsAdapter>
      <Filters {...props} />
    </NuqsAdapter>
  );
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
        <Input
          id="q"
          type="search"
          defaultValue={q}
          onChange={(e) => void setQ(e.target.value)}
          placeholder="Name, technology, industry"
        />
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
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border bg-transparent px-2 text-sm capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
