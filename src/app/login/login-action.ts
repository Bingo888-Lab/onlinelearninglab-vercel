import { runClientAction } from "@/lib/client-action";

export async function submitLogin(lock: { current: boolean }, signIn: () => Promise<{ error: unknown | null }>, navigate: () => void, callbacks: { start(): void; finish(): void; error(message: string): void }) {
  return runClientAction(lock, async () => {
    try {
      const result = await signIn();
      return result.error ? { ok: false as const, message: "邮箱或密码不正确" } : { ok: true as const };
    } catch {
      return { ok: false as const, message: "登录暂时不可用，请检查网络后重试" };
    }
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => callbacks.error("登录暂时不可用，请检查网络后重试"), onSuccess: result => result.ok ? navigate() : callbacks.error(result.message) });
}
