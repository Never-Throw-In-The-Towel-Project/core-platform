import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";

// "Trusted by" strip -- partner/client logos supplied by Anthony (NTITT
// Logos/ at repo root). White chips so each logo reads regardless of its
// own background/format (mix of transparent PNG, opaque PNG, and JPEG).
const PARTNER_LOGOS = [
  { src: "/partners/aldi.png", name: "ALDI Australia" },
  { src: "/partners/amazon.png", name: "Amazon" },
  { src: "/partners/barbour.png", name: "Barbour" },
  { src: "/partners/kp-snacks.png", name: "KP Snacks" },
  { src: "/partners/loreal.png", name: "L'Oréal" },
  { src: "/partners/lighthouse-charity.png", name: "Lighthouse Charity" },
  { src: "/partners/the-hill-group.png", name: "The Hill Group" },
  { src: "/partners/vanlove.png", name: "Vanlove" },
];

// Public landing page. Phase 1 scope: prove tenant branding resolves and
// the route-group boundary is wired correctly. The real marketing site
// (brand story, testimonials, retreats, podcast) is a later phase -- see
// docs/ARCHITECTURE.md roadmap.
export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  return (
    <main className="flex flex-1 flex-col items-center gap-16 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={80} height={82} preload />
          {company?.logo_url && (
            <>
              <span className="text-2xl opacity-40">×</span>
              <div className="flex h-16 w-28 items-center justify-center rounded-md bg-white p-3">
                <Image
                  src={company.logo_url}
                  alt={company.name}
                  width={96}
                  height={40}
                  style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                />
              </div>
            </>
          )}
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          {company ? `${company.name} × Never Throw In The Towel` : "Never Throw In The Towel"}
        </h1>
        <p className="max-w-md text-brand-foreground/80">
          {company?.welcome_copy ??
            "Keep on Living. A daily wellbeing framework built around journaling, habit tracking, community, and video content."}
        </p>
        <Link
          href="/login"
          className="rounded-md bg-brand-accent px-6 py-3 font-semibold text-brand-accent-foreground"
        >
          Sign in
        </Link>
      </div>

      {/* Only on the default (non-branded) marketing page -- a company's
          own co-branded portal shouldn't show a generic partner wall. */}
      {!company && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs font-semibold tracking-widest text-brand-foreground/50 uppercase">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {PARTNER_LOGOS.map((partner) => (
              <div
                key={partner.src}
                className="flex h-16 w-32 items-center justify-center rounded-md bg-white p-3"
              >
                <Image
                  src={partner.src}
                  alt={partner.name}
                  width={104}
                  height={40}
                  style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
