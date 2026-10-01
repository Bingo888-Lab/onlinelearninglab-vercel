"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { configuredUploadLimit, requestSignedUploadUrl, runUploadPipeline, saveDocumentMetadata, validateUploadFile } from "./upload-action";

const PDF_CONTENT_TYPE = "application/pdf";
const UPLOAD_LIMIT_BYTES = configuredUploadLimit(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);

type Phase = "idle" | "signing" | "uploading" | "saving" | "done";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  signing: "获取上传链接…",
  uploading: "上传中",
  saving: "保存元数据…",
  done: "上传完成",
};
/** XHR 而非 fetch：只有 XHR 有 upload progress 事件 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // 必须与预签名时绑定的 Content-Type 完全一致，否则 R2 返回 SignatureDoesNotMatch
    xhr.setRequestHeader("Content-Type", PDF_CONTENT_TYPE);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("R2 upload failed"));
    xhr.send(file);
  });
}

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const busy = phase !== "idle" && phase !== "done";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("请选择一个 PDF 文件");
      return;
    }

    // 前置拦截，别浪费一次往返
    const fileError = validateUploadFile(file, UPLOAD_LIMIT_BYTES);
    if (fileError) {
      setError(fileError);
      return;
    }

    let id: string;
    try { id = crypto.randomUUID(); } catch {
      setError("无法开始上传，请刷新页面后重试");
      return;
    }
    await runUploadPipeline(busyRef, file, id, {
      sign: uploadId => requestSignedUploadUrl(fetch, uploadId), put: putWithProgress,
      save: (uploadId, uploadFile) => saveDocumentMetadata(fetch, uploadId, uploadFile),
    }, { phase: setPhase, progress: setPercent, start: () => { setError(null); setPercent(0); }, finish: () => {}, error: setError,
      success: () => { if (inputRef.current) inputRef.current.value = ""; try { router.refresh(); } catch { /* save confirmed */ } },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="upload-form">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        data-testid="file-input"
        className="block w-full text-sm"
      />

      {phase !== "idle" && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-valuenow={percent}
            data-testid="upload-progress"
            className="h-2 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
          >
            <div className="h-full bg-neutral-900 transition-all dark:bg-neutral-100" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-neutral-500">
            {phase === "uploading" ? `${PHASE_LABEL[phase]} ${percent}%` : PHASE_LABEL[phase]}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" data-testid="upload-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        data-testid="upload-submit"
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        上传 PDF
      </button>
    </form>
  );
}
