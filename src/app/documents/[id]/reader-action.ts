import { runClientAction } from "@/lib/client-action";
import { isSafeHttpsUrl } from "@/lib/client-url";

export function refreshReaderUrl(lock: { current: boolean }, fetcher: typeof fetch, endpoint: string, callbacks: { start(): void; finish(): void; error(): void; success(url: string): void }) {
  return runClientAction(lock, async () => {
    const response = await fetcher(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("request");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !isSafeHttpsUrl((data as { url?: unknown }).url)) throw new Error("payload");
    return (data as { url: string }).url;
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: callbacks.error, onSuccess: callbacks.success });
}
