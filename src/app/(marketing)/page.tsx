import { headers } from "next/headers";
import Link from "next/link";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";

// Public landing page. Phase 1 scope: prove tenant branding resolves and
// the route-group boundary is wired correctly. The real marketing site
// (brand story, testimonials, retreats, podcast) is a later phase -- see
// docs/ARCHITECTURE.md roadmap.
export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        {company ? `${company.name} × Never Throw In The Towel` : "Never Throw In The Towel"}
      </h1>
      <p className="max-w-md text-brand-foreground/80">
        {company?.welcome_copy ??
          "Keep on Living. A daily wellbeing framework built around journaling, habit tracking, community, and video content."}
      </p>
      <Link
        href="/login"
        className="rounded-md bg-brand-accent px-6 py-3 font-semibold text-white"
      >
        Sign in
      </Link>
    </main>
  );
}
