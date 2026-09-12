"use client";

/**
 * A count-per-bin distribution as horizontal bars.
 *
 * One series, so no legend: the title names it. Every bin is directly labelled
 * because there are only a handful, which removes the need for a hover layer.
 * A single brand hue rather than a colour per bin — the bins are ordered levels
 * of one measure, not separate identities, so colouring them differently would
 * imply a distinction that is not there. Dark mode steps to its own value from
 * the same ramp rather than flipping.
 */
export function Distribution({
  title,
  caption,
  bins,
  onOpen,
  openLabel,
}: {
  title: string;
  caption?: string;
  bins: { label: string; value: number }[];
  onOpen?: () => void;
  openLabel?: string;
}) {
  const max = Math.max(1, ...bins.map((b) => b.value));
  const total = bins.reduce((n, b) => n + b.value, 0);
  return (
    <figure className="flex flex-col gap-3 rounded-lg border p-4">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {caption ? (
          <span className="text-xs text-muted-foreground">{caption}</span>
        ) : null}
      </figcaption>
      <div className="flex flex-col gap-1.5">
        {bins.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {b.label}
            </span>
            {/* The track is a real border colour so an empty bin still reads as
                a bin in both themes. */}
            <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-border/60">
              <span
                className="block h-full rounded-sm bg-brand-600 dark:bg-brand-400"
                style={{ width: `${(b.value / max) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums">
              {b.value}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Value</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>
                {b.value} of {total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {onOpen && openLabel ? (
        <button
          type="button"
          onClick={onOpen}
          className="self-start text-xs underline underline-offset-4 hover:no-underline"
        >
          {openLabel}
        </button>
      ) : null}
    </figure>
  );
}
