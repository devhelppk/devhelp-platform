/**
 * The front door of the app on Cloudflare (S22, S23).
 *
 * One Worker, deployed by `sst.config.ts` on the site's hostname with the
 * app's OpenNext `assets/` directory attached as Workers Static Assets.
 * Cloudflare serves any request that matches a file there — `_next/static/*`,
 * `public/` files — from its edge without running this code, which is both the
 * fast path and free. Everything else reaches this function, which forwards it
 * to the server function's URL.
 *
 * Why a proxy rather than pointing DNS at the function URL: the function URL
 * only answers requests whose Host is its own AWS hostname, and OpenNext's
 * server function does not serve static assets. On `sst.aws.Nextjs` CloudFront
 * did both jobs, and this account cannot create a CloudFront distribution yet.
 *
 * The edge key: the function URL is public, so every forwarded request carries
 * `x-devhelp-edge-key`, and `apps/platform/proxy.ts` answers 403 without it.
 * Only this Worker and the function know the key (the per-stage `EdgeKey` SST
 * secret).
 */

interface Env {
  /**
   * Set by SST from the linked `Origin` resource: a JSON string
   * `{ "url": <the function URL>, "key": <the edge key> }`.
   */
  SST_RESOURCE_Origin: string;
}

interface Origin {
  url: string;
  key: string;
}

function isOrigin(v: unknown): v is Origin {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).url === "string" &&
    typeof (v as Record<string, unknown>).key === "string"
  );
}

// Parsed on the first request and reused by the isolate afterwards.
let origin: Origin | undefined;

function readOrigin(env: Env): Origin {
  if (origin) return origin;
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.SST_RESOURCE_Origin);
  } catch {
    parsed = undefined;
  }
  if (!isOrigin(parsed)) {
    throw new Error(
      "SST_RESOURCE_Origin is missing or malformed: expected JSON { url, key }",
    );
  }
  origin = parsed;
  return origin;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { url: originUrl, key } = readOrigin(env);
    const url = new URL(request.url);
    const upstream = new URL(url.pathname + url.search, originUrl);

    const headers = new Headers(request.headers);
    // The origin needs its own Host (set by fetch from the URL); the app needs
    // to know the host the reader actually used. Next reads x-forwarded-host
    // for the server-action origin check and for absolute URLs, so without
    // this every form post would be rejected as cross-origin.
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
    headers.set("x-devhelp-edge-key", key);

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return fetch(upstream, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Pass redirects to the browser as they are. Following them here would
      // turn a redirect to /sign-in into a page served at the wrong URL.
      redirect: "manual",
    });
  },
};
