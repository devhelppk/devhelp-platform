/** Same-origin path or "/": rejects absolute and protocol-relative URLs (open redirect). */
export function safePath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return fallback;
  return value;
}
