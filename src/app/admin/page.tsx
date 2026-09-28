import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UploadForm from "./upload-form";
import { InviteCreateForm, InviteList, type InviteRow } from "./invite-forms";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

type Doc = { id: string; title: string; size_bytes: number };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AdminPage() {
  const guard = await requireAdmin();
  // student 访问 /admin → 回首页，不给 403 页面（信息量相同，体验更好）
  if (!guard.ok) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, size_bytes")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: invites } = await createAdminClient()
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <Link href="/" className="font-semibold">
          OnlineLearningLab
        </Link>
        <Link href="/" className="text-sm underline">
          返回列表
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">上传 PDF</h2>
          <UploadForm />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">已有资料</h2>
          {(docs ?? []).length === 0 ? (
            <p data-testid="admin-empty" className="text-sm text-neutral-600 dark:text-neutral-400">
              还没有资料
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800" data-testid="admin-doc-list">
              {(docs as Doc[]).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2" data-testid="admin-doc-item">
                  <Link href={`/documents/${d.id}`} className="truncate underline">
                    {d.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="shrink-0 text-sm text-neutral-500">{formatSize(d.size_bytes)}</span>
                    <DeleteButton documentId={d.id} title={d.title} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">邀请码</h2>
          <InviteCreateForm />
          <div className="mt-4">
            <InviteList invites={(invites ?? []) as InviteRow[]} />
          </div>
        </section>
      </main>
    </>
  );
}
