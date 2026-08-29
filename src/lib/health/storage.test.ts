import { describe, it, expect } from "vitest";
import { summarizeStorage, checkStorageReadiness, STORAGE_BUCKETS } from "./storage";

describe("summarizeStorage", () => {
  const buckets = [
    { bucket: "a", migration: "m1" },
    { bucket: "b", migration: "m2" },
  ];

  it("is ok when every bucket exists", () => {
    const r = summarizeStorage(buckets, [true, true]);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("reports the missing buckets and fails ok", () => {
    const r = summarizeStorage(buckets, [true, false]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ bucket: "b", migration: "m2" }]);
  });
});

describe("checkStorageReadiness (injected probe)", () => {
  it("ok when the probe finds every bucket", async () => {
    const r = await checkStorageReadiness(async () => true);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("surfaces an un-applied bucket migration when a bucket is absent", async () => {
    // Simulate the real event-images incident: the bucket migration wasn't
    // db-pushed, so that one bucket is missing while the rest are present.
    const absent = new Set(["event-images"]);
    const r = await checkStorageReadiness(async (b) => !absent.has(b.bucket));
    expect(r.ok).toBe(false);
    expect(r.missing.map((b) => b.bucket)).toEqual(["event-images"]);
  });

  it("every declared bucket names a real migration file prefix", () => {
    // Guardrail: each bucket must carry a migration id so the report is actionable.
    expect(STORAGE_BUCKETS.length).toBeGreaterThan(0);
    expect(STORAGE_BUCKETS.every((b) => /^\d{14}_/.test(b.migration))).toBe(true);
  });
});
