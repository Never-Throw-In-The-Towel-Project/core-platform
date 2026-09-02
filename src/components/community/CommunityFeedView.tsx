import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCommentsForPosts, getPosts } from "@/lib/community/queries";
import type { FeedSort } from "@/lib/community/sort";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { CommunityGuidelines } from "./CommunityGuidelines";
import { CommunitySidebar } from "./CommunitySidebar";
import { CommunityRightRail } from "./CommunityRightRail";
import { isCompanyOrgMember } from "@/lib/community/membership";
import type { CommunityScope, Profile } from "@/types/database";

const SORT_TABS: { key: FeedSort; label: string }[] = [
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
  { key: "hot", label: "Hot" },
];

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
  sort,
  basePath,
}: {
  profile: Profile;
  scope: CommunityScope;
  heading: string;
  composerPlaceholder: string;
  emptyMessage: string;
  sort: FeedSort;
  basePath: string;
}) {
  if (!profile.community_opt_in) {
    return <CommunityGuidelines showAccept />;
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Degrading to an empty feed is the same shape this page already renders
  // for a genuinely new company/board (emptyMessage), not a distinct case
  // worth crashing this screen over.
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  let company: { name: string } | null = null;
  let podcastEpisode: { title: string; embed_url: string } | null = null;
  let commentsByPost: Awaited<ReturnType<typeof getCommentsForPosts>> = new Map();
  try {
    const supabase = await createClient();

    const [postsResult, companyResult, podcastResult] = await Promise.all([
      getPosts(supabase, { scope, board: "feed", companyId: profile.company_id, viewerUserId: profile.id, sort }),
      supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle(),
      supabase
        .from("podcast_episodes")
        .select("title, embed_url")
        .order("release_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    posts = postsResult;
    company = companyResult.data;
    podcastEpisode = podcastResult.data;
    // One batched read for every visible post's comments (was a getComments()
    // fan-out per post -- ~150 round-trips for a full page); PostCard reads its
    // own thread out of the map below.
    commentsByPost = await getCommentsForPosts(
      supabase,
      posts.map((post) => post.id)
    );
  } catch {
    posts = [];
    company = null;
    podcastEpisode = null;
    commentsByPost = new Map();
  }

  // One server-computed "now" for every card's relative timestamp, so SSR and
  // client hydration render the same string.
  const nowIso = new Date().toISOString();

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[200px_1fr_240px]">
      <CommunitySidebar
        active={scope === "company" ? "company" : "feed"}
        // Only real company-org members get the company space link (matches the
        // My Company tab gating); Direct/admin users see just the global spaces.
        companyName={isCompanyOrgMember(profile) ? company?.name ?? null : null}
        podcastEpisode={podcastEpisode}
        podcastOptedIn={profile.podcast_guest_opt_in}
        podcastAnonymityPreference={profile.podcast_guest_anonymity_preference}
      />

      {/* Feed leads on mobile: the composer + posts are the primary content, so
          they sit first on a phone (order-first). The two side rails stack below
          it. On lg the explicit 3-column grid takes over and order resets, so the
          desktop Spaces | feed | guidelines layout is unchanged. */}
      <div className="order-first lg:order-none">
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">
            The feed
          </p>
          <h1 className="mt-1 text-2xl font-extrabold leading-none tracking-tight">{heading}</h1>
        </header>
        <div className="mt-4">
          <PostComposer
            scope={scope}
            board="feed"
            placeholder={composerPlaceholder}
            authorName={profile.display_name}
          />
        </div>

        {/* Sort the feed: New (default), Top (most-liked), Hot (recency-weighted
            popularity). Plain links so it works without JS and each sort is a
            shareable URL; "new" points at the bare path to keep it canonical. */}
        <nav aria-label="Sort the feed" className="mt-5 flex gap-5 border-b border-rule-hairline">
          {SORT_TABS.map((tab) => {
            const active = sort === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === "new" ? basePath : `${basePath}?sort=${tab.key}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 py-3 text-xs font-extrabold uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-brand-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-4">
          {posts.length === 0 && <p className="py-8 text-sm text-muted">{emptyMessage}</p>}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} comments={commentsByPost.get(post.id) ?? []} now={nowIso} />
          ))}
        </div>
      </div>

      <CommunityRightRail displayName={profile.display_name} />
    </div>
  );
}
