import { runClientAction } from "@/lib/client-action";
import { InviteCodeInput } from "@/lib/validation";

function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" ? value as Record<string, unknown> : null; }
export function createInvite(lock: { current: boolean }, fetcher: typeof fetch, values: { code: string; maxUses: number }, callbacks: { start(): void; finish(): void; error(message: string): void; success(): void }) {
  const parsedCode = InviteCodeInput.safeParse(values.code);
  if (!parsedCode.success) {
    callbacks.error("请检查邀请码（去除首尾空格后 4–40 个字符）");
    return Promise.resolve(false);
  }
  const parsedValues = { ...values, code: parsedCode.data };
  return runClientAction(lock, async () => {
    const response = await fetcher("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsedValues) });
    let body: unknown; try { body = await response.json(); } catch { body = null; }
    if (!response.ok) return { ok: false as const };
    if (record(body)?.code !== parsedCode.data) return { ok: false as const };
    return { ok: true as const };
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => callbacks.error("创建失败，请检查网络后重试"), onSuccess: result => result.ok ? callbacks.success() : callbacks.error("创建结果未能确认，请核对邀请码列表后重试") });
}

export function updateInvite(lock: { current: boolean }, fetcher: typeof fetch, method: "PATCH" | "DELETE", code: string, body: unknown, callbacks: { start(): void; finish(): void; error(message: string): void; success(): void }) {
  return runClientAction(lock, async () => {
    const response = await fetcher(`/api/invites/${encodeURIComponent(code)}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) return false;
    let result: unknown; try { result = await response.json(); } catch { return false; }
    return record(result)?.code === code;
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => callbacks.error("操作失败，请检查网络后重试"), onSuccess: ok => ok ? callbacks.success() : callbacks.error("操作结果未能确认，请核对邀请码列表后重试") });
}
