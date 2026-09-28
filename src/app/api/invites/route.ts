import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteBody } from "@/lib/validation";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  // invite_codes 的 RLS 完全不对客户端开放，只能走 service_role
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 502 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const parsed = InviteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { code, maxUses, expiresAt } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .insert({
      code,
      max_uses: maxUses,
      expires_at: expiresAt ?? null,
      created_by: guard.userId,
    })
    .select()
    .single();

  // 23505 = unique 违规，即 code 已存在。不单独报 conflict，502 足够前端提示
  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }
  return NextResponse.json(data, { status: 201 });
}
