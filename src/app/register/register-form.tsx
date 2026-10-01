"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRegistrationMessage } from "./registration-message";
import { EmailInput, PasswordInput, InviteCodeInput } from "@/lib/validation";
import { submitRegistration } from "./register-action";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    if (!EmailInput.safeParse(email).success || !PasswordInput.safeParse(password).success || !InviteCodeInput.safeParse(inviteCode).success) {
      setError("请检查邮箱、密码（至少 8 位且最多 72 个 UTF-8 字节）与邀请码格式");
      return;
    }
    await submitRegistration(busyRef, fetch, { email, password, inviteCode }, {
      start: () => { setBusy(true); setError(null); }, finish: () => setBusy(false), error: setError,
      success: needsConfirmation => { setNeedsEmailConfirmation(needsConfirmation); setDone(true); },
    });
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4" data-testid="register-done">
        {(() => {
          const message = getRegistrationMessage(needsEmailConfirmation, email);
          return (
            <>
              <h1 className="text-2xl font-semibold">{message.title}</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{message.body}</p>
            </>
          );
        })()}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full rounded bg-neutral-900 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          前往登录
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" data-testid="register-form">
      <h1 className="text-2xl font-semibold">注册</h1>

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
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">密码（至少 8 位）</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          data-testid="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">邀请码</span>
        <input
          required
          minLength={4}
          data-testid="invite-code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {error && (
        <p role="alert" data-testid="register-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        data-testid="register-submit"
        className="w-full rounded bg-neutral-900 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {busy ? "提交中…" : "注册"}
      </button>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        已有账号？{" "}
        <Link href="/login" className="underline">
          登录
        </Link>
      </p>
    </form>
  );
}
