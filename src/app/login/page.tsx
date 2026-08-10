import { headers } from "next/headers";
import Image from "next/image";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { PreAuthSupport } from "@/components/PreAuthSupport";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const headerList = await headers();
  const company = await resolveCompanyForHost(headerList.get("host") ?? "");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="flex items-center gap-3">
        <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={65} />
        {company?.logo_url && (
          <>
            <span className="text-lg opacity-40">×</span>
            <div className="flex h-12 w-20 items-center justify-center rounded-md bg-white p-2">
              <Image
                src={company.logo_url}
                alt={company.name}
                width={72}
                height={32}
                style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
              />
            </div>
          </>
        )}
      </div>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <LoginForm next={next} />
      <PreAuthSupport />
    </main>
  );
}
