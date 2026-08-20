import { describe, it, expect } from "vitest";
import { summarizeSchema, checkSchemaReadiness, SCHEMA_SENTINELS } from "./schema";

describe("summarizeSchema", () => {
  const sentinels = [
    { schema: "private" as const, table: "a", migration: "m1" },
    { schema: "public" as const, table: "b", migration: "m2" },
  ];

  it("is ok when every table exists", () => {
    const r = summarizeSchema(sentinels, [true, true]);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("reports the missing sentinels and fails ok", () => {
    const r = summarizeSchema(sentinels, [true, false]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ schema: "public", table: "b", migration: "m2" }]);
  });
});

describe("checkSchemaReadiness (injected probe)", () => {
  it("ok when the probe finds every sentinel", async () => {
    const r = await checkSchemaReadiness(async () => true);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("surfaces an un-applied migration when a sentinel table is absent", async () => {
    // Simulate the whole newest migration not being pushed: its tables are absent.
    const absent = new Set(["habit_challenges", "habit_check_ins"]);
    const r = await checkSchemaReadiness(async (s) => !absent.has(s.table));
    expect(r.ok).toBe(false);
    expect(r.missing.map((s) => s.table)).toEqual(["habit_challenges", "habit_check_ins"]);
  });

  it("every declared sentinel names a real migration file prefix", () => {
    // Guardrail: sentinels must carry a migration id so the report is actionable.
    expect(SCHEMA_SENTINELS.length).toBeGreaterThan(0);
    expect(SCHEMA_SENTINELS.every((s) => /^\d{14}_/.test(s.migration))).toBe(true);
  });
});
