import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { PreAuthSupport } from "@/components/PreAuthSupport";
import { SignupForm } from "./SignupForm";

/**
 * Direct/public signup only. Authoritative guard against provisioning a
 * partner co-branded company (DB-backed, so it also catches a flagship
 * client's custom_domain, not just an *.neverthrowinthetowel.uk subdomain -- a cheap
 * hostname check in proxy.ts alone can't see custom domains) -- redirects
 * to /login instead, preserving the host so it lands on that org's own
 * co-branded sign-in. lib/actions/signup.ts repeats this same check
 * server-side, since a server action is reachable independently of how its
 * page renders.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const headerList = await headers();
  const company = await resolveCompanyForHost(headerList.get("host") ?? "");

  if (company) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={65} />
      <h1 className="text-2xl font-bold">Create account</h1>
      <SignupForm next={next} />
      <PreAuthSupport />
    </main>
  );
}
