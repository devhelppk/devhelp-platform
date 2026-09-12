"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { parseAsString, useQueryState } from "nuqs";
import { ModerationItem } from "./item";

/**
 * One dialog for the whole queue, opened by `?item=<id>`.
 *
 * A decision used to mean leaving the queue for `/moderate/<id>` and coming
 * back, which loses your place in a list of a thousand and makes "next one"
 * two navigations. One shared dialog on the queue keeps the list behind it.
 *
 * The id is `shallow: false`, so the server re-renders for it: the URL is a
 * real state that survives a refresh and can be handed to another moderator,
 * rather than something only this browser knows. `/moderate/<id>` still works
 * as a page for exactly that reason — a direct link, or no JavaScript.
 *
 * The detail itself stays inside `ModerationItem`, which already fetches by id
 * and owns the `decide` mutation and its cache invalidation; wrapping it rather
 * than reimplementing it means the queue behind the dialog refreshes on a
 * decision without any new plumbing.
 */
export function ModerationItemDialog({
  isAdmin,
  policyUrl,
}: {
  isAdmin: boolean;
  policyUrl: string;
}) {
  const [item, setItem] = useQueryState(
    "item",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );
  return (
    <Dialog
      open={Boolean(item)}
      // `null` clears the key rather than leaving `?item=` behind.
      onOpenChange={(next) => void setItem(next ? item : null)}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review submission</DialogTitle>
          <DialogDescription>
            Every decision is logged with your name and, for a rejection, the
            policy clause you chose.
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <ModerationItem id={item} isAdmin={isAdmin} policyUrl={policyUrl} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
