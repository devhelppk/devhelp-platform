/**
 * Reasons a reader can give, in the words a reader would use. The values are
 * `flag_reason` in the database and anchor into the content policy, so a
 * moderator reads back the reason actually chosen — S6's flag button
 * hard-coded "off topic" for everything, which told them the wrong thing.
 */
export const FLAG_REASONS = [
  ["names_individual", "It names a person"],
  ["unverifiable", "I do not believe this is true"],
  ["personal_data", "It contains personal details"],
  ["spam", "Spam or an advert"],
  ["off_topic", "Off topic"],
  ["other", "Something else"],
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number][0];
