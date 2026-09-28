import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvitePatchBody } from "@/lib/validation";

const CODE_RE = /^[A-Za-z0-9_-]{4,40}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const { code } = await params;
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = InvitePatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.maxUses !== undefined) patch.max_uses = parsed.data.maxUses;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .update(patch)
    .eq("code", code)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
  return NextResponse.json(data);
}

/**
 * 禁用而非删行 —— 保留 used_count 与历史，作为「这个码存在且已停用」的证据。
 * 真的想彻底清除只能去 Dashboard 手删，v0.1.0 不提供。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const { code } = await params;
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .update({ is_active: false })
    .eq("code", code)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
  return NextResponse.json(data);
}
