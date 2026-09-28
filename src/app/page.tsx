import Link from "next/link";
import { requireUser } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; size_bytes: number; created_at: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const guard = await requireUser();
  if (!guard.ok) return null; // proxy.ts 已重定向，这只是兜底

  const q = (await searchParams).q?.trim() ?? "";
  const supabase = await createServerSupabaseClient();

  const query = supabase
    .from("documents")
    .select("id, title, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data } = q ? await query.ilike("title", `%${q}%`) : await query;
  const docs = (data ?? []) as Row[];

  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <Link href="/" className="font-semibold">
          OnlineLearningLab
        </Link>
        <div className="flex items-center gap-4">
          {guard.role === "admin" && (
            <Link href="/admin" data-testid="nav-admin" className="text-sm underline">
              管理
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <form method="get" className="mb-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜索文件名…"
            data-testid="search"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button type="submit" className="rounded border border-neutral-300 px-4 py-2 dark:border-neutral-700">
            搜索
          </button>
        </form>

        {docs.length === 0 ? (
          <p data-testid="empty" className="text-neutral-600 dark:text-neutral-400">
            {q ? "没有匹配的资料" : "还没有资料，上传第一份 PDF 吧"}
          </p>
        ) : (
          <ul className="space-y-2" data-testid="doc-list">
            {docs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  data-testid="doc-item"
                  className="flex items-center justify-between rounded border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span className="truncate">{d.title}</span>
                  <span className="ml-4 shrink-0 text-sm text-neutral-500">
                    {formatSize(d.size_bytes)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
