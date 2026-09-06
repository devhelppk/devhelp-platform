import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Content policy",
  description:
    "What may be published on devhelp.pk, how moderation works, and how to request a takedown.",
};

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

/** The policy is one Markdown file in the repo (docs/policy/content-policy.md); this parses the subset it uses. */
function parsePolicy(md: string): Block[] {
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
    if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: line.slice(2) });
    } else if (line.startsWith("## ")) {
      flush();
      const text = line.slice(3);
      const m = /^(c\d+)\./.exec(text);
      blocks.push({
        type: "h2",
        id: m ? m[1]! : text.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        text,
      });
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

function findPolicy(): string {
  // The docs folder sits at the repo root; the app runs from apps/web.
  for (const dir of [process.cwd(), join(process.cwd(), "..", "..")]) {
    try {
      return readFileSync(
        join(dir, "docs", "policy", "content-policy.md"),
        "utf8",
      );
    } catch {
      /* try the next base */
    }
  }
  throw new Error("docs/policy/content-policy.md not found");
}

function withMailLinks(text: string) {
  const parts = text.split(/(policy@devhelp\.pk)/);
  return parts.map((p, i) =>
    p === "policy@devhelp.pk" ? (
      <a
        key={i}
        href="mailto:policy@devhelp.pk"
        className="underline underline-offset-4"
      >
        {p}
      </a>
    ) : (
      p
    ),
  );
}

export default function PolicyPage() {
  const blocks = parsePolicy(findPolicy());
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
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
                    <a
                      href={`#${b.id}`}
                      className="no-underline hover:underline"
                    >
                      {b.text}
                    </a>
                  </h2>
                );
              case "ul":
                return (
                  <ul key={i}>
                    {b.items.map((it) => (
                      <li key={it}>{withMailLinks(it)}</li>
                    ))}
                  </ul>
                );
              default:
                return <p key={i}>{withMailLinks(b.text)}</p>;
            }
          })}
        </article>
      </main>
    </>
  );
}
