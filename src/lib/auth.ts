import { createServerSupabaseClient } from "@/lib/supabase/server";

export type Role = "admin" | "student";

export type GuardOk = { ok: true; userId: string; role: Role | null };
export type GuardErr = { ok: false; status: 401 | 403; code: "unauthorized" | "forbidden" };
export type Guard = GuardOk | GuardErr;

const DENY_401: GuardErr = { ok: false, status: 401, code: "unauthorized" };
const DENY_403: GuardErr = { ok: false, status: 403, code: "forbidden" };

/**
 * 当前登录用户 + 角色。
 *
 * 角色从 profiles 表读，不从 JWT claim 读 —— role 不是 Supabase 的标准 claim，
 * 自己塞进 user_metadata 的话 RLS 里没法用 auth.uid() 关联校验。
 * 每请求一次查询：v0.1.0 的 QPS 下这不是热点，需要缓存时再加。
 */
export async function getUser(): Promise<{ userId: string | null; role: Role | null }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  if (!userId) return { userId: null, role: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return { userId, role: (profile?.role as Role | undefined) ?? null };
}

export async function requireUser(): Promise<Guard> {
  const { userId, role } = await getUser();
  if (!userId) return DENY_401;
  return { ok: true, userId, role };
}

export async function requireAdmin(): Promise<Guard> {
  const { userId, role } = await getUser();
  if (!userId) return DENY_401;
  // profile 不存在或角色不是 admin，一律 403
  if (role !== "admin") return DENY_403;
  return { ok: true, userId, role };
}
