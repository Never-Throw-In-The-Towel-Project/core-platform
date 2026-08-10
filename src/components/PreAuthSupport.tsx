import { resolveHelplineNumber, resolveHelplineTel } from "@/lib/support/helpline";

/**
 * Always-visible crisis support for UNAUTHENTICATED screens (login, signup,
 * and the public marketing site).
 *
 * The full "I want someone to check in with me" flow (`AskForSupport`) is
 * deliberately session-gated: it identifies a real platform user internally
 * (even when they choose to appear anonymous to the responder) and routes
 * the SMS/email alert to *their own company's* designated contact -- neither
 * of which exists before sign-in. So that flow can't run pre-auth.
 *
 * But the brief's rule is non-negotiable: a support/helpline entry point is
 * on *every single screen without exception*. The screens a distressed
 * visitor might sit on before they can sign in (a forgotten password on
 * /login, a new starter on /signup, anyone browsing the marketing site)
 * were the one place that showed nothing at all. This surfaces the
 * always-available national crisis line there, as a one-tap `tel:` call --
 * the honest minimum for a screen where we can't promise a personal
 * callback, matching the brief's "the same screen always shows a helpline
 * number" fallback.
 *
 * Token-based styling only (border-current / currentColor / opacity) so it
 * reads correctly on both the dark auth screens and the light marketing
 * ground without a variant prop.
 */
export function PreAuthSupport() {
  const label = resolveHelplineNumber();
  const tel = resolveHelplineTel();

  return (
    <aside
      aria-label="Crisis support"
      className="mx-auto w-full max-w-md border border-current/15 px-4 py-3 text-sm"
    >
      <p className="opacity-80">
        Need to talk to someone right now? You don&apos;t have to be signed in.
      </p>
      <a
        href={`tel:${tel}`}
        className="mt-1 inline-block font-semibold text-brand-accent underline underline-offset-2"
      >
        Call {label}
      </a>
    </aside>
  );
}
