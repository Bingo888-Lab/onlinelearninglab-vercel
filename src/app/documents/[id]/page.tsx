import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { presignGet } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReaderFrame from "./reader-frame";
import { queryPage } from "@/lib/page-query-state";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireUser();
  if (!guard.ok) return null; // proxy.ts 已重定向

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const result = await queryPage(() => supabase
    .from("documents")
    .select("id, title, object_key")
    .eq("id", id)
    .maybeSingle());

  if (result.status === "error") {
    return <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800"><Link href="/" className="text-sm underline">← 返回列表</Link></div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3" role="alert"><p className="text-neutral-600 dark:text-neutral-400">资料加载失败，请重新加载后重试。</p><Link href={`/documents/${id}`} className="rounded border border-neutral-300 px-4 py-2 dark:border-neutral-700">重新加载</Link></div>
    </div>;
  }
  const doc = result.data;
  if (!doc) notFound();

  // 签名失败不致命：交给 ReaderFrame 的刷新按钮重试
  const url = await presignGet(doc.object_key).catch(() => null);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <Link href="/" className="text-sm underline">
          ← 返回列表
        </Link>
      </div>
      {url ? (
        <ReaderFrame documentId={doc.id} title={doc.title} initialUrl={url} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3" data-testid="sign-failed">
          <p className="text-neutral-600 dark:text-neutral-400">链接生成失败</p>
          <Link
            href={`/documents/${doc.id}`}
            className="rounded border border-neutral-300 px-4 py-2 dark:border-neutral-700"
          >
            重新加载
          </Link>
        </div>
      )}
    </div>
  );
}
