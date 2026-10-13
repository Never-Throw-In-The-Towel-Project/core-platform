import { verifyAckToken } from "@/lib/support/alert";
import { acknowledgeSupportRequest } from "@/lib/actions/support";

// A SAFE landing page: rendering it (GET) does nothing -- the request is only
// marked "contacted" when a human submits the form below (a server-action
// POST). So email/SMS link-scanners and prefetchers that auto-fetch the alert
// link can no longer acknowledge a real support request on the first-aider's
// behalf and silence its escalation (finding E5). Mirrors the event-booking
// confirm/cancel landing pages. force-dynamic because the token is read
// per-request and must never be cached.
export const dynamic = "force-dynamic";

const RESULTS: Record<string, { title: string; body: string }> = {
  contacted: {
    title: "Marked as contacted",
    body: "Thanks for reaching out to them — we won't keep escalating this one.",
  },
  already: {
    title: "Already marked as contacted",
    body: "Someone has already picked this up. Thanks for being there.",
  },
  error: {
    title: "Something went wrong",
    body: "The request is still logged — please reach out to the person directly if you can.",
  },
};

export default async function SupportAckPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; token?: string; done?: string }>;
}) {
  const { request = "", token = "", done = "" } = await searchParams;

  // Post-submit result view (no token needed -- the action already ran).
  if (done) {
    const r = RESULTS[done] ?? RESULTS.error;
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-extrabold tracking-tight">{r.title}</h1>
        <p className="mt-3 text-sm text-muted">{r.body}</p>
      </main>
    );
  }

  const valid = Boolean(request) && Boolean(token) && (await verifyAckToken(request, token));

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      {!valid ? (
        <>
          <h1 className="text-2xl font-extrabold tracking-tight">This link isn’t valid</h1>
          <p className="mt-3 text-sm text-muted">
            It may be mistyped or incomplete. If someone reached out for support, please contact them directly.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold tracking-tight">Mark as contacted?</h1>
          <p className="mt-3 text-sm text-muted">
            Someone asked for support. Once you’ve reached out to them, tap below so we stop escalating this
            request.
          </p>
          <form action={acknowledgeSupportRequest} className="mt-6">
            <input type="hidden" name="request" value={request} />
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
            >
              I’ve got this — mark handled
            </button>
          </form>
        </>
      )}
    </main>
  );
}
