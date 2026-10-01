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
  const correlationId = crypto.randomUUID();
  const trackedFailure = (error: string, status: number) =>
    NextResponse.json({ error }, { status, headers: { "X-Request-ID": correlationId } });

  // Atomic RPC: concurrent requests cannot over-consume the same invite.
  let consumed: boolean | null = null;
  let consumeError: unknown = null;
  try {
    const admin = createAdminClient();
    const result = await admin.rpc("consume_invite_code", { p_code: inviteCode });
    consumed = result.data;
    consumeError = result.error;
  } catch {
    consumeError = true;
  }

  // Same response for missing / exhausted / expired / disabled / RPC failure:
  // distinguishing these states would create an invite-code existence oracle.
  if (consumeError) {
    console.error("invite consume outcome unknown", { operation: "invite_consume", code: "consume_outcome_unknown", correlationId });
    return trackedFailure("invite_invalid", 400);
  }
  if (!consumed) {
    return trackedFailure("invite_invalid", 400);
  }

  // Public client: the service-role client would swallow the "user already exists"
  // signal and would not send the confirmation email.
  const emailRedirectTo = new URL("/auth/confirm", new URL(request.url).origin).toString();

  let signupResult: Awaited<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["auth"]["signUp"]>>;
  try {
    const auth = createBrowserSupabaseClient();
    signupResult = await auth.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
  } catch {
    // A thrown transport/SDK error does not establish whether Auth created the account.
    // Keep the atomic invite consumption for manual correlation; a blind refund could
    // issue capacity for an account that actually exists.
    console.error("signup outcome unknown", { operation: "signup_outcome_unknown", code: "signup_outcome_unknown", correlationId });
    return trackedFailure("signup_failed", 502);
  }
  const { data, error } = signupResult;

  // With confirmation enabled, signUp sends the email and returns session=null.
  // With auto-confirm enabled, signUp returns a session. Supabase may hide duplicate
  // email status by returning an empty identities array.
  const hasUser = Boolean(data?.user);
  const hasSession = Boolean(data?.session);
  const hasHiddenDuplicateSignal = hasUser && data.user?.identities?.length === 0;
  const duplicateHidden = !error && !hasSession && hasHiddenDuplicateSignal;
  const authError = error as { status?: unknown; code?: unknown } | null;
  const trustedBusinessRejection =
    typeof authError?.status === "number" &&
    Number.isInteger(authError.status) &&
    authError.status >= 400 && authError.status < 500 &&
    typeof authError.code === "string" &&
    ["weak_password", "email_exists", "signup_disabled"].includes(authError.code);

  const knownBusinessRejection = !hasUser && !hasSession && trustedBusinessRejection;
  const contradictoryOutcome =
    (hasHiddenDuplicateSignal && (Boolean(error) || hasSession)) ||
    (trustedBusinessRejection && (hasUser || hasSession));

  if (duplicateHidden || knownBusinessRejection) {
    try {
      const { error: refundError } = await createAdminClient().rpc("refund_invite_code", { p_code: inviteCode });
      if (refundError) {
        console.error("invite refund failed", { operation: "invite_refund", code: "refund_failed", correlationId });
      }
    } catch {
      // The account failure is known, but compensation failed; do not leak SDK data or throw.
      console.error("invite refund failed", { operation: "invite_refund", code: "refund_failed", correlationId });
    }
    console.error("signup failed", { operation: "signup", code: "signup_failed", correlationId });
    return trackedFailure("signup_failed", 502);
  }

  if (error || !hasUser || contradictoryOutcome) {
    // Retryable, unclassified, missing-code, and contradictory Auth results may have
    // created an account. Keep the consumed invite for manual correlation; never retry.
    console.error("signup outcome unknown", { operation: "signup_outcome_unknown", code: "signup_outcome_unknown", correlationId });
    return trackedFailure("signup_failed", 502);
  }

  return NextResponse.json({ needsEmailConfirmation: !data.session }, { status: 201 });
}

