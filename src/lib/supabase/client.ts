import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

/** 客户端组件用。只读公开 env（publishable key），绝不含 secret。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/**
 * 服务端环境里用公开权限的客户端（不读写 cookie）。
 *
 * 只有 /api/register 用它：走 auth.signUp 才能收到确认邮件，
 * service_role 客户端会吞掉「邮箱已存在」的信号，也不发确认邮件。
 */
export function createBrowserSupabaseClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
