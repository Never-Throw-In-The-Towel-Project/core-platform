import "server-only";

/**
 * The number shown on every Ask for Support screen: "If this is urgent
 * right now, please call [helpline]." This is a national crisis line, not
 * the company's own designated contact (support_contact_* on `companies`,
 * see src/lib/support/alert.ts) -- it's the always-available fallback for
 * someone who can't wait for a person to respond to their submission.
 *
 * Found during a full-platform review against the brief: AskForSupport's
 * `helplineNumber` prop was defined but never actually passed by either
 * layout that renders it, so every user saw the literal placeholder text
 * "the helpline" with no real number -- see (app)/layout.tsx and
 * (admin)/layout.tsx. `HELPLINE_NUMBER` lets a real deployment override
 * this (e.g. a company's own EAP crisis line); Samaritans is the correct
 * default for this platform's UK deployment (every seeded/testimonial
 * company is UK-based) and is always safe to show even unconfigured.
 */
export function resolveHelplineNumber(): string {
  return process.env.HELPLINE_NUMBER?.trim() || "116 123 (Samaritans, free, 24/7)";
}
