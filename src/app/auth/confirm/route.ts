import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
  "phone_change",
]);
const SAFE_NEXT = /^\/(?![\\/])/;

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

  // Only allow an internal path. Reject `//evil`, backslash variants and full URLs.
  const next = url.searchParams.get("next") ?? "/";
  const destination = SAFE_NEXT.test(next) ? new URL(next, url.origin) : new URL("/", url.origin);
  return NextResponse.redirect(destination);
}
