import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Storage } from "./index";

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

/** S3-compatible driver: Cloudflare R2 in production, MinIO locally and in CI. */
export function s3Driver(cfg: S3Config): Storage {
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey)
    throw new Error(
      "S3 storage needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
    );
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  const Bucket = cfg.bucket;
  return {
    async put(Key, bytes, ContentType) {
      await client.send(
        new PutObjectCommand({ Bucket, Key, Body: bytes, ContentType }),
      );
    },
    async get(Key) {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket, Key }));
        const bytes = await r.Body!.transformToByteArray();
        return {
          bytes,
          contentType: r.ContentType ?? "application/octet-stream",
        };
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
    },
    async exists(Key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key }));
        return true;
      } catch (e) {
        if ((e as { name?: string }).name === "NotFound") return false;
        throw e;
      }
    },
    async delete(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
}
