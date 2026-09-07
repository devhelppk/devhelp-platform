"use server";

import { api } from "@repo/api/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { FLAG_REASONS } from "@/components/moderation/flag-reasons";

const REASONS = FLAG_REASONS.map(([v]) => v) as string[];

/**
 * Flag a company review or interview experience. A server action rather than a
 * tRPC mutation because the company page is a public, indexable page that
 * ships no client JavaScript; adding the tRPC provider for a control most
 * readers never touch would put it on every visit.
 */
export async function flagCompanyContribution(
  _prev: unknown,
  form: FormData,
): Promise<{ ok?: true; error?: string }> {
  const subjectType = String(form.get("subjectType") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const slug = String(form.get("slug") ?? "");
  const details = String(form.get("details") ?? "").trim();
  if (
    (subjectType !== "company_review" &&
      subjectType !== "interview_experience") ||
    !/^[0-9a-f-]{36}$/.test(subjectId) ||
    !REASONS.includes(reason)
  )
    return { error: "That report could not be sent." };
  try {
    const caller = await api(new Headers(await headers()));
    await caller.moderation.flag({
      subjectType,
      subjectId,
      reason: reason as "other",
      details: details || undefined,
    });
    if (/^[a-z0-9-]{1,80}$/.test(slug)) revalidatePath(`/companies/${slug}`);
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "That report could not be sent.",
    };
  }
}

/**
 * Report that a role's published salary figures look wrong. Same reasoning as
 * above: the company page ships no tRPC provider, so this goes through a
 * server action.
 */
export async function reportSalaryFigures(
  _prev: unknown,
  form: FormData,
): Promise<{ ok?: true; error?: string }> {
  const slug = String(form.get("slug") ?? "");
  const roleId = String(form.get("roleId") ?? "");
  const currency = String(form.get("currency") ?? "");
  const details = String(form.get("details") ?? "").trim();
  if (
    !/^[a-z0-9-]{1,80}$/.test(slug) ||
    (currency !== "PKR" && currency !== "USD") ||
    (roleId && !/^[0-9a-f-]{36}$/.test(roleId))
  )
    return { error: "That report could not be sent." };
  try {
    const caller = await api(new Headers(await headers()));
    await caller.companies.reportSalaries({
      slug,
      roleId: roleId || null,
      currency,
      details: details || undefined,
    });
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "That report could not be sent.",
    };
  }
}
