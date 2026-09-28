import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { RegisterBody } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = RegisterBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password, inviteCode } = parsed.data;
  const admin = createAdminClient();

  // Atomic RPC: concurrent requests cannot over-consume the same invite.
  const { data: consumed, error: consumeError } = await admin.rpc("consume_invite_code", {
    p_code: inviteCode,
  });

  // Same response for missing / exhausted / expired / disabled / RPC failure:
  // distinguishing these states would create an invite-code existence oracle.
  if (consumeError || !consumed) {
    return NextResponse.json({ error: "invite_invalid" }, { status: 400 });
  }

  // Public client: the service-role client would swallow the "user already exists"
  // signal and would not send the confirmation email.
  const auth = createBrowserSupabaseClient();
  const emailRedirectTo = new URL("/auth/confirm", new URL(request.url).origin).toString();

  const { data, error } = await auth.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  // With confirmation enabled, signUp sends the email and returns session=null.
  // With auto-confirm enabled, signUp returns a session. Supabase may hide duplicate
  // email status by returning an empty identities array.
  const duplicateHidden = data.user?.identities?.length === 0;
  if (error || !data.user || duplicateHidden) {
    const { error: refundError } = await admin.rpc("refund_invite_code", { p_code: inviteCode });
    if (refundError) console.error("refund_invite_code failed", { refundError });
    return NextResponse.json({ error: "signup_failed" }, { status: 502 });
  }

  return NextResponse.json({ needsEmailConfirmation: !data.session }, { status: 201 });
}

