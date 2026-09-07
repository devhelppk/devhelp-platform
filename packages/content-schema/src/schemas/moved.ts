/**
 * Fields the content repo used to own and no longer does (S11).
 *
 * Every schema here is `.strict()`, so leaving one of these in a file already
 * fails — but as "unrecognized key", which tells a contributor nothing. The
 * loader turns these into a sentence naming where the field lives now, because
 * the person hitting this is usually someone who just tried to fix a typo in a
 * title and needs to know why that is no longer a pull request.
 */
export const MOVED_FIELDS: Record<string, string> = {
  title: "the studio: edit it at /studio",
  summary: "the studio: edit it at /studio",
  description: "the studio: edit it at /studio",
  track: "the studio: edit it at /studio",
  level: "the studio: edit it at /studio",
  estimatedHours: "the studio: edit it at /studio",
  cover: "the studio: edit it at /studio",
  published: "the studio: a course is published there, not here",
  authors: "the studio: credits are devhelp accounts, not handles in YAML",
  reviewers: "the studio: credits are devhelp accounts, not handles in YAML",
  mode: "the studio: edit it at /studio",
  isRequired: "the studio: edit it at /studio",
  isFree: "the studio: edit it at /studio",
  durationMinutes: "the studio: edit it at /studio",
  updated: "the database, which records when a row actually changed",
};

/** The sentence to show for a key that has moved, or null if it has not. */
export function movedFieldMessage(key: string): string | null {
  const where = MOVED_FIELDS[key];
  return where
    ? `"${key}" is no longer part of the content repo; it now lives in ${where}`
    : null;
}
