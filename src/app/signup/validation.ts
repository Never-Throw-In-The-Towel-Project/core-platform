import { isIdentityPreference } from "@/lib/identity/preference";

export type SignupFields = {
  fullName: string;
  dateOfBirth: string; // yyyy-mm-dd from <input type="date">, or "" if unset
  identityPreference: string;
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
 * message instead of the browser's easy-to-miss native validation bubble.
 *
 * Message order matches the visual field order so the surfaced error always
 * points at the topmost unresolved field.
 */
export function validateSignupFields(fields: SignupFields): string | null {
  if (!fields.fullName.trim()) return "Enter your full name.";
  const dob = validateDateOfBirth(fields.dateOfBirth);
  if (dob) return dob;
  if (!isIdentityPreference(fields.identityPreference)) return "Choose how you'd like to appear in the community.";
  if (!isLikelyEmail(fields.email)) return "Enter a valid email address.";
  if (fields.password.length < 8) return "Password must be at least 8 characters.";
  if (fields.password !== fields.confirmPassword) return "Passwords don't match.";
  if (!fields.consent) return "Please agree to the Terms of Service and Privacy Policy to continue.";
  return null;
}

/**
 * DOB is collected but NOT age-gated (product decision -- the Terms' "16 or
 * over" line is left for solicitor review). So this only rejects the impossible:
 * a missing, unparseable, future, or absurdly old date -- never an age. Returns
 * a message or null. `1900-01-01` is a generous floor that no real member trips.
 */
export function validateDateOfBirth(value: string): string | null {
  if (!value.trim()) return "Enter your date of birth.";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Enter a valid date of birth.";
  const dob = new Date(parsed);
  const today = new Date();
  if (dob > today) return "Your date of birth can't be in the future.";
  if (dob.getUTCFullYear() < 1900) return "Enter a valid date of birth.";
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
