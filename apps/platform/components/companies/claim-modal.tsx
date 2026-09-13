"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { ClaimPanel } from "./claim-panel";

/** Shell and form together, loaded on click. See `contribute-modal.tsx`. */
export function ClaimModal({
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim {companyName}</DialogTitle>
          <DialogDescription>
            An administrator checks the claim before it is approved. Approval
            makes you a member of the organisation, which is what lets you reply
            publicly to reviews and interviews.
          </DialogDescription>
        </DialogHeader>
        <ClaimPanel
          slug={slug}
          companyName={companyName}
          emailVerified={emailVerified}
        />
      </DialogContent>
    </Dialog>
  );
}
