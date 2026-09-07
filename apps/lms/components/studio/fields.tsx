"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

/** The small form pieces the studio reuses. Plain inputs; the forms are short. */
export function Text({
  name,
  label,
  defaultValue,
  hint,
  type,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Area({
  name,
  label,
  defaultValue,
  hint,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={rows} defaultValue={defaultValue} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Choice({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-brand-600"
      />
      {label}
    </label>
  );
}

/** Who changed what, most recent first. */
export function EditTrail({
  edits,
}: {
  edits: {
    id: string;
    changes: { field: string; before: string | null; after: string | null }[];
    createdAt: Date;
    actorName: string | null;
  }[];
}) {
  if (!edits.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been changed here yet.
      </p>
    );
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {edits.map((e) => (
        <li key={e.id} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {e.actorName ?? "Someone"} ·{" "}
            {e.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <ul className="flex flex-col gap-0.5">
            {e.changes.map((c, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{c.field}</span>{" "}
                <span className="text-muted-foreground line-through">
                  {c.before ?? "empty"}
                </span>{" "}
                → <span>{c.after ?? "empty"}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function SaveRow({
  pending,
  error,
  saved,
  label = "Save",
}: {
  pending: boolean;
  error: string | null;
  saved: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved && !error ? (
        <p className="text-sm text-muted-foreground">Saved.</p>
      ) : null}
    </div>
  );
}
