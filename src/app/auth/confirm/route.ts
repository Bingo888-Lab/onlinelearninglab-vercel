import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeNextPath } from "@/lib/safe-next";

const OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
  "phone_change",
]);
function loginFailure(origin: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", "confirmation_failed");
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return loginFailure(url.origin);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email" | "phone_change",
  });

  if (error) return loginFailure(url.origin);

  const next = url.searchParams.get("next") ?? "/";
  const destination = new URL(getSafeNextPath(next, url.origin), url.origin);
  return NextResponse.redirect(destination);
}
