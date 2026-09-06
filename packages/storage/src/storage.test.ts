import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Loads the root .env so the MinIO round trip runs locally too.
import "@repo/env";
import { describe, expect, it } from "vitest";
import { fsDriver } from "./fs";
import { s3Driver } from "./s3";

const bytes = new TextEncoder().encode("%PDF-1.7 hello");

async function roundTrip(s: ReturnType<typeof fsDriver>) {
  const key = `certificates/${crypto.randomUUID()}.pdf`;
  expect(await s.exists(key)).toBe(false);
  expect(await s.get(key)).toBeNull();
  await s.put(key, bytes, "application/pdf");
  expect(await s.exists(key)).toBe(true);
  const got = await s.get(key);
  expect(got?.contentType).toBe("application/pdf");
  expect(new TextDecoder().decode(got!.bytes)).toBe("%PDF-1.7 hello");
  await s.delete(key);
  expect(await s.exists(key)).toBe(false);
}

describe("fs driver", () => {
  it("round-trips and rejects escaping keys", async () => {
    const s = fsDriver(mkdtempSync(join(tmpdir(), "devhelp-storage-")));
    await roundTrip(s);
    await expect(s.put("../escape", bytes, "text/plain")).rejects.toThrow(
      /bad key/,
    );
  });
});

const endpoint = process.env.S3_ENDPOINT;
describe.skipIf(!endpoint)("s3 driver (MinIO)", () => {
  it("round-trips against the bucket", async () => {
    const s = s3Driver({
      endpoint: endpoint!,
      region: process.env.S3_REGION ?? "auto",
      bucket: process.env.S3_BUCKET ?? "devhelp",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      forcePathStyle: true,
    });
    await roundTrip(s);
  });
});
