"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/safe-next";

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (err) {
      // 不区分「邮箱不存在」与「密码错误」——不提供账号枚举接口
      setError("邮箱或密码不正确");
      return;
    }
    router.push(getSafeNextPath(next, window.location.origin));
    router.refresh();
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
