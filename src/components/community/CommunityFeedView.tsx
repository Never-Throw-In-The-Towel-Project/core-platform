import { createClient } from "@/lib/supabase/server";
import { getComments, getPosts } from "@/lib/community/queries";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { CommunityGuidelines } from "./CommunityGuidelines";
import { CommunitySidebar } from "./CommunitySidebar";
import { CommunityRightRail } from "./CommunityRightRail";
import type { CommunityScope, Profile } from "@/types/database";

/**
 * Shared by /community and /community/company -- the design reference's
 * three-column feed shell (Spaces + podcast on the left, the feed itself in
 * the centre, Guidelines + your display name on the right). The Wins Board
 * is a deliberately different, sidebar-free layout in the reference (see
 * src/app/(app)/community/wins/page.tsx), so it doesn't use this.
 */
export async function CommunityFeedView({
  profile,
  scope,
  heading,
  composerPlaceholder,
  emptyMessage,
}: {
  profile: Profile;
  scope: CommunityScope;
  heading: string;
  composerPlaceholder: string;
  emptyMessage: string;
}) {
  if (!profile.community_opt_in) {
    return <CommunityGuidelines showAccept />;
  }

  const supabase = await createClient();

  const [posts, { data: company }, { data: podcastEpisode }] = await Promise.all([
    getPosts(supabase, { scope, board: "feed", companyId: profile.company_id, viewerUserId: profile.id }),
    supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle(),
    supabase
      .from("podcast_episodes")
      .select("title, embed_url")
      .order("release_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const commentsByPost = await Promise.all(posts.map((post) => getComments(supabase, post.id)));

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[200px_1fr_240px]">
      <CommunitySidebar
        active={scope === "company" ? "company" : "feed"}
        companyName={company?.name ?? null}
        podcastEpisode={podcastEpisode}
        podcastOptedIn={profile.podcast_guest_opt_in}
        podcastAnonymityPreference={profile.podcast_guest_anonymity_preference}
      />

      <div>
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">{heading}</p>
        <div className="mt-3">
          <PostComposer scope={scope} board="feed" placeholder={composerPlaceholder} />
        </div>
        <div className="mt-2">
          {posts.length === 0 && <p className="py-6 text-sm opacity-60">{emptyMessage}</p>}
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} comments={commentsByPost[i]} />
          ))}
        </div>
      </div>

      <CommunityRightRail displayName={profile.display_name} />
    </div>
  );
}
