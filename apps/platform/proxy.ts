import { timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

/**
 * Origin protection (S23 D9).
 *
 * In deployed stages the server function sits behind a public function URL, so
 * anyone who learned it could bypass Cloudflare. The Cloudflare Worker
 * (`infra/proxy.ts`) is the only thing that knows the per-stage edge key, and
 * it sends it as `x-devhelp-edge-key`; any request without it gets 403.
 *
 * Locally `EDGE_KEY` is unset, so this is a no-op.
 *
 * Reads `process.env` directly rather than `@repo/env`: the proxy runs before
 * the app and is bundled on its own, where importing the full validated env
 * schema is not safe. Next 16 runs `proxy.ts` on the Node.js runtime, so the
 * comparison uses `timingSafeEqual`.
 */
export function proxy(request: NextRequest) {
  // Trimmed: a secret set from a pipe (`openssl rand -hex 32 | sst secret
  // set …`) carries a trailing newline, and the Worker's `Headers.set` strips
  // it per the Fetch spec, so without the trim the two sides never match
  // (found on the first dev deploy of S23).
  const edgeKey = process.env.EDGE_KEY?.trim();
  if (!edgeKey) return NextResponse.next();

  const sent = request.headers.get("x-devhelp-edge-key");
  if (!sent || !keysMatch(sent, edgeKey)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

function keysMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon\\.svg|favicon\\.ico).*)"],
};
