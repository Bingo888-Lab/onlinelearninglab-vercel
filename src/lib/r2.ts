import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isValidObjectKey, PDF_CONTENT_TYPE } from "./r2-keys";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
});

const signTtl = () => Number(process.env.R2_SIGN_TTL_SECONDS ?? 300);

function assertKey(key: string): void {
  if (!isValidObjectKey(key)) throw new Error("invalid object key");
}

export function presignPut(key: string): Promise<string> {
  assertKey(key);
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env("R2_BUCKET"),
      Key: key,
      // 签名绑定了这个值：客户端 PUT 必须发完全一致的 Content-Type
      ContentType: PDF_CONTENT_TYPE,
    }),
    { expiresIn: signTtl() },
  );
}

export function presignGet(key: string): Promise<string> {
  assertKey(key);
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }),
    { expiresIn: signTtl() },
  );
}

export async function headObject(key: string) {
  assertKey(key);
  return r2.send(new HeadObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }));
}

export async function deleteObject(key: string): Promise<void> {
  assertKey(key);
  await r2.send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }));
}
