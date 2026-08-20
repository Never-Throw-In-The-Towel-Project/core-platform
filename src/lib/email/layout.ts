/**
 * The ONE branded email layout. Every app email (and, via the auth send-email
 * hook, the Supabase Auth mails) renders through renderBrandedEmail so they all
 * share one look: the Modernist system, email-safe (table layout, inline styles).
 * The header carries the hosted fist logomark next to the text wordmark; the
 * wordmark stays as the always-visible fallback, so if a client blocks the image
 * the brand name still shows (nothing depends on image loading). Returns BOTH an
 * HTML and a plaintext body so every send is multipart -- better deliverability
 * and a clean fallback.
 *
 * All text fields are treated as PLAIN TEXT and escaped here, so callers pass
 * raw strings (incl. user-supplied names/titles) without their own escaping and
 * without any XSS risk. URLs are caller-built app links (signed tokens etc.).
 *
 * No "use server"/"server-only": this is a pure string builder, unit-tested in
 * isolation and safe to import anywhere.
 */

// Modernist tokens as raw hex (emails can't use Tailwind). See globals.css.
const INK = "#201e1d"; // brand background / ink text
const PAPER = "#f3f2f2"; // paper ground / text on ink
const ACCENT = "#c81e0f"; // AA-safe red — button fills WITH text on them
const ACCENT_VIVID = "#ec3013"; // true NTITT red — decoration only, no text on it
const MUTED = "#5c5754"; // muted body text
const HAIRLINE = "#e2e0df"; // 1px divider
const FINE = "#8a8481"; // footer fine print
const CARD = "#ffffff";

const WORDMARK = "Never Throw In The Towel";
// The fist logomark, hosted on the canonical apex domain (an email-sized 120px
// copy of public/logo-mark.png -- the two-tone mark reads on the ink header, the
// black outline disappearing into the band). Absolute URL: email clients can't
// resolve relative paths, and the brand mark is NTITT's regardless of tenant.
const LOGO_URL = "https://neverthrowinthetowel.uk/email/logo-mark-email.png";
const DEFAULT_SIGNOFF = "Keep on living,\nNever Throw In The Towel";
const FOOTER_TAGLINE =
  "Never Throw In The Towel — a members’ community and daily tools to help you keep going.";
const FOOTER_URL = "neverthrowinthetowel.uk";

export type EmailButton = { label: string; url: string };
export type EmailDetail = { label: string; value: string };

