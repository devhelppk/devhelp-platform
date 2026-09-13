import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MarkdownDoc, parseMarkdownDoc, readDoc } from "@/lib/markdown-doc";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What devhelp.pk stores, who processes it, and how to get it out or delete it.",
  alternates: { canonical: "/privacy" },
};

/** Rendered from a Markdown file in the public repository, so every edit is a diff. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <MarkdownDoc
          blocks={parseMarkdownDoc(readDoc("policy", "privacy.md"))}
        />
      </main>
      <SiteFooter />
    </>
  );
}
