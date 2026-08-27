import { describe, it, expect } from "vitest";
import {
  clampSeconds,
  normalizeProgressInput,
  resumeTarget,
  isEffectivelyComplete,
  INT4_MAX,
  RESUME_MIN_SECONDS,
} from "./progressInput";

describe("clampSeconds", () => {
  it("floors to a whole number", () => {
    expect(clampSeconds(12.9)).toBe(12);
  });

  it("coerces non-finite / non-number to 0", () => {
    expect(clampSeconds(NaN)).toBe(0);
    expect(clampSeconds(Infinity)).toBe(0);
    expect(clampSeconds("30")).toBe(0);
    expect(clampSeconds(null)).toBe(0);
    expect(clampSeconds(undefined)).toBe(0);
  });

  it("clamps negatives up to 0 and huge values to int4 max", () => {
    expect(clampSeconds(-5)).toBe(0);
    expect(clampSeconds(INT4_MAX + 1000)).toBe(INT4_MAX);
  });
});

describe("normalizeProgressInput", () => {
  it("returns null without a content id", () => {
    expect(normalizeProgressInput({ positionSeconds: 10 })).toBeNull();
    expect(normalizeProgressInput({ contentItemId: "   " })).toBeNull();
    expect(normalizeProgressInput({ contentItemId: 123 })).toBeNull();
  });

  it("normalises a well-formed report", () => {
    expect(
      normalizeProgressInput({ contentItemId: " abc ", positionSeconds: 42.7, durationSeconds: 300.2, completed: true })
    ).toEqual({ contentItemId: "abc", positionSeconds: 42, durationSeconds: 300, completed: true });
  });

  it("stores a null (not 0) duration when unknown or zero", () => {
    expect(normalizeProgressInput({ contentItemId: "x", positionSeconds: 5 })!.durationSeconds).toBeNull();
    expect(normalizeProgressInput({ contentItemId: "x", positionSeconds: 5, durationSeconds: 0 })!.durationSeconds).toBeNull();
  });

  it("treats only a strict true as completed", () => {
    expect(normalizeProgressInput({ contentItemId: "x", completed: "true" })!.completed).toBe(false);
    expect(normalizeProgressInput({ contentItemId: "x", completed: 1 })!.completed).toBe(false);
    expect(normalizeProgressInput({ contentItemId: "x" })!.completed).toBe(false);
  });
});

describe("resumeTarget", () => {
  it("resumes to the floored position mid-video", () => {
    expect(resumeTarget(120.8, 600, false)).toBe(120);
  });

  it("does not resume a finished watch", () => {
    expect(resumeTarget(120, 600, true)).toBeNull();
  });

  it("ignores a trivial head-start", () => {
    expect(resumeTarget(RESUME_MIN_SECONDS - 1, 600, false)).toBeNull();
    expect(resumeTarget(0, 600, false)).toBeNull();
  });

  it("does not drop the viewer into the final seconds", () => {
    expect(resumeTarget(597, 600, false)).toBeNull(); // within the 8s end guard
    expect(resumeTarget(590, 600, false)).toBe(590); // just before it
  });

  it("resumes even with an unknown duration (can't check the end guard)", () => {
    expect(resumeTarget(120, null, false)).toBe(120);
  });
});

describe("isEffectivelyComplete", () => {
  it("is true at/after 95% watched", () => {
    expect(isEffectivelyComplete(95, 100)).toBe(true);
    expect(isEffectivelyComplete(99, 100)).toBe(true);
  });

  it("is false below the threshold", () => {
    expect(isEffectivelyComplete(94, 100)).toBe(false);
  });

  it("is false when the duration is unknown or zero", () => {
    expect(isEffectivelyComplete(50, null)).toBe(false);
    expect(isEffectivelyComplete(50, 0)).toBe(false);
  });
});
