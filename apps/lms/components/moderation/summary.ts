import type { AppRouter, inferRouterOutputs } from "@repo/api";

type Item =
  inferRouterOutputs<AppRouter>["moderation"]["queue"]["items"][number];

/**
 * The one line a moderator needs to triage a row without opening it.
 *
 * `moderation_items.payload` is a snapshot of what was submitted, taken so a
 * decision can be re-read as it stood (S5). The queue stored it and showed none
 * of it: every row read "Salary point by someone", so a thousand pending items
 * were indistinguishable and each one had to be opened to learn anything.
 *
 * Derived from the payload rather than joined from live tables on purpose — the
 * snapshot is what the decision is about, and the live row may since have
 * changed or gone.
 */
export function itemSummary(item: Pick<Item, "payload">): string {
  const p = item.payload;
  if (!p) return "";
  switch (p.kind) {
    case "salary_point": {
      const d = p.data;
      const where = [d.level, d.city].filter(Boolean).join(", ");
      return [d.companyName, d.role, where && `(${where})`]
        .filter(Boolean)
        .join(" · ");
    }
    case "company_proposal":
      return [p.data.name, p.data.industry, p.data.cities?.join(", ")]
        .filter(Boolean)
        .join(" · ");
    case "company_contribution":
      return [p.data.companyName, p.data.summary].filter(Boolean).join(" · ");
    case "company_claim":
      return [p.data.companyName, p.data.claimantName]
        .filter(Boolean)
        .join(" · ");
    case "company_response":
      return [p.data.companyName, p.data.body].filter(Boolean).join(" · ");
    case "company_review_request":
      return [p.data.targetType, p.data.message].filter(Boolean).join(" · ");
    case "comment":
      return [p.data.subjectTitle, p.data.body].filter(Boolean).join(" · ");
    case "course_review":
      return [p.data.courseTitle, p.data.body].filter(Boolean).join(" · ");
    case "certificate":
      return p.data.courseTitle ?? "";
    case "mentor_application":
      return [p.data.tracks?.join(", "), p.data.why]
        .filter(Boolean)
        .join(" · ");
    case "salary_report":
      return [p.data.companyName, p.data.role, `n = ${p.data.n}`]
        .filter(Boolean)
        .join(" · ");
    default:
      return "";
  }
}
