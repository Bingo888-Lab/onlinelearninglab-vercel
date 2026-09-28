import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 客户端 —— 绕过 RLS。
 *
 * 只用于一类场景：invite_codes 表（RLS 完全不对客户端开放）。
 *
 * 禁止用于 documents 的常规读写：那些有 RLS 兜底，走会话客户端。
 * 禁止用于注册：/api/register 走公开 auth.signUp，邮件确认与重复邮箱的可见性
 * 都由 GoTrue 决定，admin 客户端会把这些信号吃掉。
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
