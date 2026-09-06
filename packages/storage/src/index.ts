import { env } from "@repo/env";
import { fsDriver } from "./fs";
import { s3Driver } from "./s3";

/**
 * Object storage for generated files (certificate PDFs, later uploads).
 * One S3-compatible driver serves every environment: Cloudflare R2 in
 * production, MinIO on a laptop and in CI. Raw files never go in Postgres
 * (founder decision, S7). The `fs` driver exists for unit tests only.
 */
export type Storage = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
};

let cached: Storage | null = null;
export function getStorage(): Storage {
  if (cached) return cached;
  if (env.STORAGE_DRIVER === "fs") {
    if (env.NODE_ENV === "production")
      throw new Error("STORAGE_DRIVER=fs is for tests; production needs s3");
    cached = fsDriver(env.STORAGE_FS_DIR ?? ".storage");
  } else {
    cached = s3Driver({
      endpoint: env.S3_ENDPOINT ?? "",
      region: env.S3_REGION ?? "auto",
      bucket: env.S3_BUCKET ?? "",
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return cached;
}

export { fsDriver } from "./fs";
export { s3Driver } from "./s3";