export type BrandedEmailInput = {
  /** Hidden preview text shown in the inbox list before the body. */
  preheader?: string;
  heading: string;
  /** Body paragraphs above any details/button. */
  paragraphs?: string[];
  /** An optional label/value info block (event details, urgency, figures…). */
  details?: EmailDetail[];
  /** Primary call-to-action button. */
  button?: EmailButton;
  /** Show the button's raw URL underneath as a copy-paste fallback. */
  showButtonUrl?: boolean;
  /** Paragraphs after the button (muted), e.g. "didn't request this?" notes. */
  afterButton?: string[];
  /** Small muted text links in the body (e.g. a "cancel any time" link). Each
   *  renders as an optional `note` prefix followed by the linked `label`. */
  secondaryLinks?: { label: string; url: string; note?: string }[];
  /** Warm sign-off. Defaults to "Keep on living, …"; pass null to omit. */
  signoff?: string | null;
  /** Optional extra footer line above the standard tagline. */
  footerNote?: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphHtml(text: string, color: string, size = 15): string {
  return `<p style="margin:0 0 16px 0;font-size:${size}px;line-height:1.6;color:${color};">${escapeHtml(
    text
  ).replace(/\n/g, "<br />")}</p>`;
}

function detailsHtml(details: EmailDetail[]): string {
  const rows = details
    .map(
      (d, i) => {
        const edge = i < details.length - 1 ? `border-bottom:1px solid ${HAIRLINE};` : "";
        return `<tr>
        <td style="padding:9px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${MUTED};width:38%;vertical-align:top;${edge}">${escapeHtml(
          d.label
        )}</td>
        <td style="padding:9px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${INK};${edge}">${escapeHtml(
          d.value
        ).replace(/\n/g, "<br />")}</td>
      </tr>`;
      }
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${HAIRLINE};border-collapse:collapse;margin:0 0 20px 0;">${rows}</table>`;
}

function buttonHtml(button: EmailButton): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;">
    <tr><td bgcolor="${ACCENT}" style="padding:13px 24px;">
      <a href="${escapeHtml(button.url)}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${PAPER};text-decoration:none;">${escapeHtml(
        button.label
      )}</a>
    </td></tr>
  </table>`;
}

export function renderBrandedEmail(input: BrandedEmailInput): { html: string; text: string } {
  const signoff = input.signoff === undefined ? DEFAULT_SIGNOFF : input.signoff;

  // ---- HTML ----
  const parts: string[] = [];
  for (const p of input.paragraphs ?? []) parts.push(paragraphHtml(p, INK));
  if (input.details && input.details.length > 0) parts.push(detailsHtml(input.details));
  if (input.button) parts.push(buttonHtml(input.button));
  if (input.button && input.showButtonUrl) {
    parts.push(paragraphHtml("If the button doesn’t work, copy and paste this link into your browser:", MUTED, 13));
    parts.push(
      `<p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;word-break:break-all;font-family:Arial,Helvetica,sans-serif;"><a href="${escapeHtml(
        input.button.url
      )}" style="color:${ACCENT};">${escapeHtml(input.button.url)}</a></p>`
    );
  }
  for (const p of input.afterButton ?? []) parts.push(paragraphHtml(p, MUTED));
  for (const link of input.secondaryLinks ?? []) {
    const note = link.note ? `${escapeHtml(link.note)} ` : "";
    parts.push(
      `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${MUTED};">${note}<a href="${escapeHtml(
        link.url
      )}" style="color:${ACCENT};">${escapeHtml(link.label)}</a></p>`
    );
  }
  if (signoff) parts.push(paragraphHtml(signoff, MUTED));

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${escapeHtml(
        input.preheader
      )}</div>`
    : "";

  const footerNote = input.footerNote
    ? `<p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${FINE};">${escapeHtml(
        input.footerNote
      )}</p>`
    : "";

  const html = `${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};margin:0;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${CARD};border:1px solid ${INK};">
        <tr>
          <td bgcolor="${INK}" style="padding:20px 32px;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;padding-right:14px;">
                <img src="${LOGO_URL}" width="40" height="40" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:40px;height:40px;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:16px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${PAPER};">${WORDMARK}</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td bgcolor="${ACCENT_VIVID}" height="4" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:30px 32px 6px 32px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(
              input.heading
            )}</h1>
            ${parts.join("\n            ")}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 28px 32px;border-top:1px solid ${HAIRLINE};font-family:Arial,Helvetica,sans-serif;">
            ${footerNote}<p style="margin:0;font-size:12px;line-height:1.6;color:${FINE};">${escapeHtml(
              FOOTER_TAGLINE
            )}<br />${FOOTER_URL}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  // ---- Plain text ----
  const t: string[] = [input.heading, ""];
  for (const p of input.paragraphs ?? []) t.push(p, "");
  if (input.details && input.details.length > 0) {
    for (const d of input.details) t.push(`${d.label}: ${d.value}`);
    t.push("");
  }
  if (input.button) t.push(`${input.button.label}: ${input.button.url}`, "");
  for (const p of input.afterButton ?? []) t.push(p, "");
  for (const link of input.secondaryLinks ?? []) {
    t.push(`${link.note ? `${link.note} ` : ""}${link.label}: ${link.url}`, "");
  }
  if (signoff) t.push(signoff, "");
  if (input.footerNote) t.push(input.footerNote);
  t.push("--", FOOTER_TAGLINE, FOOTER_URL);

  return { html, text: t.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n" };
}
