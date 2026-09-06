/**
 * Levels a salary point can be filed under. Its own module with no imports:
 * the contribute form is a client component, and reaching into the router
 * index for this would pull the whole tRPC tree, and `postgres` with it, into
 * the browser bundle.
 *
 * This is a grouping key for `salary_stats_detail`, which is why it is a fixed
 * list rather than free text: "Senior", "senior", and "Sr" would be three
 * separate cells, none of which would ever reach the five-report floor.
 */
export const SALARY_LEVELS = [
  "Intern",
  "Junior",
  "Mid",
  "Senior",
  "Staff",
  "Lead",
  "Manager",
] as const;

export type SalaryLevel = (typeof SALARY_LEVELS)[number];
