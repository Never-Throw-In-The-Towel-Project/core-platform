import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyChallengeConfirmToken } from "@/lib/steps/challengeConfirm";

/**
 * Anthony's availability-confirmation link for the pop-up-visit reward (brief
 * §4). Unauthenticated by design -- there's no login for Anthony -- but gated by
 * an HMAC token he can't forge (see challengeConfirm.ts). Tapping a valid link
 * flips the challenge from 'pending_confirmation' to 'active' via the
 * service-role client (the tapper isn't an hr_admin of the company). Renders a
 * plain HTML acknowledgement, since it opens in a mail-client browser.
 */
// Escape before interpolating. Everything passed today is a literal, but this
// keeps the page injection-proof if a caller ever routes challenge text or an
// error string through it (defence in depth, per the security review).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title: string, message: string, status: number): NextResponse {
  const t = escapeHtml(title);
  const m = escapeHtml(message);
  const body =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${t}</title></head>` +
    `<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 32rem; margin: 4rem auto; ` +
    `padding: 0 1.5rem; line-height: 1.6; color: #111;">` +
    `<h1 style="font-size: 1.25rem;">${t}</h1><p>${m}</p></body></html>`;
  return new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!(await verifyChallengeConfirmToken(id, token))) {
    return htmlPage(
      "Link not valid",
      "This confirmation link isn't valid. Please check with the NTITT team.",
      403
    );
  }

  try {
    const admin = createAdminClient();
    const { data: challenge } = await admin
      .from("company_step_challenges")
      .select("id, status, company_id")
      .eq("id", id)
      .maybeSingle();

    if (!challenge) return htmlPage("Not found", "That challenge no longer exists.", 404);
    if (challenge.status === "active") {
      return htmlPage("Already live", "Thanks — this challenge is already live.", 200);
    }
    if (challenge.status !== "pending_confirmation") {
      return htmlPage("Can't confirm", "This challenge can no longer be confirmed.", 409);
    }

    // Respect the one-active-per-company rule with a clear message instead of a
    // raw unique-violation from the partial index.
    const { data: existingActive } = await admin
      .from("company_step_challenges")
      .select("id")
      .eq("company_id", challenge.company_id)
      .eq("status", "active")
      .maybeSingle();
    if (existingActive) {
      return htmlPage("Can't confirm", "This company already has another active challenge running.", 409);
    }

    const { error } = await admin
      .from("company_step_challenges")
      .update({ status: "active" })
      .eq("id", id)
      .eq("status", "pending_confirmation");
    if (error) {
      return htmlPage(
        "Something went wrong",
        "We couldn't confirm the challenge. Please contact the NTITT team.",
        500
      );
    }

    return htmlPage(
      "Confirmed — thank you!",
      "The challenge is now live and staff can start contributing. Thanks for confirming your availability.",
      200
    );
  } catch {
    return htmlPage(
      "Something went wrong",
      "We couldn't confirm the challenge right now. Please try again later.",
      500
    );
  }
}
