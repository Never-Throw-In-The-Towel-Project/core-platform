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

  // The community area is a dark "ink" surface, matching the Today board: the
  // ink scope (globals.css) remaps the ground tokens so the tabs bar and every
  // child page -- feed, wins, guidelines, company -- render on near-black, while
  // the same shared components stay light on their own pages. min-h-full so the
  // ink fills the viewport under the (app) shell's flex-1 content slot.
  return (
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
      <CommunityTabs showCompanyTab={showCompanyTab} />
      {children}
    </div>
  );
}
