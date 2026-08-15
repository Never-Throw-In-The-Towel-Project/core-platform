import { CommunityTabs } from "@/components/community/CommunityTabs";
import { getProfile } from "@/lib/auth/dal";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  // Direct (self-signup) members share the single NTITT-Direct company row, so a
  // "My Company" feed would pool unrelated strangers -- hide the tab for them
  // (docs/PLATFORM_STRUCTURE.md decision 6). getProfile is React-cached, so this
  // adds no query beyond what the pages already do.
  const profile = await getProfile();
  const showCompanyTab = profile.company_id !== DIRECT_COMPANY_ID;

  return (
    <div>
      <CommunityTabs showCompanyTab={showCompanyTab} />
      {children}
    </div>
  );
}
