import type { Metadata } from "next";
import { MarkdownDoc, parseMarkdownDoc, readDoc } from "@/lib/markdown-doc";

/**
 * Rendered once, at build. The document is read from `docs/` with `node:fs`,
 * and a Cloudflare Worker has no filesystem at request time (S22) — so this
 * page must never be dynamic, or it would fail on the first visitor.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What works on devhelp today, what is being built next, and what has been deliberately deferred.",
  alternates: { canonical: "/roadmap" },
};

/** Rendered from a Markdown file in the public repository, so every edit is a diff. */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <MarkdownDoc blocks={parseMarkdownDoc(readDoc("roadmap.md"))} />
    </main>
  );
}
