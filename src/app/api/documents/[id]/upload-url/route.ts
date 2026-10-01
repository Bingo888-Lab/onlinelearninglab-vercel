import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { presignPut } from "@/lib/r2";
import { buildObjectKey } from "@/lib/r2-keys";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // path 与 body 的 id 必须一致，否则客户端会签到它没打算上传的 key
  const bodyId = (body as { id?: unknown })?.id;
  if (bodyId !== id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const objectKey = buildObjectKey(id);

  // Existing records must not receive another write URL. This check reduces overwrite risk,
  // but cannot revoke prior URLs or close the race between this lookup and signing.
  let existing: { id: string } | null;
  let queryError: unknown;
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase
      .from("documents")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    existing = result.data;
    queryError = result.error;
  } catch {
    existing = null;
    queryError = true;
  }
  if (queryError) {
    console.error("document upload lookup failed", { operation: "upload_url_lookup", code: "query_failed", documentId: id });
    return NextResponse.json({ error: "query_failed" }, { status: 502 });
  }
  if (existing) return NextResponse.json({ error: "document_exists" }, { status: 409 });

  try {
    const url = await presignPut(objectKey);
    return NextResponse.json({ url, objectKey });
  } catch {
    console.error("presignPut failed", { operation: "upload_url_sign", code: "sign_failed", documentId: id });
    return NextResponse.json({ error: "sign_failed" }, { status: 502 });
  }
}
