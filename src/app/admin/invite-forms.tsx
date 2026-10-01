"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InviteCodeInput } from "@/lib/validation";
import { createInvite, updateInvite } from "./invite-action";

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
  const busyRef = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    if (!InviteCodeInput.safeParse(code).success || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) {
      setError("请检查邀请码（去除首尾空格后 4–40 个字符）和可用次数");
      return;
    }
    await createInvite(busyRef, fetch, { code, maxUses }, {
      start: () => { setBusy(true); setError(null); }, finish: () => setBusy(false), error: setError,
      success: () => { setCode(""); try { router.refresh(); } catch { /* create confirmed */ } },
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" data-testid="invite-form">
      <label className="text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">代码</span>
        <input
          required
          minLength={4}
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
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function act(method: "PATCH" | "DELETE", code: string, body?: unknown) {
    if (busyRef.current) return;
    await updateInvite(busyRef, fetch, method, code, body, {
      start: () => { setBusyCode(code); setError(null); }, finish: () => setBusyCode(null), error: setError,
      success: () => { setError(null); try { router.refresh(); } catch { /* mutation confirmed */ } },
    });
  }

  if (invites.length === 0) {
    return <div>{error && <p role="alert" className="py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}<p className="text-sm text-neutral-600 dark:text-neutral-400">还没有邀请码</p></div>;
  }

  return (
    <div>{error && <p role="alert" className="py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}<ul className="divide-y divide-neutral-200 dark:divide-neutral-800" data-testid="invite-list">
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
                disabled={busyCode !== null}
                className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
              >
                +5 次
              </button>
              {i.is_active ? (
                <button
                  type="button"
                  onClick={() => act("DELETE", i.code)}
                  data-testid="invite-disable"
                  disabled={busyCode !== null}
                  className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
                >
                  禁用
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => act("PATCH", i.code, { isActive: true })}
                  disabled={busyCode !== null}
                  className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
                >
                  启用
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul></div>
  );
}
