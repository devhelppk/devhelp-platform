/**
 * What an admin may upload as a company logo (S10c). Its own module rather
 * than living inside the server action, because a `"use server"` file may only
 * export async functions and this is worth testing directly.
 */
export const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
export const LOGO_MAX_BYTES = 256 * 1024;

export type LogoCheck =
  { ok: true; ext: string } | { ok: false; error: string };

/** No resizing or conversion: a sensible image fits, or it is refused. */
export function checkLogo(file: { type: string; size: number }): LogoCheck {
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPEG, WebP, or SVG image." };
  if (file.size === 0) return { ok: false, error: "Choose an image first." };
  if (file.size > LOGO_MAX_BYTES)
    return {
      ok: false,
      error: `That file is ${Math.round(file.size / 1024)} KB; the limit is 256 KB.`,
    };
  return { ok: true, ext };
}

/** Up to two initials, for companies with no logo. */
export function companyInitials(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}
