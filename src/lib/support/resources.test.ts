import { describe, it, expect } from "vitest";
import { URGENT_RESOURCES, ONGOING_RESOURCES, supportActionHref } from "./resources";

const ALL = [...URGENT_RESOURCES, ...ONGOING_RESOURCES];

// This list is safety-critical signposting; these guard that every entry is
// actually reachable and that the crisis tier carries the lines it must.
describe("support resources", () => {
  it("every resource has an id, a name, a blurb and at least one action", () => {
    for (const r of ALL) {
      expect(r.id.trim().length).toBeGreaterThan(0);
      expect(r.name.trim().length).toBeGreaterThan(0);
      expect(r.blurb.trim().length).toBeGreaterThan(0);
      expect(r.actions.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique across both tiers (stable React keys / lookups)", () => {
    const ids = ALL.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every action is reachable: dialable number, sms shortcode, or a real link", () => {
    for (const r of ALL) {
      for (const a of r.actions) {
        expect(a.label.trim().length).toBeGreaterThan(0);
        if (a.type === "call") {
          expect(a.tel).toMatch(/^[0-9]+$/); // digits only, so tel: dials cleanly
        } else if (a.type === "text") {
          expect(a.sms).toMatch(/^[0-9]+$/);
        } else if (a.type === "link") {
          expect(a.href).toMatch(/^https:\/\//); // external, secure
        } else {
          expect(a.href).toMatch(/^\//); // in-app absolute route
        }
      }
    }
  });

  it("the urgent tier carries the crisis lines (999, NHS 111, Samaritans, Shout)", () => {
    const byId = (id: string) => URGENT_RESOURCES.find((r) => r.id === id);
    expect(byId("emergency")?.actions).toContainEqual({ type: "call", label: "Call 999", tel: "999" });
    expect(byId("nhs-111")?.actions.some((a) => a.type === "call" && a.tel === "111")).toBe(true);
    expect(byId("samaritans")?.actions.some((a) => a.type === "call" && a.tel === "116123")).toBe(true);
    expect(byId("shout")?.actions.some((a) => a.type === "text" && a.sms === "85258")).toBe(true);
  });

  it("the ongoing tier leads with NTITT's own routes before external charities", () => {
    const internalIds = ONGOING_RESOURCES.filter((r) =>
      r.actions.some((a) => a.type === "internal")
    ).map((r) => r.id);
    expect(internalIds).toContain("ntitt-events");
    expect(internalIds).toContain("ntitt-community");
  });

  it("supportActionHref builds tel:/sms:/url targets", () => {
    expect(ALL.length).toBeGreaterThan(0);
    for (const r of ALL) {
      for (const a of r.actions) {
        if (a.type === "call") expect(supportActionHref(a)).toBe(`tel:${a.tel}`);
        else if (a.type === "text") expect(supportActionHref(a)).toBe(`sms:${a.sms}`);
        else expect(supportActionHref(a)).toBe(a.href);
      }
    }
  });
});
