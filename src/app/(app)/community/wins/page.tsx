import { getProfile } from "@/lib/auth/dal";
import { CommunityFeedView } from "@/components/community/CommunityFeedView";

/** "A dedicated Wins Board -- users share their weekly or daily wins here. Celebratory in tone." (brief) */
export default async function WinsBoardPage() {
  const profile = await getProfile();

  return (
    <CommunityFeedView
      profile={profile}
      scope="global"
      board="wins"
      composerPlaceholder="What's a win, big or small, from your day or week?"
      emptyMessage="No wins shared yet -- yours could be the first."
    />
  );
}
