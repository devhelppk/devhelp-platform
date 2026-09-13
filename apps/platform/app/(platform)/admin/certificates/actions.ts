"use server";

import { revalidatePath } from "next/cache";

/**
 * Drops the cached verify page after a revoke or restore, so the public page
 * never shows a revoked certificate as valid (F1.20). Called by the admin UI
 * after the mutation; `packages/api` stays free of Next imports.
 */
export async function invalidateVerifyPage(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  )
    return;
  revalidatePath(`/verify/${id}`);
}
