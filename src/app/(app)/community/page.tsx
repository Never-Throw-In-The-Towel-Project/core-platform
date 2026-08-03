import { getProfile } from "@/lib/auth/dal";
import { CommunityFeedView } from "@/components/community/CommunityFeedView";

/**
 * Main feed -- NTITT-wide (scope='global'), the primary community space per
 * docs/ARCHITECTURE.md "Community scope". "A main feed where users can post
 * messages, wins, reflections, and encouragement" (brief section 8).
 */
export default async function CommunityPage() {
  const profile = await getProfile();

  return (
    <CommunityFeedView
      profile={profile}
      scope="global"
      heading="Everyone on NTITT"
      composerPlaceholder="Post a message, a win, or a reflection"
      emptyMessage="Nothing here yet -- be the first to post."
    />
  );
}
