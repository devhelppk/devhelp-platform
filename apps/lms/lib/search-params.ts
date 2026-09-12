/**
 * Every search parameter the company pages read, defined once.
 *
 * Imported from `nuqs/server`, so these parsers are server-safe: the pages stay
 * server-rendered and ship no client JavaScript for reading a URL. The same
 * definitions back the client controls in `components/companies/*`, so a param's
 * name, type and default live in exactly one place instead of being re-parsed by
 * hand at each end (this file replaced a `one(sp.x)` helper that silently
 * stringified arrays).
 */
import {
  createLoader,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

/** Panels on a company page. `overview` is the default and the indexed one. */
export const companyTabs = [
  "overview",
  "reviews",
  "interviews",
  "pay",
  "about",
] as const;
export type CompanyTab = (typeof companyTabs)[number];

export const companyDetailParams = {
  tab: parseAsStringLiteral(companyTabs).withDefault("overview"),
  /** Free-text role, matched case-insensitively against the reported role. */
  role: parseAsString.withDefault(""),
  /** Reviews: current / former / intern. */
  status: parseAsString.withDefault(""),
  /** Interviews: offer / rejected / withdrew / no_response. */
  outcome: parseAsString.withDefault(""),
};
export const loadCompanyDetail = createLoader(companyDetailParams);

export const companyListParams = {
  q: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  industry: parseAsString.withDefault(""),
  juniors: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral([
    "name",
    "rating",
    "reviews",
  ] as const).withDefault("name"),
};
export const loadCompanyList = createLoader(companyListParams);

/** The moderation queue: which tab, which kind, and which item is open. */
export const moderationStatuses = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;

export const moderationParams = {
  status: parseAsStringLiteral(moderationStatuses).withDefault("pending"),
  /** Subject type filter; the queue procedure already accepts one. */
  type: parseAsString.withDefault(""),
  /**
   * The item whose detail dialog is open. `shallow: false` at the call site, so
   * the server re-renders for it and the URL is a real, shareable, refreshable
   * state rather than something only the browser knows.
   */
  item: parseAsString.withDefault(""),
};
export const loadModeration = createLoader(moderationParams);
