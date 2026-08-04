import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next = requestedNext && isSafeRedirectPath(requestedNext) ? requestedNext : "/home";

  if (code) {
    const supabase = await createClient();
    // Wrapped in try/catch: auth-js (node_modules/@supabase/auth-js) only
    // returns a failure as `{ error }` when it recognizes it as an
    // AuthError -- anything else is re-thrown, which would otherwise crash
    // this route instead of falling through to the existing /login?error=auth
    // redirect below.
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // falls through to the /login?error=auth redirect below
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
