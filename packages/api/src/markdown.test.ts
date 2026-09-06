import { describe, expect, it } from "vitest";
import { hasLink, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders the subset and strips everything else", () => {
    const html = renderMarkdown(
      "**bold** and `code`\n\n```ts\nconst a = 1;\n```\n\n<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[safe](https://example.com) [bad](javascript:alert(1))",
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="nofollow ugc noopener"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("javascript:");
  });
  it("detects links for the new-account hold", () => {
    expect(hasLink("see https://x.y")).toBe(true);
    expect(hasLink("see [this](http://x.y)")).toBe(true);
    expect(hasLink("visit www.example.com")).toBe(true);
    expect(hasLink("no links here, just `code`")).toBe(false);
  });
});
