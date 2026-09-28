import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegisterBody } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = RegisterBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password, inviteCode } = parsed.data;
  const admin = createAdminClient();

  // 原子 RPC：并发下两个请求抢同一个码也只有一个能成功（WHERE 内判定 + UPDATE）
  const { data: consumed, error: consumeError } = await admin.rpc("consume_invite_code", {
    p_code: inviteCode,
  });

  // 码不存在 / 已用尽 / 已过期 / 已禁用 / RPC 挂了 —— 一律同一个响应。
  // 区分开就等于给攻击者一个「码是否存在」的探测接口。
  if (consumeError || !consumed) {
    return NextResponse.json({ error: "invite_invalid" }, { status: 400 });
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError) {
    // 建号失败但次数已扣：退还，避免有效码被白嫖（风险 R2）
    const { error: refundError } = await admin.rpc("refund_invite_code", { p_code: inviteCode });
    if (refundError) {
      console.error("refund_invite_code failed", { inviteCode, refundError });
    }
    return NextResponse.json({ error: "signup_failed" }, { status: 502 });
  }

  // 201 之后前端跳 /login 并提示查收确认邮件；测试 Supabase 关闭了确认，
  // email_confirm:false 依然会建出未验证用户，由测试脚本直接放行。
  return NextResponse.json({ needsEmailConfirmation: true }, { status: 201 });
}
