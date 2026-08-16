import { headers } from "next/headers";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { DefaultHome } from "@/components/marketing/home/DefaultHome";
import { PartnerHome } from "@/components/marketing/home/PartnerHome";

/**
 * Marketing home -- a thin orchestrator. On a partner co-branded subdomain
 * (resolveCompanyForHost returns a company) we render the tailored PartnerHome,
 * focused purely on getting that employer's staff signed in. Everywhere else we
 * render the individuals-first DefaultHome, which sells the login-gated platform
 * and routes employers to their own lane. Both compositions live under
 * src/components/marketing/home/.
 *
 * The page resolves the company itself (rather than taking it from the layout)
 * because the layout doesn't pass it down -- the same pattern the previous home
 * and src/app/(marketing)/what-i-do/page.tsx use.
 */
export default async function MarketingHomePage() {
  const host = (await headers()).get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  return company ? <PartnerHome company={company} /> : <DefaultHome />;
}
