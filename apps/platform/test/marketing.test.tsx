import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/shell/site-footer";

// `SiteHeader` is not exercised here: it is an async server component whose
// module pulls in `shellSession` (auth) and `@repo/database`'s server-only env
// guard at import time, which throws under jsdom before the component ever
// runs. `SiteFooter` has no such dependency, so it carries this suite alone.

const EXPECTED_PATHS = [
  "/courses",
  "/companies",
  "/search",
  "/about",
  "/roadmap",
  "/contribute",
  "/faq",
  "/policy",
  "/privacy",
  "/terms",
];

describe("SiteFooter", () => {
  it("every internal link is a next/link (a relative href) and the expected paths are all present", () => {
    render(<SiteFooter />);
    const anchors = screen.getAllByRole("link");
    expect(anchors.length).toBeGreaterThan(0);

    const hrefs = anchors.map((a) => a.getAttribute("href") ?? "");
    for (const href of hrefs) {
      if (href.startsWith("http") || href.startsWith("mailto:")) continue;
      expect(href.startsWith("/")).toBe(true);
    }

    for (const path of EXPECTED_PATHS) {
      expect(hrefs).toContain(path);
    }
  });
});
