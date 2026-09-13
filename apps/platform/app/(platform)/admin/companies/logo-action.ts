"use server";

import { auth } from "@repo/auth";
import { and, db, eq, schema } from "@repo/database";
import { getStorage } from "@repo/storage";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkLogo } from "@/lib/logo";

export type LogoResult = { ok: true } | { ok: false; error: string };

/**
 * Store a company logo in R2 and point the profile at it (S10c). Admin only,
 * like every other company fact. The key carries a timestamp so replacing a
 * logo produces a new URL rather than fighting a cached one.
 */
export async function uploadCompanyLogo(
  slug: string,
  form: FormData,
): Promise<LogoResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (session?.user.role !== "admin")
    return { ok: false, error: "Admins only." };

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose an image first." };
  const check = checkLogo(file);
  if (!check.ok) return check;
  const { ext } = check;

  const org = await db.query.organizations.findFirst({
    where: and(
      eq(schema.organizations.slug, slug),
      eq(schema.organizations.kind, "company"),
    ),
    columns: { id: true },
  });
  if (!org) return { ok: false, error: "No such company." };

  const key = `companies/${org.id}/logo-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await getStorage().put(key, bytes, file.type);

  const previous = await db.query.companyProfiles.findFirst({
    where: eq(schema.companyProfiles.organizationId, org.id),
    columns: { logoKey: true },
  });
  await db
    .update(schema.companyProfiles)
    .set({ logoKey: key, updatedAt: new Date() })
    .where(eq(schema.companyProfiles.organizationId, org.id));
  // The old logo is nobody's now; leaving it would quietly fill the bucket. A
  // cached favicon is kept on purpose: removing the logo falls back to it.
  if (previous?.logoKey && previous.logoKey !== key)
    await getStorage()
      .delete(previous.logoKey)
      .catch(() => {});

  revalidatePath(`/admin/companies/${slug}`);
  return { ok: true };
}

/**
 * Remove the mark entirely: the uploaded logo and any icon cached from the
 * company's website. `faviconCheckedAt` is stamped so the next request does not
 * immediately fetch the icon straight back, which is what an admin removing a
 * mark is asking not to happen.
 */
export async function removeCompanyLogo(slug: string): Promise<LogoResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (session?.user.role !== "admin")
    return { ok: false, error: "Admins only." };
  const org = await db.query.organizations.findFirst({
    where: and(
      eq(schema.organizations.slug, slug),
      eq(schema.organizations.kind, "company"),
    ),
    columns: { id: true },
  });
  if (!org) return { ok: false, error: "No such company." };
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(schema.companyProfiles.organizationId, org.id),
    columns: { logoKey: true, faviconKey: true },
  });
  for (const key of [profile?.logoKey, profile?.faviconKey])
    if (key)
      await getStorage()
        .delete(key)
        .catch(() => {});
  await db
    .update(schema.companyProfiles)
    .set({
      logoKey: null,
      faviconKey: null,
      faviconCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.companyProfiles.organizationId, org.id));
  revalidatePath(`/admin/companies/${slug}`);
  return { ok: true };
}
