import { and, count, desc, eq, gte, schema, sql } from "@repo/database";
import type { Tx } from "./types";

/**
 * Streaks and the activity grid are counted in Pakistan Standard Time: one
 * timezone for the whole audience, so a lesson finished at 1 a.m. counts for
 * the night it was done rather than the next UTC day.
 */
export const ACTIVITY_TZ = "Asia/Karachi";

const dayOf = (at: Date) =>
  sql<string>`(${at.toISOString()}::timestamptz AT TIME ZONE ${ACTIVITY_TZ})::date`;

/** Adds one to the learner's day bucket. Called by the reducer for every event that lands. */
export async function recordActivity(tx: Tx, userId: string, occurredAt: Date) {
  await tx
    .insert(schema.userActivity)
    .values({ userId, day: dayOf(occurredAt), events: 1 })
    .onConflictDoUpdate({
      target: [schema.userActivity.userId, schema.userActivity.day],
      set: { events: sql`${schema.userActivity.events} + 1` },
    });
}

/** Today in the activity timezone, as `YYYY-MM-DD`. */
export function today(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: ACTIVITY_TZ });
}

const addDaysFrom = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type Streak = {
  current: number;
  longest: number;
  lastActiveDay: string | null;
  activeDays: number;
};

/**
 * Current and longest run of consecutive active days. The current streak
 * survives while the last active day is today or yesterday, so someone who
 * has not opened the site yet today has not lost it.
 */
export async function streakFor(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<Streak> {
  // A year, matching the grid and the copy: "N days active in the last year".
  const from = addDaysFrom(today(now), -365);
  const rows = await tx
    .select({ day: schema.userActivity.day })
    .from(schema.userActivity)
    .where(
      and(
        eq(schema.userActivity.userId, userId),
        gte(schema.userActivity.day, from),
      ),
    )
    .orderBy(desc(schema.userActivity.day));
  if (rows.length === 0)
    return { current: 0, longest: 0, lastActiveDay: null, activeDays: 0 };
  const days = rows.map((r) => r.day);
  const t = today(now);
  const last = days[0]!;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === addDaysFrom(days[i - 1]!, -1)) run++;
    else run = 1;
    if (run > longest) longest = run;
  }
  // Count the run ending at the most recent day, then keep it only if that day is recent.
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === addDaysFrom(days[i - 1]!, -1)) current++;
    else break;
  }
  const fresh = last === t || last === addDaysFrom(t, -1);
  return {
    current: fresh ? current : 0,
    longest,
    lastActiveDay: last,
    activeDays: days.length,
  };
}

export type ActivityDay = { day: string; events: number };

/** Day buckets for the grid, oldest first, including empty days. */
export async function activityFor(
  tx: Tx,
  userId: string,
  weeks = 53,
  now = new Date(),
): Promise<ActivityDay[]> {
  const end = today(now);
  const start = addDaysFrom(end, -(weeks * 7 - 1));
  const rows = await tx
    .select({
      day: schema.userActivity.day,
      events: schema.userActivity.events,
    })
    .from(schema.userActivity)
    .where(
      and(
        eq(schema.userActivity.userId, userId),
        gte(schema.userActivity.day, start),
      ),
    );
  const byDay = new Map(rows.map((r) => [r.day, r.events]));
  const out: ActivityDay[] = [];
  for (let d = start; d <= end; d = addDaysFrom(d, 1))
    out.push({ day: d, events: byDay.get(d) ?? 0 });
  return out;
}

/** Distinct active days inside a rolling window, used by `lessons_in_window`-style rules. */
export async function activeDaysSince(tx: Tx, userId: string, since: Date) {
  const [row] = await tx
    .select({ n: count() })
    .from(schema.userActivity)
    .where(
      and(
        eq(schema.userActivity.userId, userId),
        gte(schema.userActivity.day, dayOf(since)),
      ),
    );
  return row?.n ?? 0;
}
