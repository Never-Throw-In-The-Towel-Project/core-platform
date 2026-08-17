import { CommunityTabs } from "@/components/community/CommunityTabs";
import { getProfile } from "@/lib/auth/dal";
import { isCompanyOrgMember } from "@/lib/community/membership";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  // The "My Company" space is only for members of a real company organisation --
  // not Direct (self-signup) individuals (a shared "company" feed there would
  // pool strangers) nor platform admins (the synthetic NTITT-internal company).
  // getProfile is React-cached, so this adds no query beyond what the pages do.
  const profile = await getProfile();
  const showCompanyTab = isCompanyOrgMember(profile);

  return (
    <div>
      <CommunityTabs showCompanyTab={showCompanyTab} />
      {children}
    </div>
  );
}
