/**
 * A company's mark. Always an image: the route behind it falls back from an
 * uploaded logo to the site's own icon to a generated monogram, so there is no
 * "has a logo" state to thread through the pages and no broken image to guard
 * against. `alt` is empty on purpose: the company's name always sits beside it,
 * so announcing the mark as well would just repeat it.
 */
export function CompanyMark({
  id,
  version,
  size = 40,
}: {
  id: string;
  /** Cache buster: the URL is stable, so without it a replaced logo lingers. */
  version?: Date | number | null;
  size?: number;
}) {
  const v = version
    ? `?v=${version instanceof Date ? version.getTime() : version}`
    : "";
  return (
    // Not next/image: the bytes come from our own route, already sized, and
    // the fallback is an SVG generated per request.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/company-logos/${id}${v}`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md border bg-muted object-contain"
      loading="lazy"
    />
  );
}
