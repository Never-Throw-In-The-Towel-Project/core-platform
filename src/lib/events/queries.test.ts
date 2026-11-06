import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Profiles lookup goes through its own admin client; not exercised here (all
// bookings below are guests), but the module imports it, so stub it.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => makeBuilder([]) }) }));

function makeBuilder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(onF, onR),
  });
  return b;
}

let bookingsData: unknown[];
const client = { from: () => makeBuilder(bookingsData) };

const { listBookingsForEvent } = await import("./queries");

describe("listBookingsForEvent (E6/E7 M7 -- the roster must page past the 1000-row cap)", () => {
  it("returns every booking across >1000 rows, not a capped 1000", async () => {
    const N = 1500;
    bookingsData = Array.from({ length: N }, (_, i) => ({
      id: `b${String(i).padStart(5, "0")}`,
      event_id: "e1",
      user_id: null,
      guest_name: `Guest ${i}`,
      guest_email: `g${i}@example.com`,
      status: "confirmed",
      created_at: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
    }));

    const res = await listBookingsForEvent(
      client as unknown as Parameters<typeof listBookingsForEvent>[0],
      "e1"
    );

    expect(res).toHaveLength(1500);
    expect(res[res.length - 1].guest_name).toBe("Guest 1499");
  });
});
