/** Same-origin path or `/home` (the dashboard): rejects absolute and protocol-relative URLs (open redirect). */
export function safePath(
  value: string | null | undefined,
  fallback = "/home",
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
