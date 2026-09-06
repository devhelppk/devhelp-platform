export const subjectLabels = {
  mentor_application: "Mentor application",
  company_review_request: "Company review request",
  comment: "Comment",
  course_review: "Course review",
  certificate: "Certificate",
  company_proposal: "Company proposal",
  company_review: "Company review",
  interview_experience: "Interview experience",
  salary_point: "Salary point",
} as const;

export const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  hidden: "Hidden",
  merged: "Merged",
} as const;

export const clauses = [
  ["c1", "Do not name individuals"],
  ["c2", "Only claim what you can stand behind"],
  ["c3", "No personal data"],
  ["c4", "Salaries are your own"],
  ["c5", "One voice per person"],
  ["c6", "Keep it on topic and readable"],
  ["c7", "New accounts and links"],
  ["c8", "Companies can ask for a review"],
  ["c9", "Mentors"],
] as const;

export function ago(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
