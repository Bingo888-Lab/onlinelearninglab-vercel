/**
 * e2e 前置清理：清空测试 Supabase 的 documents / invite_codes，并清空测试 R2 桶的
 * documents/ 前缀；同时建好一个 e2e 专用 admin 账号（随机密码，不落 git）。
 *
 * 用法：
 *   E2E_ALLOW_REMOTE_RESET=1 node scripts/reset-e2e.mjs
 *
 * 安全阀两道，都不可绕过：
 *  1. 必须显式设置 E2E_ALLOW_REMOTE_RESET=1
 *  2. R2_BUCKET 必须以 -test 结尾
 * 目的是防止有人不小心对着生产桶跑 truncate。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { parseEnv, findEnvProblems } from "./check-env.mjs";

const E2E_ADMIN_EMAIL = "e2e-admin@onlinelearninglab.test";
const CREDENTIALS_FILE = resolve("e2e/.tmp/admin.json");

export function assertSafeResetTarget({ allowed, bucket }) {
  if (!allowed) throw new Error("E2E_ALLOW_REMOTE_RESET must be 1 — 拒绝清理远程数据");
  if (!bucket.endsWith("-test")) throw new Error(`R2_BUCKET (${bucket}) 必须以 -test 结尾`);
}

function r2Client(env) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/** 分页删除 documents/ 前缀下的全部对象 */
async function purgeBucket(client, bucket) {
  let deleted = 0;
  let continuationToken;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "documents/", ContinuationToken: continuationToken }),
    );
    const objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key }));
    if (objects.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
      deleted += objects.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

async function ensureE2EAdmin(supabase) {
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email: E2E_ADMIN_EMAIL,
    password,
    email_confirm: true,
  });

  let userId = data?.user?.id;

  if (error) {
    // 已存在就复用：重置密码并重新提权，避免每次清理都换账号
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw new Error(`列出用户失败：${listError.message}`);

    const existing = list.users.find((u) => u.email?.toLowerCase() === E2E_ADMIN_EMAIL);
    if (!existing) throw new Error(`创建 e2e admin 失败：${error.message}`);

    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updateError) throw new Error(`重置 e2e admin 密码失败：${updateError.message}`);
    userId = existing.id;
  }

  if (!userId) throw new Error("e2e admin 用户 id 缺失");

  const { error: roleError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (roleError) throw new Error(`提权失败：${roleError.message}`);

  await mkdir(resolve("e2e/.tmp"), { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify({ email: E2E_ADMIN_EMAIL, password }, null, 2));

  return { email: E2E_ADMIN_EMAIL, file: CREDENTIALS_FILE };
}

async function main() {
  const env = parseEnv(await readFile(".env.local", "utf8"));
  const problems = findEnvProblems(env);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  assertSafeResetTarget({
    allowed: process.env.E2E_ALLOW_REMOTE_RESET === "1",
    bucket: env.R2_BUCKET,
  });

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 顺序：先删 documents（invite_codes 无外键指向它，但保持可读顺序）
  const { error: docError } = await supabase.from("documents").delete().not("id", "is", null);
  if (docError) throw new Error(`清空 documents 失败：${docError.message}`);

  const { error: inviteError } = await supabase.from("invite_codes").delete().not("code", "is", null);
  if (inviteError) throw new Error(`清空 invite_codes 失败：${inviteError.message}`);

  const removed = await purgeBucket(r2Client(env), env.R2_BUCKET);
  const admin = await ensureE2EAdmin(supabase);

  console.log(`已清空 documents / invite_codes，R2 删除 ${removed} 个对象。`);
  console.log(`e2e admin 凭据已写入 ${admin.file}（gitignore 覆盖，密码不进版本库）。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
