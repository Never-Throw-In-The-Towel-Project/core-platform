-- ============================================================================
-- SECURITY: bind a community comment's scope/company_id to its parent post.
-- ============================================================================
-- Found in the full-platform security review. community_comments denormalizes
-- scope/company_id from its parent post (set by submitCommunityComment,
-- src/lib/actions/community.ts) so comment-visibility RLS doesn't need a
-- cross-table join on every read. But the INSERT policy only checked
-- `auth.uid() = user_id` + community_opt_in -- it never verified that the
-- submitted scope/company_id actually match the referenced post. Via a
-- direct PostgREST insert (anon key + a valid session JWT), a member of
-- company A could write a comment with { scope:'company', company_id:<B>,
-- post_id:<any> } and inject content into company B's company-only space,
-- or mislabel a company reply as 'global'. The parallel community_posts
-- INSERT policy already pins company_id to the author's own company
-- (phase7:73-83); comments were the gap.
--
-- The rebuilt policy mirrors that: it requires the parent post to exist and
-- to carry the same scope AND company_id the comment claims, and -- for
-- company-scoped comments -- that the author actually belongs to that
-- company (so a global post's comments stay open to everyone who can see
-- the post, while a company post's comments are writable only by that
-- company's own members). This makes RLS, not the server action, the real
-- boundary here, consistent with the rest of the schema.
drop policy "users create their own community comments" on public.community_comments;

create policy "users create their own community comments"
  on public.community_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.community_opt_in = true
    )
    -- scope + company_id must match the parent post exactly (the values the
    -- server action denormalizes) -- no injecting a mismatched label.
    and exists (
      select 1 from public.community_posts pp
      where pp.id = community_comments.post_id
        and pp.scope = community_comments.scope
        and pp.company_id = community_comments.company_id
    )
    -- a company-scoped comment must belong to the author's own company;
    -- global comments (scope='global') are open to any opted-in member who
    -- can see the post, so the OR short-circuits there.
    and (
      community_comments.scope = 'global'
      or community_comments.company_id = (
        select p.company_id from public.profiles p where p.id = auth.uid()
      )
    )
  );
