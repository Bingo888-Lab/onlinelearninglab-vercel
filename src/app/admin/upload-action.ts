import { runClientAction } from "@/lib/client-action";
import { getUploadLimitBytes } from "@/lib/upload-limit";
import { isSafeHttpsUrl } from "@/lib/client-url";

export type UploadFileInfo = { name: string; size: number; type: string };
export function validateUploadFile(file: UploadFileInfo, maxBytes: number): string | null {
  if (file.type !== "application/pdf") return "只接受 PDF 文件";
  if (file.size > maxBytes) return `文件超过 ${maxBytes / (1024 * 1024)} MB 上限`;
  return null;
}
export function configuredUploadLimit(value: string | undefined): number { return getUploadLimitBytes(value); }
export function parseSignedUploadUrl(value: unknown): string {
  if (!isSafeHttpsUrl(value)) throw new Error("sign");
  return value;
}
export async function requestSignedUploadUrl(fetcher: typeof fetch, id: string): Promise<string> {
  const response = await fetcher(`/api/documents/${id}/upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  if (!response.ok) throw new Error("sign");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("sign");
  return parseSignedUploadUrl((payload as { url?: unknown }).url);
}

export async function saveDocumentMetadata(fetcher: typeof fetch, id: string, file: UploadFileInfo): Promise<void> {
  const response = await fetcher("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: file.name, sizeBytes: file.size }) });
  if (!response.ok) throw new Error("metadata");
  const saved: unknown = await response.json();
  if (!saved || typeof saved !== "object" || (saved as { id?: unknown }).id !== id) throw new Error("metadata");
}

export function runUploadPipeline<TFile extends UploadFileInfo>(lock: { current: boolean }, file: TFile, id: string, dependencies: {
  sign(id: string): Promise<string>; put(url: string, file: TFile, progress: (value: number) => void): Promise<void>;
  save(id: string, file: TFile): Promise<void>;
}, callbacks: { phase(value: "signing" | "uploading" | "saving" | "done" | "idle"): void; progress(value: number): void; start(): void; finish(): void; error(message: string): void; success(): void }) {
  let saving = false;
  return runClientAction(lock, async () => {
    callbacks.phase("signing");
    const url = await dependencies.sign(id);
    callbacks.phase("uploading"); callbacks.progress(0);
    await dependencies.put(url, file, callbacks.progress);
    callbacks.phase("saving"); saving = true;
    await dependencies.save(id, file);
    return true;
  }, { onStart: callbacks.start, onFinally: callbacks.finish, onError: () => {
    callbacks.error(saving ? `文件已上传，但元数据保存结果未确认（文档 ID：${id}）。请核对管理列表或联系管理员；请勿直接重新上传。` : "上传失败，请检查网络后重试");
    callbacks.phase("idle");
  }, onSuccess: () => { callbacks.phase("done"); callbacks.progress(100); callbacks.success(); } });
}
