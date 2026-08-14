import { describe, expect, it } from "vitest";
import { validateSignupFields, type SignupFields } from "./validation";

const valid: SignupFields = {
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  password: "correcthorse",
  confirmPassword: "correcthorse",
  consent: true,
};

describe("validateSignupFields", () => {
  it("returns null when every field is valid", () => {
    expect(validateSignupFields(valid)).toBeNull();
  });

  it("requires a name (whitespace doesn't count)", () => {
    expect(validateSignupFields({ ...valid, displayName: "   " })).toBe("Enter your name.");
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

  it("catches a password/confirmation mismatch -- the actual bug that looked like a no-op", () => {
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
    // Name is blank AND passwords mismatch AND no consent -> name wins.
    expect(
      validateSignupFields({
        ...valid,
        displayName: "",
        confirmPassword: "different",
        consent: false,
      })
    ).toBe("Enter your name.");
  });
});
