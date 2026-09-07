import { describe, expect, it } from "vitest";
import { checkLogo, companyInitials, LOGO_MAX_BYTES } from "@/lib/logo";
import {
  ICON_TYPES,
  isIpLiteral,
  isPublicAddress,
  isSafeIconUrl,
  monogramSvg,
  pickIconUrl,
  walkRedirects,
} from "@/lib/favicon";

describe("checkLogo", () => {
  it("accepts the four image types an admin may upload", () => {
    for (const [type, ext] of [
      ["image/png", "png"],
      ["image/jpeg", "jpg"],
      ["image/webp", "webp"],
      ["image/svg+xml", "svg"],
    ] as const)
      expect(checkLogo({ type, size: 1024 })).toEqual({ ok: true, ext });
  });

  it("refuses anything else, by type", () => {
    for (const type of ["application/pdf", "image/gif", "text/html", ""]) {
      const r = checkLogo({ type, size: 1024 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/PNG, JPEG, WebP, or SVG/);
    }
  });

  it("refuses an empty file and one over the limit", () => {
    expect(checkLogo({ type: "image/png", size: 0 }).ok).toBe(false);
    const big = checkLogo({ type: "image/png", size: LOGO_MAX_BYTES + 1 });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toMatch(/256 KB/);
    expect(checkLogo({ type: "image/png", size: LOGO_MAX_BYTES }).ok).toBe(
      true,
    );
  });
});

describe("companyInitials", () => {
  it("takes up to two letters and ignores punctuation", () => {
    expect(companyInitials("Arbisoft")).toBe("A");
    expect(companyInitials("Systems Limited")).toBe("SL");
    expect(companyInitials("Ten Pearls Pvt Ltd")).toBe("TP");
    expect(companyInitials("10Pearls")).toBe("1");
    expect(companyInitials("  spaced   out  ")).toBe("SO");
  });

  it("never renders empty, whatever the name", () => {
    expect(companyInitials("!!!")).toBe("?");
    expect(companyInitials("")).toBe("?");
  });
});

describe("isSafeIconUrl", () => {
  it("allows a public http(s) site", () => {
    for (const u of [
      "https://arbisoft.com",
      "http://example.com/path",
      "https://sub.domain.co.uk/",
      "https://8.8.8.8/icon.png",
    ])
      expect(isSafeIconUrl(u)).toBe(true);
  });

  it("allows ordinary hostnames that merely start like an IPv6 range", () => {
    // `fc00::/7` and `fe80::/10` are IPv6 ranges. Matching those prefixes
    // against any hostname quietly denied every company whose domain begins
    // "fc" or "fd", and stamped them as checked for a month.
    for (const u of [
      "https://fdic.gov",
      "https://fcbarcelona.com",
      "https://fd-systems.pk",
      "https://fe80-design.com",
    ])
      expect(isSafeIconUrl(u)).toBe(true);
  });

  it("refuses anything that could reach our own network", () => {
    for (const u of [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/",
      "file:///etc/passwd",
      "gopher://example.com/",
      "not a url",
    ])
      expect(isSafeIconUrl(u)).toBe(false);
  });
});

describe("pickIconUrl", () => {
  const base = "https://example.com/about";
  it("prefers a declared icon and resolves it against the page", () => {
    const html = '<link rel="icon" href="/img/fav.png">';
    expect(pickIconUrl(html, base)).toBe("https://example.com/img/fav.png");
  });

  it("prefers the largest declared size", () => {
    const html = `
      <link rel="icon" sizes="16x16" href="/small.png">
      <link rel="icon" sizes="192x192" href="/big.png">`;
    expect(pickIconUrl(html, base)).toBe("https://example.com/big.png");
  });

  it("treats an apple-touch-icon as a large one", () => {
    const html = `
      <link rel="icon" href="/small.ico">
      <link rel="apple-touch-icon" href="/touch.png">`;
    expect(pickIconUrl(html, base)).toBe("https://example.com/touch.png");
  });

  it("falls back to the conventional path when nothing is declared", () => {
    expect(pickIconUrl("<html><head></head></html>", base)).toBe(
      "https://example.com/favicon.ico",
    );
  });

  it("keeps an absolute icon on another host", () => {
    const html = '<link rel="icon" href="https://cdn.example.net/i.png">';
    expect(pickIconUrl(html, base)).toBe("https://cdn.example.net/i.png");
  });
});

describe("monogramSvg", () => {
  it("renders the initials and is stable for a name", () => {
    const svg = monogramSvg("Systems Limited");
    expect(svg).toContain(">SL<");
    expect(svg).toBe(monogramSvg("Systems Limited"));
    expect(svg.startsWith("<svg")).toBe(true);
  });
});

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    for (const a of ["8.8.8.8", "1.1.1.1", "203.0.113.9", "2606:4700::1111"])
      expect(isPublicAddress(a)).toBe(true);
  });

  it("refuses every private, loopback, link-local, and multicast range", () => {
    for (const a of [
      "0.0.0.0",
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.5.5",
      "172.31.255.255",
      "192.168.0.1",
      "100.64.0.1",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not-an-address",
    ])
      expect(isPublicAddress(a)).toBe(false);
  });
});

