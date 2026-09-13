import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * The card's typeface, read from the fonts vendored for the certificate PDF
 * (`packages/certificates/fonts`).
 *
 * **Geist, not Literata**, even though Literata is the display face everywhere
 * else: the vendored `Literata.ttf` is a variable font, and satori — which
 * renders `ImageResponse` — cannot read one. Handing it the variable file fails
 * deep inside the rasteriser with `Cannot read properties of undefined`, which
 * is worth knowing before somebody "fixes" this back to the brand font.
 *
 * It returns `undefined` rather than throwing if the file cannot be read. A
 * card in the fallback font is a cosmetic loss; a card that 500s is a blank
 * rectangle on every link anyone posts.
 */
function displayFont(): ArrayBuffer | undefined {
  for (const base of [process.cwd(), join(process.cwd(), "..", "..")]) {
    try {
      const buf = readFileSync(
        join(base, "packages", "certificates", "fonts", "Geist-SemiBold.ttf"),
      );
      return Uint8Array.from(buf).buffer;
    } catch {
      /* try the next base */
    }
  }
  return undefined;
}

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
  const font = displayFont();
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
        fontFamily: font ? "Geist" : "sans-serif",
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
    {
      ...OG_SIZE,
      ...(font
        ? {
            fonts: [{ name: "Literata", data: font, style: "normal" as const }],
          }
        : {}),
    },
  );
}
