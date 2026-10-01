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

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  let lookup: {
    data: { id: string; object_key: string } | null;
    error: { code?: string } | null;
  };
  try {
    supabase = await createServerSupabaseClient();
    lookup = await supabase
      .from("documents")
      .select("id, object_key")
      .eq("id", id)
      .maybeSingle();
  } catch {
    console.error("document query failed", { operation: "document_delete_lookup", code: "query_failed", documentId: id });
    return NextResponse.json({ error: "query_failed" }, { status: 502 });
  }
  const { data, error } = lookup;

  if (error) {
    console.error("document query failed", { operation: "document_delete_lookup", code: "query_failed", documentId: id });
    return NextResponse.json({ error: "query_failed" }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // R2 deletion is confirmed. If DB deletion fails or its result is unknown, a row may
  // remain and requires manual review; `orphan: true` signals a possible partial state.
  try {
    await deleteObject(data.object_key);
  } catch {
    console.error("R2 delete failed", { operation: "document_delete_r2", code: "r2_delete_failed", documentId: id });
    return NextResponse.json({ error: "r2_delete_failed" }, { status: 502 });
  }

  let dbDeleteFailed = false;
  try {
    const { error: dbError } = await supabase.from("documents").delete().eq("id", id);
    dbDeleteFailed = Boolean(dbError);
  } catch {
    dbDeleteFailed = true;
  }
  if (dbDeleteFailed) {
    // R2 is gone; DB deletion failed or its outcome is unknown. Log only stable identifiers.
    console.error("document DB delete failed after R2 delete", { operation: "document_delete_db", code: "db_delete_failed", documentId: id });
    return NextResponse.json({ error: "db_delete_failed", orphan: true }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
