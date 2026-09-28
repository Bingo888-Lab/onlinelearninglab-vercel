import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteObject } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, object_key")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 顺序：先 R2 后 DB。R2 失败则 DB 行保留（不会出现「DB 说有、文件没了」）；
  // 反过来 DB 失败只会留下一个孤儿对象，代价远小于前者。
  try {
    await deleteObject(data.object_key);
  } catch (err) {
    console.error("R2 delete failed, DB row kept", { documentId: id, err });
    return NextResponse.json({ error: "r2_delete_failed" }, { status: 502 });
  }

  const { error: dbError } = await supabase.from("documents").delete().eq("id", id);
  if (dbError) {
    // R2 已删、DB 还在 = 孤儿行。日志带 key 供人工清理。
    console.error("ORPHAN: R2 object deleted but DB row remains", {
      documentId: id,
      objectKey: data.object_key,
      err: dbError,
    });
    return NextResponse.json({ error: "db_delete_failed", orphan: true }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
