-- Run automatically by `supabase db reset`/`supabase db push` after every
-- migration -- the idiomatic Supabase CLI place for reference/starter data
-- that isn't a schema change.
--
-- Confirmed with the team (Phase 10): of the 8 partner/sponsor logos on the
-- public marketing page's "Trusted by" strip, Amazon and KP Snacks are the
-- two with an actual co-branded portal for now -- everyone else is a
-- sponsor/"worked with" credit only, not a company row. logo_url points at
-- the same /public/partners/*.png files the marketing page already serves
-- (see src/app/(marketing)/page.tsx, src/app/login/page.tsx for where this
-- renders). primary_color/accent_color/support_contact_* are deliberately
-- left null -- no real brand color or support routing info exists for
-- either yet, and this schema's ThemeProvider mechanism already falls back
-- to the NTITT default (monochrome, Phase 10) when a company doesn't
-- override them, so leaving them null is the correct "not yet decided"
-- state, not a bug.
insert into public.companies (name, slug, logo_url, welcome_copy)
values
  (
    'Amazon',
    'amazon',
    '/partners/amazon.png',
    'Keep on Living -- your wellbeing framework, brought to you with Amazon.'
  ),
  (
    'KP Snacks',
    'kp-snacks',
    '/partners/kp-snacks.png',
    'Keep on Living -- your wellbeing framework, brought to you with KP Snacks.'
  )
on conflict (slug) do nothing;
