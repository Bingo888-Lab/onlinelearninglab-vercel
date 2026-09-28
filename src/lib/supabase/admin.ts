import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 客户端 —— 绕过 RLS。
 *
 * 只用于两类场景：
 *  1. invite_codes 表（RLS 完全不对客户端开放）
 *  2. 注册流程的 auth.admin.createUser
 *
 * 禁止用于 documents 的常规读写：那些有 RLS 兜底，走会话客户端。
 * ponytail: 单项目单 key，暂不需要按环境切 key；多环境部署时在此处分叉。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
