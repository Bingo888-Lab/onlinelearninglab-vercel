import { runClientAction } from "@/lib/client-action";

const uncertain = "注册结果未能确认，请先检查邮箱并尝试登录；如仍无法确认，请联系管理员，不要立即重复提交";
type ResponseLike = { status: number; json(): Promise<unknown>; headers?: { get(name: string): string | null } };
type Callbacks = { start(): void; finish(): void; error(message: string): void; success(needsEmailConfirmation: boolean): void };
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uncertainFor(response?: ResponseLike): string {
  const requestId = response?.headers?.get("X-Request-ID");
  return `${uncertain}${requestId && REQUEST_ID.test(requestId) ? `（支持编号：${requestId}）` : ""}`;
}

export function submitRegistration(
  lock: { current: boolean }, fetcher: typeof fetch,
  values: { email: string; password: string; inviteCode: string }, callbacks: Callbacks,
): Promise<boolean> {
  return runClientAction(lock, async () => {
    let response: ResponseLike | undefined;
    try {
      response = await fetcher("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const body = await response.json();
      if (response.status === 201) {
        const payload = object(body);
        if (typeof payload?.needsEmailConfirmation !== "boolean") throw new Error("uncertain");
        return { confirmed: true as const, needsEmailConfirmation: payload.needsEmailConfirmation };
      }
      const payload = object(body);
      const message = payload?.error === "invite_invalid" ? "邀请码无效或已过期" : payload?.error === "invalid_input" ? "请检查邮箱与密码格式" : uncertainFor(response);
      return { confirmed: false as const, message };
    } catch {
      return { confirmed: false as const, message: uncertainFor(response) };
    }
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => callbacks.error(uncertain), onSuccess: result => {
    if (result.confirmed) callbacks.success(result.needsEmailConfirmation);
    else callbacks.error(result.message);
  } });
}
