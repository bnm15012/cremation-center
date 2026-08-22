/**
 * Storage helpers — Cloudflare R2 in production, local disk in dev.
 *
 * R2 env vars (all optional — falls back to local disk if missing):
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME       — bucket name
 */
import { createServerFn } from "@tanstack/react-start";
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth-middleware";
import path from "node:path";
import fs from "node:fs/promises";

// ── helpers ───────────────────────────────────────────────────────────────────

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getS3() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

function getBucket() {
  return process.env.R2_BUCKET_NAME!;
}

// Local uploads directory (dev only)
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function ensureUploadsDir() {
  await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
}

function localFilePath(key: string) {
  // Sanitise key to prevent path traversal
  const safe = key.replace(/\.\.\//g, "").replace(/^\/+/, "");
  return path.join(LOCAL_UPLOADS_DIR, safe.replace(/\//g, "__"));
}

// ── getUploadUrl ──────────────────────────────────────────────────────────────
// Returns a presigned PUT URL (R2) or a local proxy URL (dev)

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { key: string; contentType: string }) => d)
  .handler(async ({ data }) => {
    if (isR2Configured()) {
      const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: data.key,
        ContentType: data.contentType,
      });
      const url = await getSignedUrl(getS3(), command, { expiresIn: 300 });
      return { url, useProxy: false };
    }

    // Dev: tell the client to use the proxy upload instead
    return { url: "", useProxy: true };
  });

// ── proxyUploadFile ───────────────────────────────────────────────────────────
// Server-side upload: R2 in prod, local disk in dev

export const proxyUploadFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: { key: string; contentType: string; base64: string }) => d
  )
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, "base64");

    if (buffer.byteLength > 50 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 50 MB.");
    }

    if (isR2Configured()) {
      await getS3().send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: data.key,
          ContentType: data.contentType,
          ContentLength: buffer.byteLength,
          Body: buffer,
        })
      );
    } else {
      // Dev: save to local disk
      await ensureUploadsDir();
      await fs.writeFile(localFilePath(data.key), buffer);
    }

    return { key: data.key };
  });

// ── getDownloadUrl ────────────────────────────────────────────────────────────

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { storagePath: string; fileName: string }) => d)
  .handler(async ({ data }) => {
    if (isR2Configured()) {
      const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: data.storagePath,
        ResponseContentDisposition: `inline; filename="${data.fileName}"`,
      });
      const url = await getSignedUrl(getS3(), command, { expiresIn: 600 });
      return { url };
    }

    // Dev: serve via local API route
    const appUrl = process.env.APP_URL ?? "http://localhost:8082";
    const url = `${appUrl}/api/local-file?key=${encodeURIComponent(data.storagePath)}&name=${encodeURIComponent(data.fileName)}`;
    return { url };
  });

async function deleteFileByPath(storagePath: string) {
  if (isR2Configured()) {
    await getS3().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: storagePath })
    );
  } else {
    try {
      await fs.unlink(localFilePath(storagePath));
    } catch {}
  }
}

export { deleteFileByPath };

// ── deleteStorageFile ─────────────────────────────────────────────────────────

export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { storagePath: string }) => d)
  .handler(async ({ data }) => {
    await deleteFileByPath(data.storagePath);
    return { success: true };
  });
