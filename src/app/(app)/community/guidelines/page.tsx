import { getProfile } from "@/lib/auth/dal";
import { CommunityGuidelines } from "@/components/community/CommunityGuidelines";

/** "Community guidelines... accessible any time" (brief) -- the standalone version of the first-visit gate. */
export default async function CommunityGuidelinesPage() {
  const profile = await getProfile();
  return <CommunityGuidelines showAccept={!profile.community_opt_in} />;
}
