"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/safe-next";
import { submitLogin } from "./login-action";

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    await submitLogin(busyRef, async () => {
      const { error: err } = await createClient().auth.signInWithPassword({ email, password });
      return { error: err };
    }, () => { try { router.push(getSafeNextPath(next, window.location.origin)); router.refresh(); } catch { /* login confirmed; navigation can be retried by the user */ } }, {
      start: () => { setBusy(true); setError(null); }, finish: () => setBusy(false), error: setError,
    });
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" data-testid="login-form">
      <h1 className="text-2xl font-semibold">登录</h1>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">邮箱</span>
        <input
          type="email"
          required
          autoComplete="email"
          data-testid="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">密码</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          data-testid="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {error && (
        <p role="alert" data-testid="login-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        data-testid="login-submit"
        className="w-full rounded bg-neutral-900 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {busy ? "登录中…" : "登录"}
      </button>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        有邀请码？{" "}
        <Link href="/register" className="underline">
          注册
        </Link>
      </p>
    </form>
  );
}
