"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";

const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

/**
 * The facts an admin owns. Contributions are decided in the moderation queue,
 * never here, so there is no way to edit somebody else's words on this page.
 */
export function AdminCompanyForm({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const company = useQuery(trpc.companies.adminGet.queryOptions({ slug }));
  const save = useMutation(
    trpc.companies.adminUpdate.mutationOptions({
      onSuccess: () => {
        setError(null);
        setSaved(true);
        qc.invalidateQueries({ queryKey: trpc.companies.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (company.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (company.error)
    return <p className="text-sm text-destructive">{company.error.message}</p>;
  const c = company.data;
  const p = c.profile;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const list = (k: string) =>
      str(k)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    save.mutate({
      slug,
      name: str("name"),
      website: str("website") || null,
      description: str("description") || null,
      industry: str("industry") || null,
      size: (str("size") || null) as null,
      cities: list("cities"),
      founded: str("founded") ? Number(str("founded")) : null,
      stack: list("stack"),
      hiresJuniors:
        str("hiresJuniors") === "" ? null : str("hiresJuniors") === "yes",
      careersUrl: str("careersUrl") || null,
      linkedin: str("linkedin") || null,
      sources: list("sources"),
      status: (str("status") || "pending") as "pending",
      aliases: list("aliases"),
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="name" label="Name" defaultValue={c.name} required />
        <Text name="website" label="Website" defaultValue={c.website ?? ""} />
        <Text
          name="industry"
          label="Industry"
          defaultValue={p.industry ?? ""}
        />
        <Choice
          name="size"
          label="Size"
          defaultValue={p.size ?? ""}
          options={SIZES.map((s) => [s, s])}
        />
        <Text
          name="founded"
          label="Founded"
          type="number"
          defaultValue={p.founded ? String(p.founded) : ""}
        />
        <Choice
          name="hiresJuniors"
          label="Hires juniors"
          defaultValue={
            p.hiresJuniors === null ? "" : p.hiresJuniors ? "yes" : "no"
          }
          options={[
            ["yes", "Yes"],
            ["no", "Not usually"],
          ]}
        />
        <Text
          name="cities"
          label="Cities (comma separated)"
          defaultValue={p.cities.join(", ")}
        />
        <Text
          name="stack"
          label="Stack (comma separated)"
          defaultValue={p.stack.join(", ")}
        />
        <Text
          name="careersUrl"
          label="Careers page"
          defaultValue={p.careersUrl ?? ""}
        />
        <Text
          name="linkedin"
          label="LinkedIn"
          defaultValue={p.linkedin ?? ""}
        />
        <Text
          name="aliases"
          label="Also known as (comma separated)"
          defaultValue={c.aliases.join(", ")}
        />
        <Choice
          name="status"
          label="Status"
          defaultValue={p.status}
          options={[
            ["pending", "Pending"],
            ["published", "Published"],
            ["hidden", "Hidden"],
          ]}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={p.description ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sources">Sources (comma separated URLs)</Label>
        <Textarea
          id="sources"
          name="sources"
          rows={2}
          defaultValue={p.sources.join(", ")}
        />
        <p className="text-xs text-muted-foreground">
          Where these facts came from. Saving records you as having checked
          them.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      <Button type="submit" disabled={save.isPending} className="self-start">
        {save.isPending ? "Saving…" : "Save facts"}
      </Button>
    </form>
  );
}

function Text({
  name,
  label,
  defaultValue,
  type,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}

function Choice({
  name,
  label,
  defaultValue,
  options,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: [string, string][];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {required ? null : <option value="">Unknown</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
