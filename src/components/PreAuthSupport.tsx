import { resolveHelplineNumber, resolveHelplineTel } from "@/lib/support/helpline";
import { SupportResourceList } from "@/components/support/SupportResourceList";
import { URGENT_RESOURCES, ONGOING_RESOURCES } from "@/lib/support/resources";

/**
 * Always-visible support for UNAUTHENTICATED screens (login, signup, and the
 * public marketing site).
 *
 * The in-app hub's "have someone from your workplace check in with me" request
 * (`AskForSupport`'s responder panel) is deliberately session-gated -- it
 * identifies a real user and routes to *their own company's* contact, neither of
 * which exists before sign-in. So the responder flow can't run here.
 *
 * But the external signposting can, and the brief's rule is non-negotiable: a
 * support entry point is on *every single screen without exception*. So the
 * national crisis line stays visible as a one-tap `tel:` call, and a disclosure
 * opens the same tiered signposting the in-app hub shows -- crisis lines and the
 * external charities -- minus the in-app (internal) NTITT links, which need a
 * session.
 *
 * Token-based styling only (border-current / currentColor / opacity) so it reads
 * correctly on both the dark auth screens and the light marketing ground.
 */

// The in-app tier minus the internal NTITT links (events/community): those
// routes need a session, so they'd bounce a logged-out visitor to /login.
const ONGOING_EXTERNAL = ONGOING_RESOURCES.filter((resource) =>
  resource.actions.every((action) => action.type !== "internal")
);

export function PreAuthSupport() {
  const label = resolveHelplineNumber();
  const tel = resolveHelplineTel();

  return (
    <aside aria-label="Support" className="mx-auto w-full max-w-md border border-rule-border px-4 py-3 text-sm">
      <p className="text-muted">Need to talk to someone right now? You don&apos;t have to be signed in.</p>
      <a
        href={`tel:${tel}`}
        className="mt-1 inline-flex min-h-[44px] items-center font-semibold text-brand-accent underline underline-offset-2"
      >
        Call {label}
      </a>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
          More ways to get help
        </summary>
        <div className="mt-3 space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">If it&apos;s urgent</p>
            <SupportResourceList resources={URGENT_RESOURCES} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Ongoing support</p>
            <SupportResourceList resources={ONGOING_EXTERNAL} />
          </div>
        </div>
      </details>
    </aside>
  );
}
