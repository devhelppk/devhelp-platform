"use client";

import { Button } from "@repo/ui/components/button";
import { Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";

/** Verify link copy, PDF download, and the LinkedIn "Add to profile" link. Client-only for the clipboard. */
export function CertificateActions({
  id,
  courseTitle,
  issuedAt,
  lmsUrl,
}: {
  id: string;
  courseTitle: string;
  issuedAt: string;
  lmsUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const verifyUrl = `${lmsUrl}/verify/${id}`;
  const d = new Date(issuedAt);
  const linkedin = new URL("https://www.linkedin.com/profile/add");
  linkedin.searchParams.set("startTask", "CERTIFICATION_NAME");
  linkedin.searchParams.set("name", `${courseTitle} (devhelp.pk)`);
  linkedin.searchParams.set("organizationName", "devhelp.pk");
  linkedin.searchParams.set("issueYear", String(d.getFullYear()));
  linkedin.searchParams.set("issueMonth", String(d.getMonth() + 1));
  linkedin.searchParams.set("certUrl", verifyUrl);
  linkedin.searchParams.set("certId", id);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={`${lmsUrl}/api/certificates/${id}.pdf`}>
          <Download aria-hidden="true" /> PDF
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(verifyUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy verify link"}
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <a href={linkedin.toString()} target="_blank" rel="noreferrer noopener">
          <ExternalLink aria-hidden="true" /> Add to LinkedIn
        </a>
      </Button>
    </div>
  );
}
