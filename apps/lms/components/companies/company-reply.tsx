import { Badge } from "@repo/ui/components/badge";

/**
 * A company's public answer to a review or an interview experience (S13).
 * Marked plainly as coming from the company, because the person it answers is
 * anonymous and the asymmetry should be visible rather than hidden.
 *
 * `bodyHtml` was rendered and sanitised on the server when it was written, the
 * same as every other piece of prose on the platform.
 */
export function CompanyReply({
  reply,
  companyName,
}: {
  reply?: { bodyHtml: string; createdAt: Date } | undefined;
  companyName: string;
}) {
  if (!reply) return null;
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-md border-l-2 border-brand-600 bg-muted/40 p-3 dark:border-brand-400">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Reply from {companyName}</span>
        <Badge variant="outline" className="text-xs">
          Verified representative
        </Badge>
      </div>
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        // Rendered and sanitised at write time by `renderMarkdown`; the raw
        // Markdown is never rendered on the client (S6).
        dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
      />
    </div>
  );
}
