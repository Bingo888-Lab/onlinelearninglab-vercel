"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const PDF_CONTENT_TYPE = "application/pdf";
const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);

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

  const busy = phase !== "idle" && phase !== "done";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("请选择一个 PDF 文件");
      return;
    }

    // 前置拦截，别浪费一次往返
    if (file.type !== PDF_CONTENT_TYPE) {
      setError("只接受 PDF 文件");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`文件超过 ${MAX_MB} MB 上限`);
      return;
    }

    setError(null);
    setPercent(0);
    const id = crypto.randomUUID();

    try {
      setPhase("signing");
      const signRes = await fetch(`/api/documents/${id}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!signRes.ok) throw new Error("获取上传链接失败");
      const { url } = (await signRes.json()) as { url: string };

      setPhase("uploading");
      setPercent(0);
      await putWithProgress(url, file, setPercent);

      setPhase("saving");
      const saveRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: file.name, sizeBytes: file.size }),
      });
      if (!saveRes.ok) throw new Error("保存元数据失败");

      setPhase("done");
      setPercent(100);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setPhase("idle");
    }
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
