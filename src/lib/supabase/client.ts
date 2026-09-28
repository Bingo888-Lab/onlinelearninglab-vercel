import { createBrowserClient } from "@supabase/ssr";

/** 客户端组件用。只读公开 env（publishable key），绝不含 secret。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
