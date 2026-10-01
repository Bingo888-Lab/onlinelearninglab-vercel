import { runClientAction } from "@/lib/client-action";

export function deleteDocument(lock: { current: boolean }, fetcher: typeof fetch, url: string, callbacks: { start(): void; finish(): void; error(message: string): void; success(): void }) {
  return runClientAction(lock, async () => {
    const response = await fetcher(url, { method: "DELETE" });
    let body: unknown = null;
    try { body = await response.json(); } catch { /* response is unconfirmed */ }
    const data = body !== null && typeof body === "object" ? body as Record<string, unknown> : null;
    if (!response.ok) return { ok: false as const, message: data?.error === "db_delete_failed" ? "文件已删除，但记录待管理员核对。请核对列表后再重试。" : "删除结果未能确认，请核对列表后再重试。网络中断时文件可能已删除。" };
    if (data?.ok !== true) return { ok: false as const, message: "删除结果未能确认，请核对列表后再重试。网络中断时文件可能已删除。" };
    return { ok: true as const };
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => callbacks.error("删除结果未能确认，请核对列表后再重试。网络中断时文件可能已删除。"), onSuccess: result => result.ok ? callbacks.success() : callbacks.error(result.message) });
}
