-- FIX: the brief's podcast guest consent process (a written explanation of
-- what's recorded/shared, an anonymity choice, and a recorded right to
-- withdraw -- "this protects the guest and protects the platform legally")
-- had no schema backing at all. podcast_guest_opt_in was a bare boolean
-- with no record of what the guest was actually told or agreed to, and no
-- way to tell an active opt-in from a stale one predating this consent
-- flow. See src/app/(app)/community/podcast-optin.tsx and
-- src/lib/actions/community.ts's updatePodcastGuestOptIn.
--
-- podcast_guest_anonymity_preference is nullable (not set until someone
-- actually opts in through the new consent form) and constrained to the
-- three choices the brief names. podcast_guest_consented_at is stamped
-- every time someone opts in (including re-opting-in after a withdrawal),
-- since the consent explanation is re-shown and re-agreed to each time --
-- it is the durable proof-of-consent record the brief calls for, not just
-- a UI nicety.
alter table public.profiles
  add column podcast_guest_anonymity_preference text
    check (podcast_guest_anonymity_preference in ('full_name', 'first_name_only', 'anonymous')),
  add column podcast_guest_consented_at timestamptz;
