-- ============================================================================
-- COMMUNITY: conscious badge sharing (Step Count & Gamification brief §3).
-- ============================================================================
-- Badges are earned PRIVATELY (private.earned_badges, own-rows-only) and appear
-- only on the member's own Journey. This adds the brief's "visible to others
-- only if the user shares" surface: a member may CHOOSE to share a badge to the
-- community wins board, which creates an ordinary public.community_posts row
-- carrying the badge_key here so the tile can render it. Nothing is shared
-- automatically -- only an explicit action writes one of these.
--
-- Purely additive: one nullable column. When NULL the post is an ordinary post
-- (every existing row reads exactly as before). RLS is UNCHANGED -- the Phase 7
-- INSERT policy already gates who may post (own row, own company,
-- community_opt_in) and doesn't constrain content columns, so a shared-badge
-- post is authorised exactly like any other post. The badge_key is COPIED (not
-- FK'd) from private.earned_badges: the share action reads the caller's OWN
-- earned badge under the private client and writes the string here, since a
-- public table can't reference a private, per-user table across the RLS
-- boundary. The action also verifies ownership, so this column can only ever
-- hold a badge its author actually earned.
alter table public.community_posts
  add column shared_badge_key text;

comment on column public.community_posts.shared_badge_key is
  'Set when a member consciously shares a badge they earned (private.earned_badges) to the wins board; carries the badge_key so the tile can render it. NULL = an ordinary post. Badges stay private unless shared.';
