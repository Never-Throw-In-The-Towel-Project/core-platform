import { describe, it, expect } from "vitest";
import { onboardingVariant } from "./variant";

describe("onboardingVariant", () => {
  it("gives members (employees) the member flow", () => {
    expect(onboardingVariant("employee")).toBe("member");
  });

  it("gives HR and NTITT admins the staff flow", () => {
    expect(onboardingVariant("hr_admin")).toBe("staff");
    expect(onboardingVariant("ntitt_admin")).toBe("staff");
  });
});
