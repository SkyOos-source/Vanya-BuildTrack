import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

export class R2StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2StorageError";
  }
}

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucketName = process.env.R2_BUCKET_NAME?.trim();
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

export const r2Configured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName && publicBaseUrl);

const client = r2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! }
    })
  : null;

function parseDataUrl(value: string): { bytes: Buffer; contentType: string } | null {
  const match = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 3 || bytes.length > 500 * 1024) return null;
  return { bytes, contentType: match[1] };
}

function parsePdfDataUrl(value: string): { bytes: Buffer; contentType: "application/pdf" } | null {
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 5 || bytes.length > 2_500_000 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return null;
  return { bytes, contentType: "application/pdf" };
}

export async function uploadBase64Pdf(value: string, category: string): Promise<string> {
  if (!r2Configured || !client || !bucketName || !publicBaseUrl) {
    throw new R2StorageError("Cloudflare R2 file storage is not configured.");
  }
  const parsed = parsePdfDataUrl(value);
  if (!parsed) throw new R2StorageError("A valid PDF quotation is required.");

  const key = `${category.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase()}/${randomUUID()}.pdf`;
  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: parsed.bytes,
    ContentType: parsed.contentType,
    CacheControl: "public, max-age=3600"
  }));
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadBase64Image(value: string, category: string): Promise<string> {
  if (!r2Configured || !client || !bucketName || !publicBaseUrl) {
    throw new R2StorageError("Cloudflare R2 image storage is not configured.");
  }
  const parsed = parseDataUrl(value);
  if (!parsed) throw new R2StorageError("A valid image is required.");

  const extension = parsed.contentType === "image/png" ? "png" : parsed.contentType === "image/webp" ? "webp" : "jpg";
  const key = `${category.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase()}/${randomUUID()}.${extension}`;
  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: parsed.bytes,
    ContentType: parsed.contentType,
    CacheControl: "public, max-age=31536000, immutable"
  }));
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function deleteR2Image(url: string): Promise<void> {
  if (!r2Configured || !client || !bucketName || !publicBaseUrl) return;
  if (!url.startsWith(`${publicBaseUrl}/`)) return;
  const key = decodeURIComponent(url.slice(publicBaseUrl.length + 1));
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
}

export async function migrateLegacyBase64Images(value: unknown): Promise<boolean> {
  if (!r2Configured) return false;
  let changed = false;

  const migrate = async (input: unknown, category: string): Promise<unknown> => {
    if (typeof input === "string") {
      if (input.startsWith("data:image/")) {
        changed = true;
        return uploadBase64Image(input, category);
      }
      if (input.startsWith("data:application/pdf;base64,")) {
        changed = true;
        return uploadBase64Pdf(input, category);
      }
      return input;
    }
    if (Array.isArray(input)) {
      for (let index = 0; index < input.length; index += 1) {
        input[index] = await migrate(input[index], category);
      }
      return input;
    }
    if (input && typeof input === "object") {
      for (const [key, nested] of Object.entries(input)) {
        (input as Record<string, unknown>)[key] = await migrate(nested, `${category}/${key}`);
      }
    }
    return input;
  };

  await migrate(value, "legacy");
  return changed;
}
