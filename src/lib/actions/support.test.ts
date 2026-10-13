import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirectMock(...args) }));

const verifyAckTokenMock = vi.fn();
const dispatchSupportAlertMock = vi.fn();
vi.mock("@/lib/support/alert", () => ({
  verifyAckToken: (...args: unknown[]) => verifyAckTokenMock(...args),
  dispatchSupportAlert: (...args: unknown[]) => dispatchSupportAlertMock(...args),
}));

const getProfileMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getProfile: (...args: unknown[]) => getProfileMock(...args) }));

// A single flexible supabase query-builder mock shared by the session
// (createClient) and admin (createAdminClient) clients. Terminal calls resolve
// via a per-client resolver keyed by (table, op); write payloads are captured by
// insertMock / updateMock so tests can assert whether the DB was touched.
type QueryResult = { data: unknown; error: unknown };
type ResolveCtx = { table: string; op: string };

const insertMock = vi.fn();
const updateMock = vi.fn();

let serverResolver: (ctx: ResolveCtx) => QueryResult;
let adminResolver: (ctx: ResolveCtx) => QueryResult;

function builderFor(resolver: (ctx: ResolveCtx) => QueryResult, table: string) {
  const ctx: ResolveCtx = { table, op: "select" };
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    insert: (payload: unknown) => {
      ctx.op = "insert";
      insertMock(payload);
      return b;
    },
    update: (payload: unknown) => {
      ctx.op = "update";
      updateMock(payload);
      return b;
    },
    eq: () => b,
    gte: () => b,
    order: () => b,
    limit: () => Promise.resolve(resolver(ctx)),
    single: () => Promise.resolve(resolver(ctx)),
    maybeSingle: () => Promise.resolve(resolver(ctx)),
    // Makes the builder awaitable for chains with no explicit terminal
    // (e.g. `.update(...).eq(...)`).
    then: (onF: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolver(ctx)).then(onF, onR),
  });
  return b;
}

const createClientMock = vi.fn(async () => ({ from: (t: string) => builderFor(serverResolver, t) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClientMock() }));

const createAdminClientMock = vi.fn(() => ({ from: (t: string) => builderFor(adminResolver, t) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClientMock() }));

const { acknowledgeSupportRequest, submitSupportRequest } = await import("./support");

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const COMPANY_ROW = {
  name: "Acme",
  support_contact_name: "Pat",
  support_contact_phone: "+1222",
  support_contact_email: "pat@acme.co",
};

beforeEach(() => {
  vi.clearAllMocks();

  getProfileMock.mockResolvedValue({ id: "user-1", company_id: "co-1" });
  dispatchSupportAlertMock.mockResolvedValue({ sms: { ok: true }, email: { ok: true } });

  // Defaults: no recent request (so submit proceeds), insert succeeds.
  serverResolver = ({ table, op }) => {
    if (table === "support_requests" && op === "select") return { data: [], error: null };
    if (table === "support_requests" && op === "insert") return { data: { id: "req-1" }, error: null };
    return { data: null, error: null };
  };
  // Defaults: company lookup returns a routable contact; ack update marks a row.
  adminResolver = ({ table, op }) => {
    if (table === "companies" && op === "select") return { data: COMPANY_ROW, error: null };
    if (table === "support_requests" && op === "update") return { data: { id: "req-1" }, error: null };
    return { data: null, error: null };
  };
});

describe("submitSupportRequest (E4 -- short-cooldown collapse)", () => {
  it("creates the request and dispatches the alert when there is no recent one", async () => {
    const state = await submitSupportRequest({ status: "idle" }, fd({ stayAnonymous: "true", urgency: "urgent" }));

    expect(state).toEqual({ status: "success" });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(dispatchSupportAlertMock).toHaveBeenCalledTimes(1);
  });

  it("collapses a repeat within the cooldown -- no new row, no re-dispatch", async () => {
    serverResolver = ({ table, op }) => {
      if (table === "support_requests" && op === "select") return { data: [{ id: "earlier" }], error: null };
      return { data: { id: "req-1" }, error: null };
    };

    const state = await submitSupportRequest({ status: "idle" }, fd({ stayAnonymous: "true", urgency: "urgent" }));

    expect(state).toEqual({ status: "success" });
    expect(insertMock).not.toHaveBeenCalled();
    expect(dispatchSupportAlertMock).not.toHaveBeenCalled();
  });

  it("fails open: a cooldown-lookup error still lets the request through", async () => {
    serverResolver = ({ table, op }) => {
      if (table === "support_requests" && op === "select") throw new Error("lookup boom");
      if (table === "support_requests" && op === "insert") return { data: { id: "req-1" }, error: null };
      return { data: null, error: null };
    };

    const state = await submitSupportRequest({ status: "idle" }, fd({ stayAnonymous: "true", urgency: "urgent" }));

    expect(state).toEqual({ status: "success" });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(dispatchSupportAlertMock).toHaveBeenCalledTimes(1);
  });

  it("only collapses against an OPEN request -- a stale lookup returning none proceeds", async () => {
    // status='new' filter is applied in the query; here the resolver returns no
    // open rows, so a fresh need goes through even if older handled rows exist.
    const state = await submitSupportRequest({ status: "idle" }, fd({ stayAnonymous: "true", urgency: "check_in" }));

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ status: "success" });
  });
});

describe("acknowledgeSupportRequest (E5 -- POST-only ack)", () => {
  it("marks a request contacted on a valid token and redirects to the contacted result", async () => {
    verifyAckTokenMock.mockResolvedValue(true);

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "good" }));

    expect(verifyAckTokenMock).toHaveBeenCalledWith("req-1", "good");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "contacted" }));
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=contacted");
  });

  it("redirects to 'already' when the request was no longer 'new' (idempotent)", async () => {
    verifyAckTokenMock.mockResolvedValue(true);
    adminResolver = () => ({ data: null, error: null });

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "good" }));

    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=already");
  });

  it("never touches the DB on an invalid token (the real gate, not the page)", async () => {
    verifyAckTokenMock.mockResolvedValue(false);

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "forged" }));

    expect(updateMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=error");
  });

  it("never touches the DB when the token or id is missing", async () => {
    await acknowledgeSupportRequest(fd({ request: "req-1" }));

    expect(verifyAckTokenMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=error");
  });
});
