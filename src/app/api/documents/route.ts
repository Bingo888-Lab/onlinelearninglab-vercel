import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { headObject } from "@/lib/r2";
import { buildObjectKey, PDF_CONTENT_TYPE } from "@/lib/r2-keys";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DocumentBody } from "@/lib/validation";

const LIST_LIMIT = 200;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const parsed = DocumentBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { id, title, sizeBytes } = parsed.data;
  const key = buildObjectKey(id);

  // 客户端 PUT 之后服务端核验：对象必须真的存在，且与上报的大小/类型一致
  let head;
  try {
    head = await headObject(key);
  } catch {
    return NextResponse.json({ error: "object_missing" }, { status: 400 });
  }
  if (head.ContentType !== PDF_CONTENT_TYPE) {
    return NextResponse.json({ error: "content_type_mismatch" }, { status: 400 });
  }
  if (head.ContentLength !== sizeBytes) {
    return NextResponse.json({ error: "size_mismatch" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      id,
      title,
      object_key: key,
      size_bytes: sizeBytes,
      uploaded_by: guard.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const supabase = await createServerSupabaseClient();

  const { data, error } = q
    ? await supabase
        .from("documents")
        .select("*")
        .ilike("title", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT)
    : await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 502 });
  }
  return NextResponse.json(data);
}
