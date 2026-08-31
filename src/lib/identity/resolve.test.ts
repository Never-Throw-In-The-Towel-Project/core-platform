import { describe, it, expect } from "vitest";
import { peerCommunityName, realName, firstNameOf, type CommunityIdentity } from "./resolve";

const alex: CommunityIdentity = {
  fullName: "Alex Morgan",
  displayName: "Quiet Otter",
  preference: "full_name",
};

describe("peerCommunityName", () => {
  it("shows the full real name on full_name", () => {
    expect(peerCommunityName({ ...alex, preference: "full_name" })).toBe("Alex Morgan");
  });

  it("shows only the first name on first_name_only", () => {
    expect(peerCommunityName({ ...alex, preference: "first_name_only" })).toBe("Alex");
  });

  it("shows the handle (never the real name) on anonymous", () => {
    const out = peerCommunityName({ ...alex, preference: "anonymous" });
    expect(out).toBe("Quiet Otter");
    expect(out).not.toContain("Alex");
  });

  it("a per-post override beats the account default", () => {
    expect(peerCommunityName({ ...alex, preference: "full_name" }, "anonymous")).toBe("Quiet Otter");
    expect(peerCommunityName({ ...alex, preference: "anonymous" }, "full_name")).toBe("Alex Morgan");
  });

  it("falls back to the handle when full_name is missing (legacy rows)", () => {
    const legacy: CommunityIdentity = { fullName: null, displayName: "Sam T", preference: "full_name" };
    expect(peerCommunityName(legacy)).toBe("Sam T");
    expect(peerCommunityName({ ...legacy, preference: "first_name_only" })).toBe("Sam");
  });
});

describe("realName", () => {
  it("is always the real name for admins, whatever the preference", () => {
    expect(realName({ fullName: "Alex Morgan", displayName: "Quiet Otter" })).toBe("Alex Morgan");
  });
  it("falls back to the handle when full_name is null", () => {
    expect(realName({ fullName: null, displayName: "Sam T" })).toBe("Sam T");
  });
});

describe("firstNameOf", () => {
  it("takes the first token, or the whole name if single-word", () => {
    expect(firstNameOf("Alex Morgan")).toBe("Alex");
    expect(firstNameOf("Cher")).toBe("Cher");
    expect(firstNameOf("  Mary  Jane  ")).toBe("Mary");
  });
});
