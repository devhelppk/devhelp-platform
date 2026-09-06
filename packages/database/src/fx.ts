import { and, desc, eq } from "drizzle-orm";
import { db as defaultDb, schema } from "./index";

/**
 * USD to PKR for the salary bank (S10b). The platform never calls an exchange
 * rate API on a request path: this script writes one row a day (`pnpm
 * fx:refresh`, a daily cron in production) and everything else reads the
 * table. When the table is empty the UI simply does not offer a converted
 * figure, which is the right failure: a salary in the currency it was earned
 * in is still the truth.
 */
const DEFAULT_SOURCE = "https://open.er-api.com/v6/latest/USD";

/**
 * How old a rate may be before we stop showing conversions. If the daily
 * refresh stops, a months-old rate presented beside today's salaries is worse
 * than no conversion at all: the figure in the currency it was earned in is
 * still the truth, and the converted one would quietly drift away from it.
 */
export const MAX_RATE_AGE_DAYS = 14;

/** The most recent usable rate, or null when there is none or it is stale. */
export async function latestUsdToPkr(db = defaultDb) {
  const row = await db.query.fxRates.findFirst({
    where: and(eq(schema.fxRates.base, "USD"), eq(schema.fxRates.quote, "PKR")),
    orderBy: [desc(schema.fxRates.asOf)],
  });
  if (!row) return null;
  const ageDays =
    (Date.now() - new Date(`${row.asOf}T00:00:00Z`).getTime()) / 86_400_000;
  if (ageDays > MAX_RATE_AGE_DAYS) return null;
  return { rate: Number(row.rate), asOf: row.asOf, source: row.source };
}

/** Fetch today's rate and store it. Re-running on the same day overwrites. */
export async function refreshFxRates(db = defaultDb, url = DEFAULT_SOURCE) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Exchange rate request failed: ${res.status}`);
  const body: unknown = await res.json();
  const rate = (body as { rates?: Record<string, unknown> })?.rates?.PKR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0)
    throw new Error("Exchange rate response had no usable PKR rate.");
  const asOf = new Date().toISOString().slice(0, 10);
  await db
    .insert(schema.fxRates)
    .values({
      base: "USD",
      quote: "PKR",
      rate: rate.toFixed(4),
      asOf,
      source: url,
    })
    .onConflictDoUpdate({
      target: [schema.fxRates.base, schema.fxRates.quote, schema.fxRates.asOf],
      set: { rate: rate.toFixed(4), source: url, fetchedAt: new Date() },
    });
  return { rate, asOf };
}

if (process.argv[1]?.endsWith("fx.ts")) {
  refreshFxRates()
    .then((r) => {
      console.log(`USD to PKR on ${r.asOf}: ${r.rate}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
