import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { CommunityFeedView } from "@/components/community/CommunityFeedView";
import { parseFeedSort } from "@/lib/community/sort";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";

/**
 * "An optional company-specific space as well... so KP Snacks staff can
 * also connect just with each other if they want. Both spaces exist side
 * by side" (brief) -- the co-branded overlay on top of the shared, global
 * community, per docs/ARCHITECTURE.md "Core platform vs. co-branded portals".
 */
export default async function CompanySpacePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const profile = await getProfile();

  // Direct (self-signup) members have no real company space -- the tab is hidden
  // for them in the layout; guard the route too so a typed/bookmarked URL can't
  // reach a stranger-pool feed (docs/PLATFORM_STRUCTURE.md decision 6).
  if (profile.company_id === DIRECT_COMPANY_ID) {
    redirect("/community");
  }

  const { sort } = await searchParams;

  return (
    <CommunityFeedView
      profile={profile}
      scope="company"
      basePath="/community/company"
      sort={parseFeedSort(sort)}
      heading="Your company"
      composerPlaceholder="Share something with your colleagues…"
      emptyMessage="Nothing here yet -- be the first from your company to post."
    />
  );
}
