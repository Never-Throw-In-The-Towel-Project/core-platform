export type SignupFields = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
};

/**
 * Client-side pre-submit validation for the signup form. Returns a single,
 * human-friendly message for the first problem found, or null when the input
 * is ready to submit.
 *
 * This mirrors the server-side zod checks in src/lib/actions/signup.ts, which
 * remain the real authority (a Server Action is reachable independently of how
 * its form renders). It exists purely so a blocked submit shows a clear inline
 * message instead of the browser's easy-to-miss native validation bubble --
 * the failure mode where a mismatched password or an unticked consent box made
 * "Create account" look like it did nothing at all.
 *
 * Message order matches the visual field order so the surfaced error always
 * points at the topmost unresolved field.
 */
export function validateSignupFields(fields: SignupFields): string | null {
  if (!fields.displayName.trim()) return "Enter your name.";
  if (!isLikelyEmail(fields.email)) return "Enter a valid email address.";
  if (fields.password.length < 8) return "Password must be at least 8 characters.";
  if (fields.password !== fields.confirmPassword) return "Passwords don't match.";
  if (!fields.consent) return "Please agree to the Terms of Service and Privacy Policy to continue.";
  return null;
}

/**
 * Deliberately lax -- the server's `z.email()` is the real gate; this only
 * needs to catch obvious typos (missing @, missing domain dot) before a
 * round-trip, without re-implementing full RFC email parsing on the client.
 */
function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
