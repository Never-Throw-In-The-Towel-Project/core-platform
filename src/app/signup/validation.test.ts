import { describe, expect, it } from "vitest";
import { validateSignupFields, validateDateOfBirth, type SignupFields } from "./validation";

const valid: SignupFields = {
  fullName: "Ada Lovelace",
  dateOfBirth: "1990-12-10",
  identityPreference: "full_name",
  email: "ada@example.com",
  password: "correcthorse",
  confirmPassword: "correcthorse",
  consent: true,
};

describe("validateSignupFields", () => {
  it("returns null when every field is valid", () => {
    expect(validateSignupFields(valid)).toBeNull();
  });

  it("requires a full name (whitespace doesn't count)", () => {
    expect(validateSignupFields({ ...valid, fullName: "   " })).toBe("Enter your full name.");
  });

  it("requires a date of birth", () => {
    expect(validateSignupFields({ ...valid, dateOfBirth: "" })).toBe("Enter your date of birth.");
  });

  it("rejects a future date of birth but does NOT age-gate", () => {
    expect(validateSignupFields({ ...valid, dateOfBirth: "2999-01-01" })).toBe(
      "Your date of birth can't be in the future."
    );
    // A 12-year-old is accepted -- collection without an age gate is intentional.
    const twelve = new Date();
    twelve.setUTCFullYear(twelve.getUTCFullYear() - 12);
    expect(validateSignupFields({ ...valid, dateOfBirth: twelve.toISOString().slice(0, 10) })).toBeNull();
  });

  it("requires a valid identity preference", () => {
    expect(validateSignupFields({ ...valid, identityPreference: "bogus" })).toBe(
      "Choose how you'd like to appear in the community."
    );
  });

  it("rejects an obviously malformed email before a round-trip", () => {
    expect(validateSignupFields({ ...valid, email: "ada@" })).toBe("Enter a valid email address.");
    expect(validateSignupFields({ ...valid, email: "adaexample.com" })).toBe(
      "Enter a valid email address."
    );
  });

  it("enforces the 8-character minimum password", () => {
    expect(validateSignupFields({ ...valid, password: "short", confirmPassword: "short" })).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("catches a password/confirmation mismatch", () => {
    expect(validateSignupFields({ ...valid, confirmPassword: "different" })).toBe(
      "Passwords don't match."
    );
  });

  it("requires consent to the terms and privacy policy", () => {
    expect(validateSignupFields({ ...valid, consent: false })).toBe(
      "Please agree to the Terms of Service and Privacy Policy to continue."
    );
  });

  it("surfaces the topmost unresolved field first", () => {
    // Full name is blank AND passwords mismatch AND no consent -> name wins.
    expect(
      validateSignupFields({
        ...valid,
        fullName: "",
        confirmPassword: "different",
        consent: false,
      })
    ).toBe("Enter your full name.");
  });
});

describe("validateDateOfBirth", () => {
  it("accepts a plausible past date", () => {
    expect(validateDateOfBirth("1985-06-15")).toBeNull();
  });
  it("rejects empty, unparseable, future and pre-1900 dates", () => {
    expect(validateDateOfBirth("")).toBe("Enter your date of birth.");
    expect(validateDateOfBirth("not-a-date")).toBe("Enter a valid date of birth.");
    expect(validateDateOfBirth("2999-01-01")).toBe("Your date of birth can't be in the future.");
    expect(validateDateOfBirth("1850-01-01")).toBe("Enter a valid date of birth.");
  });
});
