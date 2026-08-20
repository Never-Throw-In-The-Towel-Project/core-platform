import { NextResponse, type NextRequest } from "next/server";
import { verifyStandardWebhook } from "@/lib/auth/webhookVerify";
import { buildAuthEmail } from "@/lib/auth/authEmailContent";
import { sendBrandedEmail } from "@/lib/email/brevo";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

// node:crypto (signature verification) needs the Node.js runtime, not Edge.
export const runtime = "nodejs";

type EmailData = {
  token_hash?: string;
  email_action_type?: string;
  redirect_to?: string;
  site_url?: string;
  token?: string;
};

/**
 * Supabase Auth "Send Email" hook. When enabled on the project, GoTrue POSTs
 * every auth email here (signed, Standard Webhooks) INSTEAD of sending it
 * itself; we render it from the shared branded layout and send via Brevo, so
 * auth mail matches every other NTITT email and comes from the same sender.
 *
 * Security: the request is HMAC-verified against SUPABASE_AUTH_HOOK_SECRET
 * before we act (a forged/replayed call is rejected). Deliverability: on a
 * Brevo failure we return the Standard error shape so GoTrue surfaces "couldn't
 * send" to the user rather than silently dropping a sign-in link.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const verified = verifyStandardWebhook(
    raw,
    {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    process.env.SUPABASE_AUTH_HOOK_SECRET,
    Math.floor(Date.now() / 1000)
  );
  if (!verified) {
    return NextResponse.json({ error: { http_code: 401, message: "invalid signature" } }, { status: 401 });
  }

  let payload: { user?: { email?: string }; email_data?: EmailData };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { http_code: 400, message: "invalid payload" } }, { status: 400 });
  }

  // Recipient is the account's own address. NOTE: the app does not currently
  // trigger an email-change flow (no updateUser({email}) anywhere). If one is
  // ever added, verify which address GoTrue expects the "confirm new email" mail
  // to reach for `email_action_type === "email_change"` -- it may be the NEW
  // address, carried separately in the payload, rather than user.email here.
  const to = payload.user?.email;
  const data = payload.email_data;
  if (!to || !data?.email_action_type) {
    return NextResponse.json({ error: { http_code: 400, message: "missing fields" } }, { status: 400 });
  }

  let subject: string, html: string, text: string;
  try {
    // buildActionUrl does `new URL(...)`, which throws if the site-URL base is
    // empty (a misconfigured deployment) -- fail cleanly with the error shape
    // rather than an uncaught 500.
    ({ subject, html, text } = buildAuthEmail({
      actionType: String(data.email_action_type),
      actionUrl: buildActionUrl(data),
      token: data.token ? String(data.token) : undefined,
    }));
  } catch {
    return NextResponse.json({ error: { http_code: 500, message: "could not build email" } }, { status: 500 });
  }

  const res = await sendBrandedEmail({ to, subject, html, text });
  if (!res.ok) {
    // Let GoTrue report the failure (auth needs the email to have been sent).
    return NextResponse.json({ error: { http_code: 500, message: res.error ?? "send failed" } }, { status: 500 });
  }
  return NextResponse.json({}, { status: 200 });
}

/** Build the on-domain verify link the email button points at. We use the
 *  token_hash + /auth/confirm flow (not the PKCE code) so the link stays on our
 *  own domain, and preserve any safe post-verify `next` from redirect_to. */
function buildActionUrl(data: EmailData): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || data.site_url || "";
  const url = new URL("/auth/confirm", base);
  url.searchParams.set("token_hash", String(data.token_hash ?? ""));
  url.searchParams.set("type", String(data.email_action_type ?? ""));
  const next = extractNext(data.redirect_to);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

function extractNext(redirectTo: string | undefined): string | null {
  if (!redirectTo) return null;
  try {
    const n = new URL(redirectTo).searchParams.get("next");
    return n && isSafeRedirectPath(n) ? n : null;
  } catch {
    return null;
  }
}
