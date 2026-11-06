// E15 — security response headers for the whole app.
//
// Two tiers, on purpose:
//   * The classic hardening headers (HSTS, nosniff, Referrer-Policy,
//     X-Frame-Options, Permissions-Policy, X-DNS-Prefetch-Control) are
//     ENFORCED immediately — none of them can break a correctly-built page.
//   * The Content-Security-Policy ships in **Report-Only** mode first
//     (`Content-Security-Policy-Report-Only`): the browser reports what it
//     WOULD block to /api/csp-report but blocks nothing. Once the reports
//     confirm the policy is clean against real traffic, a follow-up flips it
//     to enforcing with a per-request nonce + 'strict-dynamic'. That step is
//     deliberately separate because nonces force dynamic rendering of every
//     page (see node_modules/next/dist/docs/01-app/02-guides/
//     content-security-policy.md, "Static vs Dynamic Rendering with CSP").
//
// Pure + env-only so it can be unit-tested and imported from next.config.ts
// (no React / server-only imports — this runs in the Node config context).

export const CSP_REPORT_PATH = "/api/csp-report";

export type HeaderPair = { key: string; value: string };

// The app talks to Supabase over both HTTPS (REST / Storage / auth) and a
// WebSocket (Realtime), derived from the public project URL so the policy
// tracks whatever project this deployment is linked to.
function supabaseOrigins(): { http: string | null; ws: string | null } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: null, ws: null };
  try {
    const u = new URL(raw);
    return { http: u.origin, ws: `wss://${u.host}` };
  } catch {
    return { http: null, ws: null };
  }
}

// The CSP directive string. The same policy is served whether enforcing or
// report-only; only the header KEY differs (see securityHeaders()).
export function buildContentSecurityPolicy(): string {
  const { http: sb, ws: sbWs } = supabaseOrigins();
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ");

  const directives: string[] = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    // Report-Only phase: 'unsafe-inline' keeps Next's inline bootstrap/hydration
    // scripts running while we observe. The enforce follow-up replaces script
    // 'unsafe-inline' with a per-request nonce + 'strict-dynamic' (which then
    // makes browsers ignore 'unsafe-inline'). Inline STYLES stay allowed:
    // React injects them pervasively and they are far lower risk than scripts.
    `script-src ${join("'self'", "'unsafe-inline'")}`,
    `style-src ${join("'self'", "'unsafe-inline'")}`,
    // Posters/thumbnails: Supabase Storage, the Vimeo CDN, YouTube thumbnails.
    `img-src ${join("'self'", "data:", "blob:", "https://i.vimeocdn.com", "https://i.ytimg.com", "https://img.youtube.com", sb)}`,
    `media-src ${join("'self'", "blob:", sb)}`,
    // Fonts are self-hosted via next/font/local (no Google Fonts).
    `font-src 'self'`,
    // XHR / fetch / WebSocket: self + Supabase REST/Storage (https) + Realtime (wss).
    // Twilio/Brevo/Vimeo APIs are server-side only, so they are NOT needed here.
    `connect-src ${join("'self'", sb, sbWs)}`,
    // Embedded players: the member watch page (Vimeo) and YouTube embeds.
    `frame-src ${join("https://player.vimeo.com", "https://www.youtube.com", "https://www.youtube-nocookie.com")}`,
    // The push-notification service worker.
    `worker-src ${join("'self'", "blob:")}`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
    `report-uri ${CSP_REPORT_PATH}`,
  ];

  return directives.join("; ");
}

// The full header set for `source: '/(.*)'` in next.config.ts. CSP is emitted
// under the Report-Only key on purpose (see the module header).
export function securityHeaders(): HeaderPair[] {
  return [
    // Force HTTPS for 2 years, subdomains included. `preload` is deliberately
    // omitted for now — committing the apex to the browser preload list is hard
    // to undo and is a separate, explicit decision.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Clickjacking defense that is enforced TODAY (CSP's frame-ancestors is only
    // report-only until the enforce follow-up).
    { key: "X-Frame-Options", value: "DENY" },
    // The app uses none of these browser features; deny them outright.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicy() },
  ];
}
