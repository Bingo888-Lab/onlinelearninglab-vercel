import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { presignPut } from "@/lib/r2";
import { buildObjectKey } from "@/lib/r2-keys";

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

  try {
    const url = await presignPut(objectKey);
    return NextResponse.json({ url, objectKey });
  } catch (err) {
    console.error("presignPut failed", { documentId: id, err });
    return NextResponse.json({ error: "sign_failed" }, { status: 502 });
  }
}
