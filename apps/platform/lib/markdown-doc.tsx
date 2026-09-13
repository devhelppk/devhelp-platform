import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * The Markdown subset our own documents use, rendered as a page.
 *
 * `/policy`, `/roadmap`, `/privacy` and `/terms` are Markdown files in `docs/`,
 * so the copy can be edited — and reviewed in a diff — without touching TSX.
 * This is deliberately not a Markdown library: the input is documents we write,
 * the output is one article, and `marked` + `sanitize-html` already live in
 * `@repo/api` for the untrusted case (learner comments), which is a different
 * problem with a different threat model.
 *
 * It began as a private parser inside `/policy` handling h1, h2, p and ul. It
 * did not handle `**bold**`, which S20 then used in the content policy — so the
 * live page rendered literal asterisks to the public. Hence the tests.
 */

export type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

/** `## c1. Do not name individuals` anchors as `c1`; anything else slugifies. */
function headingId(text: string) {
  const clause = /^(c\d+)\./.exec(text);
  if (clause) return clause[1]!;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseMarkdownDoc(md: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    // A horizontal rule is a document-structure marker, not content; the pages
    // that use one are already broken into sections by their headings.
    if (/^-{3,}$/.test(line)) {
      flush();
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: line.slice(2) });
    } else if (line.startsWith("## ")) {
      flush();
      const text = line.slice(3);
      blocks.push({ type: "h2", id: headingId(text), text });
    } else if (line.startsWith("### ")) {
      flush();
      const text = line.slice(4);
      blocks.push({ type: "h3", id: headingId(text), text });
    } else if (line.startsWith("- ")) {
      (list ??= []).push(line.slice(2));
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  }
  flush();
  return blocks;
}

/**
 * Inline `**bold**`, `[text](url)`, `` `code` `` and bare email addresses.
 *
 * One pass over a split on every pattern at once, so a link inside bold text
 * cannot be half-matched by two independent passes. Emails become `mailto:`
 * links because every one of these documents ends in "write to us".
 */
const INLINE =
  /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|`[^`]+`|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;

export function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link)
      return (
        <a
          key={i}
          href={link[2]!}
          className="underline underline-offset-4"
          {...(link[2]!.startsWith("http")
            ? { rel: "noopener", target: "_blank" }
            : {})}
        >
          {link[1]}
        </a>
      );
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(part))
      return (
        <a
          key={i}
          href={`mailto:${part}`}
          className="underline underline-offset-4"
        >
          {part}
        </a>
      );
    return part;
  });
}

/**
 * Read a document from the repo's `docs/` folder.
 *
 * The app runs from `apps/platform`, and `next build` and `next start` do not agree
 * on the working directory, so both bases are tried — the same approach the
 * policy page took, kept because it is the thing that actually works.
 */
export function readDoc(...segments: string[]): string {
  const tried: string[] = [];
  for (const base of [process.cwd(), join(process.cwd(), "..", "..")]) {
    const path = join(base, "docs", ...segments);
    tried.push(path);
    try {
      return readFileSync(path, "utf8");
    } catch {
      /* try the next base */
    }
  }
  throw new Error(`Document not found. Tried: ${tried.join(", ")}`);
}

/** The whole document as one `prose-lesson` article. */
export function MarkdownDoc({ blocks }: { blocks: Block[] }) {
  return (
    <article className="prose-lesson">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h1":
            return (
              <h1
                key={i}
                className="font-display text-4xl font-semibold tracking-tight"
              >
                {b.text}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={i}
                id={b.id}
                className="mt-10 scroll-mt-24 font-display text-2xl font-semibold"
              >
                {/* Self-linking, because a moderator quoting clause c3 needs a
                    URL that lands on c3. */}
                <a href={`#${b.id}`} className="no-underline hover:underline">
                  {b.text}
                </a>
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={b.id} className="scroll-mt-24">
                {b.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it) => (
                  <li key={it}>{inline(it)}</li>
                ))}
              </ul>
            );
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </article>
  );
}
