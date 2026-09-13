import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * One card shape for every Open Graph image in the project: the wordmark, a
 * headline, and a line of context on the brand's own surface colours (which are
 * written as literals here because an `ImageResponse` is rendered by satori and
 * never sees our stylesheet or its tokens).
 */
export function ogCard({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0b0b0d",
        color: "#fafafa",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#a01a35",
          }}
        />
        {/* Two spans in an explicit flex row, not a text node with a span
            inside it: satori refuses a div with more than one child unless the
            display is stated, and it fails at render rather than at build. */}
        <div style={{ display: "flex", fontSize: 34, letterSpacing: -0.5 }}>
          <span>devhelp</span>
          <span style={{ color: "#a1a1aa" }}>.pk</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 24,
            color: "#a5a3f0",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 66, lineHeight: 1.1, letterSpacing: -1.5 }}>
          {title}
        </div>
        {detail ? (
          <div style={{ fontSize: 28, color: "#a1a1aa" }}>{detail}</div>
        ) : null}
      </div>
      <div style={{ fontSize: 24, color: "#a1a1aa" }}>
        Free and open source · Made in Pakistan
      </div>
    </div>,
    // No `fonts`: next/og bundles Geist as its default face, so the card needs
    // no filesystem read. That matters on a Cloudflare Worker, which has no
    // filesystem at request time — an earlier version read a TTF from
    // packages/certificates/fonts and would have failed on the first share
    // (S22). (The vendored Literata could never work here anyway: it is a
    // variable font, which satori cannot read.)
    OG_SIZE,
  );
}
