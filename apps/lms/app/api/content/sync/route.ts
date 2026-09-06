import { auth } from "@repo/auth";
import { contentDir, findRepoRoot, readLock, syncContent } from "@repo/content";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";

/**
 * Re-run the metadata sync for the content already in this deployment.
 * Recovery tool, not a publishing path: new content needs a new build.
 * Works where the repo checkout and `.content/` are present on disk (local,
 * Docker with the workspace copied); on a serverless deploy it answers 409.
 * Auth: admin session, or the CONTENT_SYNC_SECRET bearer token.
 */
export async function POST(req: Request) {
  const authorized = (await isAdmin(req)) || hasSecret(req);
  if (!authorized)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  let root: string;
  try {
    root = findRepoRoot();
  } catch {
    return Response.json(
      { error: "repo root not available in this deployment" },
      { status: 409 },
    );
  }
  const dir = contentDir(root);
  if (!existsSync(join(dir, "courses"))) {
    return Response.json(
      { error: `no content at ${dir}; run content:pull in the build` },
      { status: 409 },
    );
  }
  try {
    const lock = readLock(root);
    const shaFile = join(dir, ".sha");
    const sha = existsSync(shaFile)
      ? readFileSync(shaFile, "utf8").trim()
      : lock.sha;
    const summary = await syncContent({ dir, sha, repo: lock.repo });
    return Response.json(summary);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function isAdmin(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user.role === "admin";
}

function hasSecret(req: Request) {
  const secret = process.env.CONTENT_SYNC_SECRET;
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !given || secret.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(given));
}
