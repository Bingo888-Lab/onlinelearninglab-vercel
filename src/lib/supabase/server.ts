import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** RSC / Route Handler 用的服务端客户端，读写 cookie 会话 */
export async function createServerSupabaseClient() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            for (const { name, value, options } of list) {
              store.set(name, value, options);
            }
          } catch {
            // Server Component 里 store.set 会抛错（cookie 只读）。
            // 这是预期行为：会话刷新交给 src/proxy.ts 的 updateSession 处理。
          }
        },
      },
    },
  );
}
