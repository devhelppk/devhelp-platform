"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { ContributePanel } from "./contribute-panel";

/**
 * The dialog shell as well as the form, so both load on click.
 *
 * Keeping the shell in the page cost ~34 KB gzipped on a public page — Radix's
 * dialog and select are not free, and every reader paid for them to support a
 * control most never open. Mounted only while open, so `open` is always true.
 */
export function ContributeModal({
  slug,
  companyName,
  emailVerified,
  onClose,
}: {
  slug: string;
  companyName: string;
  emailVerified: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share your experience at {companyName}</DialogTitle>
          <DialogDescription>
            Your name is never shown next to anything you write. Reviews and
            interview experiences are read by an administrator before they
            appear; pay counts towards the aggregates at once and is never shown
            on its own.
          </DialogDescription>
        </DialogHeader>
        <ContributePanel
          slug={slug}
          companyName={companyName}
          emailVerified={emailVerified}
        />
      </DialogContent>
    </Dialog>
  );
}
