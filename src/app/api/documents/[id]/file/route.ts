import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { presignGet } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL = () => Number(process.env.R2_SIGN_TTL_SECONDS ?? 300);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
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

  // 签名 URL 就是凭据：只出现在 200 的 body 里，绝不进日志或错误体
  try {
    const url = await presignGet(data.object_key);
    return NextResponse.json({ url, expiresAt: Date.now() + TTL() * 1000 });
  } catch (err) {
    console.error("presignGet failed", { documentId: id, err });
    return NextResponse.json({ error: "sign_failed" }, { status: 502 });
  }
}
