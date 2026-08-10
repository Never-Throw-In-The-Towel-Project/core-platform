import { headers } from "next/headers";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PreAuthSupport } from "@/components/PreAuthSupport";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";

/**
 * Shared nav for the public, no-signup-required marketing site -- home,
 * documentary, podcast, sign in. Everything paid/subscription content lives
 * behind /login (see docs/ARCHITECTURE.md); this is the free "taster" that
 * doesn't need one. Kept deliberately small: only real pages with real
 * content link here (no About/Events/Merchandise/Contact yet -- those need
 * source copy from Anthony before they're built, not invented copy).
 *
 * Resolves the request's company (by host) once here so MarketingNav knows
 * whether to show "Create account" -- self-service signup only exists for
 * the direct platform, never on a partner co-branded subdomain, so the link
 * is hidden whenever this resolves to a company (mirrors the same guard in
 * src/app/signup/page.tsx and lib/actions/signup.ts).
 *
 * Light background here (bg-background/text-foreground), overriding the
 * root layout's dark bg-brand-background/text-brand-foreground default --
 * matches neverthrowinthetowel.com's actual look (predominantly white, with
 * strategic dark sections for emphasis, not all-dark). The logged-in app
 * ((app)/(admin) layouts) is untouched and stays dark; this override is
 * scoped to this route group only.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const company = await resolveCompanyForHost(headerList.get("host") ?? "");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <MarketingNav showSignup={!company} />
      <div className="flex-1">{children}</div>
      {/* Crisis support on every marketing page too -- the brief's "visible
          on every single page of the website" is not scoped to the logged-in
          app. This is the pre-auth helpline entry point (a company's own
          designated support contact needs a signed-in user to route to; see
          PreAuthSupport). */}
      <footer className="border-t border-current/10 px-6 py-8">
        <PreAuthSupport />
      </footer>
    </div>
  );
}