describe("isIpLiteral", () => {
  it("tells an address from a name", () => {
    expect(isIpLiteral("8.8.8.8")).toBe(true);
    expect(isIpLiteral("fe80::1")).toBe(true);
    expect(isIpLiteral("example.com")).toBe(false);
    expect(isIpLiteral("fdic.gov")).toBe(false);
  });
});

describe("ICON_TYPES", () => {
  it("never stores an SVG fetched from someone else's site", () => {
    // Anything stored is served back from our origin, so a fetched SVG would
    // be a script running there for whoever opened the URL.
    expect(ICON_TYPES["image/svg+xml"]).toBeUndefined();
    expect(ICON_TYPES["image/png"]).toBe("png");
    expect(ICON_TYPES["image/x-icon"]).toBe("ico");
  });
});

describe("walkRedirects", () => {
  const publicDns = async () => ["93.184.216.34"];

  it("returns the final URL of an ordinary chain", async () => {
    const seen: string[] = [];
    const r = await walkRedirects("https://example.com/", {
      resolve: publicDns,
      request: async (url) => {
        seen.push(url);
        return url.endsWith("/final")
          ? { status: 200 }
          : { status: 302, location: "/final" };
      },
    });
    expect(r).toEqual({ url: "https://example.com/final", status: 200 });
    expect(seen).toHaveLength(2);
  });

  it("refuses a public URL that redirects to the metadata address", async () => {
    // The bypass this whole function exists for: checking only the URL we were
    // given never sees where it sends us.
    const requested: string[] = [];
    const r = await walkRedirects("https://attacker.example/", {
      resolve: publicDns,
      request: async (url) => {
        requested.push(url);
        return {
          status: 302,
          location: "http://169.254.169.254/latest/meta-data/",
        };
      },
    });
    expect(r).toBeNull();
    // It stopped before asking for the private address.
    expect(requested).toEqual(["https://attacker.example/"]);
  });

  it("refuses a public name that resolves to a private address", async () => {
    const r = await walkRedirects("https://internal.corp.example/", {
      resolve: async () => ["10.0.0.7"],
      request: async () => {
        throw new Error("must not be requested");
      },
    });
    expect(r).toBeNull();
  });

  it("refuses a name that resolves to a mix of public and private", async () => {
    const r = await walkRedirects("https://sneaky.example/", {
      resolve: async () => ["93.184.216.34", "127.0.0.1"],
      request: async () => {
        throw new Error("must not be requested");
      },
    });
    expect(r).toBeNull();
  });

  it("gives up on a redirect loop rather than following for ever", async () => {
    let calls = 0;
    const r = await walkRedirects("https://example.com/a", {
      resolve: publicDns,
      request: async () => {
        calls += 1;
        return { status: 302, location: "https://example.com/a" };
      },
    });
    expect(r).toBeNull();
    expect(calls).toBe(4);
  });

  it("refuses a redirect to a scheme that is not http", async () => {
    const r = await walkRedirects("https://example.com/", {
      resolve: publicDns,
      request: async () => ({ status: 302, location: "file:///etc/passwd" }),
    });
    expect(r).toBeNull();
  });
});
