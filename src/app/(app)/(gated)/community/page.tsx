import { getProfile } from "@/lib/auth/dal";
import { CommunityFeedView } from "@/components/community/CommunityFeedView";
import { parseFeedSort } from "@/lib/community/sort";

/**
 * Main feed -- NTITT-wide (scope='global'), the primary community space per
 * docs/ARCHITECTURE.md "Community scope". "A main feed where users can post
 * messages, wins, reflections, and encouragement" (brief section 8).
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const profile = await getProfile();
  const { sort } = await searchParams;

  return (
    <CommunityFeedView
      profile={profile}
      scope="global"
      basePath="/community"
      sort={parseFeedSort(sort)}
      heading="Everyone on NTITT"
      composerPlaceholder="Post a message, a win, or a reflection"
      emptyMessage="Nothing here yet -- be the first to post."
    />
  );
}
