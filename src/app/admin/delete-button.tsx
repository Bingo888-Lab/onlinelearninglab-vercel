"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ documentId, title }: { documentId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        data-testid="delete-doc"
        className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
      >
        删除
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">确定删除「{title}」？</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        data-testid="delete-confirm"
        className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-50"
      >
        {busy ? "删除中…" : "确认"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      >
        取消
      </button>
    </span>
  );
}
