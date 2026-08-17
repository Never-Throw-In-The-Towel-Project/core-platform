import { describe, it, expect } from "vitest";
import { isCompanyOrgMember } from "./membership";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";

const REAL_COMPANY = "11111111-1111-1111-1111-111111111111";

describe("isCompanyOrgMember", () => {
  it("is true for an employee of a real partner company", () => {
    expect(isCompanyOrgMember({ company_id: REAL_COMPANY, role: "employee" })).toBe(true);
  });

  it("is true for an hr_admin of a real partner company", () => {
    expect(isCompanyOrgMember({ company_id: REAL_COMPANY, role: "hr_admin" })).toBe(true);
  });

  it("is false for a self-signup individual in the NTITT-Direct pool", () => {
    expect(isCompanyOrgMember({ company_id: DIRECT_COMPANY_ID, role: "employee" })).toBe(false);
  });

  it("is false for an ntitt_admin (the synthetic NTITT-internal company)", () => {
    expect(isCompanyOrgMember({ company_id: REAL_COMPANY, role: "ntitt_admin" })).toBe(false);
  });
});
