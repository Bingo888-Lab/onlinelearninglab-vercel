export class SafeResetTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = "SafeResetTargetError";
  }
}

const SAFE_SUPABASE_HOST = "xleewqxbjfetctmsjquk.supabase.co";
const SAFE_SUPABASE_ORIGIN = `https://${SAFE_SUPABASE_HOST}`;
const SAFE_R2_BUCKET = "online-learning-lab-test";

function fail(message) {
  throw new SafeResetTargetError(message);
}

/** Read-only validation; operator authorization cannot expand the allowlist. */
export function assertSafeResetTarget(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    fail("Reset target configuration is missing or invalid; reset refused");
  }
  const { allowed, supabaseUrl, bucket } = config;
  if (allowed !== true) {
    fail("E2E_ALLOW_REMOTE_RESET must be 1 — 拒绝清理远程数据");
  }
  if (typeof supabaseUrl !== "string" || supabaseUrl.length === 0) {
    fail("Supabase URL 缺失或无效；拒绝清理远程数据");
  }
  if (
    /[\u0000-\u001f\u007f]/.test(supabaseUrl) ||
    supabaseUrl.includes("\\") ||
    supabaseUrl.trim() !== supabaseUrl
  ) {
    fail("Supabase URL 格式无效；拒绝清理远程数据");
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    fail("Supabase URL 格式无效；拒绝清理远程数据");
  }
  if (parsedUrl.protocol !== "https:") {
    fail("Supabase URL 必须使用 HTTPS；拒绝清理远程数据");
  }
  if (parsedUrl.hostname !== SAFE_SUPABASE_HOST) {
    fail("Supabase 项目不是允许的测试项目；拒绝清理远程数据");
  }
  if (
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.port !== "" ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== "" ||
    parsedUrl.origin !== SAFE_SUPABASE_ORIGIN
  ) {
    fail("Supabase URL 格式无效；拒绝清理远程数据");
  }
  if (typeof bucket !== "string" || bucket.length === 0) {
    fail("R2_BUCKET 缺失或无效；拒绝清理远程数据");
  }
  if (bucket !== SAFE_R2_BUCKET) {
    fail("R2_BUCKET 不是允许的测试桶；拒绝清理远程数据");
  }
}

/** Validate before invoking any cloud client construction or remote effects. */
export async function withSafeResetTarget(config, cleanup) {
  assertSafeResetTarget(config);
  return cleanup();
}
