"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type InviteRow = {
  code: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

export function InviteCreateForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, maxUses }),
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.status === 502 ? "创建失败，代码可能已存在" : "创建失败");
      return;
    }
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" data-testid="invite-form">
      <label className="text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">代码</span>
        <input
          required
          minLength={4}
          maxLength={40}
          data-testid="invite-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">可用次数</span>
        <input
          type="number"
          min={1}
          required
          data-testid="invite-maxuses"
          value={maxUses}
          onChange={(e) => setMaxUses(Number(e.target.value))}
          className="w-24 rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        data-testid="invite-submit"
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        创建
      </button>
      {error && (
        <p role="alert" data-testid="invite-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

export function InviteList({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();

  async function act(method: "PATCH" | "DELETE", code: string, body?: unknown) {
    await fetch(`/api/invites/${encodeURIComponent(code)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    router.refresh();
  }

  if (invites.length === 0) {
    return <p className="text-sm text-neutral-600 dark:text-neutral-400">还没有邀请码</p>;
  }

  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800" data-testid="invite-list">
      {invites.map((i) => {
        const expired = i.expires_at !== null && new Date(i.expires_at) < new Date();
        const exhausted = i.used_count >= i.max_uses;
        return (
          <li key={i.code} className="flex items-center justify-between py-2 text-sm" data-testid="invite-item">
            <div>
              <code className="font-mono">{i.code}</code>
              <span className="ml-3 text-neutral-500">
                {i.used_count}/{i.max_uses}
                {expired && " · 已过期"}
                {!i.is_active && " · 已禁用"}
                {exhausted && !expired && " · 已用尽"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => act("PATCH", i.code, { maxUses: i.max_uses + 5 })}
                className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
              >
                +5 次
              </button>
              {i.is_active ? (
                <button
                  type="button"
                  onClick={() => act("DELETE", i.code)}
                  data-testid="invite-disable"
                  className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
                >
                  禁用
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => act("PATCH", i.code, { isActive: true })}
                  className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
                >
                  启用
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
