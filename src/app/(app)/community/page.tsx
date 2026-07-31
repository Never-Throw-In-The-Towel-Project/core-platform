import { getProfile } from "@/lib/auth/dal";
import { CommunityFeedView } from "@/components/community/CommunityFeedView";
import { PodcastOptIn } from "./podcast-optin";

/**
 * Main feed -- NTITT-wide (scope='global'), the primary community space per
 * docs/ARCHITECTURE.md "Community scope". "A main feed where users can post
 * messages, wins, reflections, and encouragement" (brief section 8).
 */
export default async function CommunityPage() {
  const profile = await getProfile();

  return (
    <>
      {profile.community_opt_in && (
        <div className="mx-auto max-w-2xl px-6 pt-8">
          <PodcastOptIn optedIn={profile.podcast_guest_opt_in} />
        </div>
      )}
      <CommunityFeedView
        profile={profile}
        scope="global"
        board="feed"
        composerPlaceholder="Share something with the community…"
        emptyMessage="Nothing here yet -- be the first to post."
      />
    </>
  );
}
