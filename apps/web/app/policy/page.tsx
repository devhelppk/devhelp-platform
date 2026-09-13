import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MarkdownDoc, parseMarkdownDoc, readDoc } from "@/lib/markdown-doc";

/**
 * Rendered once, at build. The document is read from `docs/` with `node:fs`,
 * and a Cloudflare Worker has no filesystem at request time (S22) — so this
 * page must never be dynamic, or it would fail on the first visitor.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Content policy",
  description:
    "What may be published on devhelp.pk, how moderation works, and how to request a takedown.",
  alternates: { canonical: "/policy" },
};

/**
 * The content policy, rendered from `docs/policy/content-policy.md`.
 *
 * One source: moderators quote clause numbers (`c1`…) in rejections, and those
 * anchor into this page, so the page and the document a moderator reads cannot
 * be allowed to drift apart.
 */
export default function PolicyPage() {
  const blocks = parseMarkdownDoc(readDoc("policy", "content-policy.md"));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <MarkdownDoc blocks={blocks} />
      </main>
      <SiteFooter />
    </>
  );
}
