import { createClient } from "@/lib/supabase/server";
import { getComments, getPosts } from "@/lib/community/queries";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { CommunityGuidelines } from "./CommunityGuidelines";
import type { CommunityBoard, CommunityScope, Profile } from "@/types/database";

/**
 * Shared by /community, /community/wins, and /community/company -- same
 * rendering logic (guidelines gate, composer, post list) three times over
 * with only scope/board/copy differing, not three near-duplicate pages.
 */
export async function CommunityFeedView({
  profile,
  scope,
  board,
  composerPlaceholder,
  emptyMessage,
}: {
  profile: Profile;
  scope: CommunityScope;
  board: CommunityBoard;
  composerPlaceholder: string;
  emptyMessage: string;
}) {
  if (!profile.community_opt_in) {
    return <CommunityGuidelines showAccept />;
  }

  const supabase = await createClient();
  const posts = await getPosts(supabase, {
    scope,
    board,
    companyId: profile.company_id,
    viewerUserId: profile.id,
  });

  const commentsByPost = await Promise.all(posts.map((post) => getComments(supabase, post.id)));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <PostComposer scope={scope} board={board} placeholder={composerPlaceholder} />
      <div className="mt-6 space-y-4">
        {posts.length === 0 && <p className="text-sm opacity-60">{emptyMessage}</p>}
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} comments={commentsByPost[i]} />
        ))}
      </div>
    </div>
  );
}
