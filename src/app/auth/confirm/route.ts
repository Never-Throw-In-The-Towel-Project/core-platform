import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { resolveLandingPath } from "@/lib/auth/landing";

// The token-hash verify landing for the branded auth emails (the send-email
// hook builds links to here). Mirrors /auth/callback, but verifies a one-time
// token_hash (OTP) rather than exchanging a PKCE code -- which lets the email
// link live on our own domain instead of Supabase's /auth/v1/verify.
const VALID_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const requestedNext = searchParams.get("next");
  const next = requestedNext && isSafeRedirectPath(requestedNext) ? requestedNext : null;

  if (tokenHash && type && VALID_TYPES.includes(type as EmailOtpType)) {
    // Wrapped in try/catch for the same reason as /auth/callback: createClient()
    // throws synchronously on a missing/malformed URL/key, and verifyOtp can
    // re-throw a non-AuthError -- both would otherwise crash instead of falling
    // through to the /login?error=auth redirect.
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
      if (!error) {
        let dest = next ?? "/home";
        try {
          dest = await resolveLandingPath(supabase, next);
        } catch {
          // keep the safe default destination
        }
        const target = dest.startsWith("/") ? `${origin}${dest}` : dest;
        return NextResponse.redirect(target);
      }
    } catch {
      // falls through to the /login?error=auth redirect below
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
