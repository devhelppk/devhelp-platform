import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { measure } from "./check-bundle-budget";

// Random bytes do not compress, so 200 KB stays ~200 KB gzipped.
const big = Buffer.from(
  Array.from({ length: 200 * 1024 }, () => Math.floor(Math.random() * 256)),
);
const small = Buffer.from("console.log('hi');".repeat(50));
const server = createServer((req, res) => {
  if (req.url === "/heavy")
    return res.end('<html><script src="/_next/static/big.js"></script></html>');
  if (req.url === "/light")
    return res.end(
      '<html><script src="/_next/static/small.js"></script></html>',
    );
  if (req.url === "/_next/static/big.js") return res.end(big);
  if (req.url === "/_next/static/small.js") return res.end(small);
  res.statusCode = 404;
  res.end();
});
let base = "";
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

describe("bundle budget", () => {
  it("fails a page whose gzipped scripts exceed the budget and passes a light one", async () => {
    const r = await measure(base, [
      { path: "/heavy", maxKb: 150 },
      { path: "/light", maxKb: 150 },
      { path: "/missing", maxKb: 150 },
    ]);
    expect(r[0]!.ok).toBe(false);
    expect(r[1]!.ok).toBe(true);
    expect(r[2]!.ok).toBe(false);
  });
});
