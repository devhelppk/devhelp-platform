import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownDoc, parseMarkdownDoc } from "./markdown-doc";

describe("parseMarkdownDoc", () => {
  it("reads the block kinds our documents use", () => {
    expect(
      parseMarkdownDoc(
        [
          "# Content policy",
          "",
          "Last updated: today.",
          "",
          "## c1. Do not name individuals",
          "",
          "### A sub-point",
          "",
          "- First",
          "- Second",
          "",
          "---",
          "",
          "Closing line.",
        ].join("\n"),
      ),
    ).toEqual([
      { type: "h1", text: "Content policy" },
      { type: "p", text: "Last updated: today." },
      { type: "h2", id: "c1", text: "c1. Do not name individuals" },
      { type: "h3", id: "a-sub-point", text: "A sub-point" },
      { type: "ul", items: ["First", "Second"] },
      { type: "p", text: "Closing line." },
    ]);
  });

  it("anchors a clause heading on its clause number, and slugifies the rest", () => {
    const [clause, prose] = parseMarkdownDoc(
      "## c12. Something\n\n## What we store, and why\n",
    );
    expect(clause).toMatchObject({ id: "c12" });
    // A moderator's rejection quotes `c12`, and `/policy#c12` has to land.
    expect(prose).toMatchObject({ id: "what-we-store-and-why" });
  });
});

describe("MarkdownDoc", () => {
  it("renders bold text as bold and not as asterisks", () => {
    // The regression this module exists for: the policy page's private parser
    // had no bold, so S20's edit put literal `**` in front of the public.
    render(
      <MarkdownDoc
        blocks={parseMarkdownDoc("**Who can read what people wrote.** Facts.")}
      />,
    );
    expect(screen.getByText("Who can read what people wrote.").tagName).toBe(
      "STRONG",
    );
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("links an email address and a Markdown link", () => {
    render(
      <MarkdownDoc
        blocks={parseMarkdownDoc(
          "Write to policy@devhelp.pk or read the [content policy](/policy).",
        )}
      />,
    );
    expect(
      screen.getByRole("link", { name: "policy@devhelp.pk" }),
    ).toHaveAttribute("href", "mailto:policy@devhelp.pk");
    expect(
      screen.getByRole("link", { name: "content policy" }),
    ).toHaveAttribute("href", "/policy");
  });

  it("opens an external link in a new tab and keeps an internal one in place", () => {
    render(
      <MarkdownDoc
        blocks={parseMarkdownDoc(
          "See [the repo](https://github.com/devhelppk) and [about](/about).",
        )}
      />,
    );
    expect(screen.getByRole("link", { name: "the repo" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "about" })).not.toHaveAttribute(
      "target",
    );
  });

  it("renders inline code without its backticks", () => {
    render(<MarkdownDoc blocks={parseMarkdownDoc("Run `pnpm dev` first.")} />);
    expect(screen.getByText("pnpm dev").tagName).toBe("CODE");
  });

  it("keeps a list item's inline formatting", () => {
    render(
      <MarkdownDoc
        blocks={parseMarkdownDoc("- **Code** is MIT, content is CC BY-SA.")}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Code is MIT, content is CC BY-SA.",
    );
    expect(screen.getByText("Code").tagName).toBe("STRONG");
  });
});
