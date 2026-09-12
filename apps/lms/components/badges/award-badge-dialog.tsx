"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormSelect } from "@/components/form-select";
import { useTRPC } from "@/lib/trpc/client";
import { LearnerSelect } from "./learner-select";

/**
 * Awarding by hand, behind a button in the page header.
 *
 * Its own component so the page can hand it to `PageHeader`'s `actions` slot:
 * a primary action belongs on the title row, not stacked under it while the
 * right half of the header sits empty (`DESIGN.md`, "Page header").
 */
export function AwardBadgeDialog() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const catalogue = useQuery(trpc.badges.catalogue.queryOptions());
  const award = useMutation(
    trpc.badges.award.mutationOptions({
      onSuccess: () => {
        setNote(null);
        setOpen(false);
        void qc.invalidateQueries({ queryKey: trpc.badges.pathKey() });
      },
      onError: (e) => setNote(e.message),
    }),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote(null);
    const f = new FormData(e.currentTarget);
    award.mutate({
      userId: String(f.get("userId") ?? ""),
      badgeSlug: String(f.get("badgeSlug") ?? ""),
      reason: String(f.get("reason") ?? ""),
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" />
          Award a badge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Award a badge by hand</DialogTitle>
          <DialogDescription>
            Badges award themselves from the event stream. Do this only when
            something went wrong; the reason is kept on the award and shown in
            the list.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            Learner
            <LearnerSelect name="userId" />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Badge
            <FormSelect
              name="badgeSlug"
              required
              aria-label="Badge"
              options={(catalogue.data ?? []).map(
                (b) => [b.slug, b.name] as const,
              )}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Reason (recorded on the award)
            <Textarea name="reason" required minLength={5} maxLength={500} />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={award.isPending}>
              {award.isPending ? "Awarding…" : "Award"}
            </Button>
            {note ? (
              <span role="status" className="text-sm text-destructive">
                {note}
              </span>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
