"use client";

import { useState, useCallback } from "react";

export default function ReaderFrame({
  documentId,
  title,
  initialUrl,
}: {
  documentId: string;
  title: string;
  initialUrl: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [refreshing, setRefreshing] = useState(false);

  // 预签名 URL 会过期。iframe 首次加载后浏览器已缓存整个 PDF，长阅读不受影响；
  // 只有「新开页面 / 刷新」时才可能撞上过期，这时换一张新签名即可。
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/file`, { cache: "no-store" });
      if (res.ok) {
        const { url: next } = (await res.json()) as { url: string };
        setUrl(next);
      }
    } finally {
      setRefreshing(false);
    }
  }, [documentId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          data-testid="refresh-link"
          className="shrink-0 rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
        >
          {refreshing ? "刷新中…" : "链接已过期？刷新"}
        </button>
      </div>
      <iframe
        src={url}
        title={title}
        data-testid="pdf-frame"
        className="min-h-0 w-full flex-1"
      />
    </div>
  );
}
