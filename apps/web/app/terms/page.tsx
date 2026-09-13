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
  title: "Terms of use",
  description:
    "The terms for using devhelp.pk: what is free, how the content is licensed, and what you agree to when you contribute.",
  alternates: { canonical: "/terms" },
};

/** Rendered from a Markdown file in the public repository, so every edit is a diff. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <MarkdownDoc blocks={parseMarkdownDoc(readDoc("policy", "terms.md"))} />
      </main>
      <SiteFooter />
    </>
  );
}
