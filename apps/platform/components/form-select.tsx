"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useId, useState } from "react";

/**
 * A shadcn/Radix select that still submits with `FormData`.
 *
 * Two things make a wrapper worth having rather than using `Select` directly at
 * each call site:
 *
 * - Radix rejects `""` as an item value, but several of these fields are
 *   optional and the server reads `""` as "not answered". The empty choice gets
 *   a sentinel for Radix and is written back as `""` through a hidden input, so
 *   what the form posts is byte-identical to the native `<select>` this replaced.
 * - A native `<select>`'s option list is drawn by the OS and does not inherit the
 *   page theme, so on a dark page it renders light text on a white popup. That
 *   was unreadable, and no styling of the `<select>` itself fixes it.
 */
const NONE = "__none";

export function FormSelect({
  name,
  options,
  defaultValue = "",
  required = false,
  emptyLabel,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  /** `[value, label]`, in the order they should appear. */
  options: readonly (readonly [string, string])[];
  defaultValue?: string;
  required?: boolean;
  /** The "no answer" choice. Omit on a required field. */
  emptyLabel?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const fallbackId = useId();
  return (
    <>
      <Select
        // `undefined` rather than the sentinel when there is no empty choice:
        // a value matching no item makes Radix render a blank trigger with no
        // placeholder either, which is how the badge picker on /admin/badges
        // became an empty stub.
        value={value || (emptyLabel ? NONE : undefined)}
        onValueChange={(next) => setValue(next === NONE ? "" : next)}
        required={required}
      >
        {/* The trigger is `w-fit` in the design system, which collapses to a
            chevron when nothing is selected. A form control should fill its
            field; call sites can still override. */}
        <SelectTrigger
          id={id ?? fallbackId}
          aria-label={ariaLabel}
          className={cn("w-full", className)}
        >
          <SelectValue placeholder={emptyLabel ?? "Choose one"} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel ? (
            <SelectItem value={NONE}>{emptyLabel}</SelectItem>
          ) : null}
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* What the form actually posts. Radix's own hidden control cannot carry
          the empty string, which is the whole reason for the sentinel above. */}
      <input type="hidden" name={name} value={value} />
    </>
  );
}
