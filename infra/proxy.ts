/**
 * The front door of each app on Cloudflare (S22).
 *
 * One Worker per app, deployed by `sst.config.ts` with the app's OpenNext
 * `assets/` directory attached as Workers Static Assets. Cloudflare serves any
 * request that matches a file there — `_next/static/*`, `public/` files — from
 * its edge without running this code, which is both the fast path and free.
 * Everything else reaches this function, which forwards it to the app's Lambda
 * function URL.
 *
 * Why a proxy rather than pointing DNS at the function URL: a Lambda function
 * URL only answers requests whose Host is its own `*.lambda-url.*.on.aws`
 * name, and OpenNext's server function does not serve static assets — on
 * `sst.aws.Nextjs` CloudFront did both jobs, and this account cannot create a
 * CloudFront distribution yet.
 */

interface Env {
  /** The app's Lambda function URL, e.g. https://abc.lambda-url.ap-southeast-1.on.aws/ */
  ORIGIN_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const upstream = new URL(url.pathname + url.search, env.ORIGIN_URL);

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
