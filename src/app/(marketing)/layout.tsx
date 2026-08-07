import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * Shared nav for the public, no-signup-required marketing site -- home,
 * documentary, podcast, sign in. Everything paid/subscription content lives
 * behind /login (see docs/ARCHITECTURE.md); this is the free "taster" that
 * doesn't need one. Kept deliberately small: only real pages with real
 * content link here (no About/Events/Merchandise/Contact yet -- those need
 * source copy from Anthony before they're built, not invented copy).
 *
 * Light background here (bg-background/text-foreground), overriding the
 * root layout's dark bg-brand-background/text-brand-foreground default --
 * matches neverthrowinthetowel.com's actual look (predominantly white, with
 * strategic dark sections for emphasis, not all-dark). The logged-in app
 * ((app)/(admin) layouts) is untouched and stays dark; this override is
 * scoped to this route group only.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <MarketingNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
