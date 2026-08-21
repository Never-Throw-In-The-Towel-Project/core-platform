-- ============================================================================
-- SEED: Thursday Thoughts rotating quote bank.
-- ============================================================================
-- public.daily_quotes was created (20260731000000) but never populated, so
-- Thursday Thoughts has shown no quote. These are the 15 rotating quotes from
-- Anthony's published journal, in the journal's order. The resolver picks one
-- per real ISO week: getDailyQuote() -> resolveBankPosition(isoWeek, count),
-- which returns ((isoWeek - 1) % count) + 1, so bank_position MUST be a
-- contiguous 1..N sequence (here 1..15).
--
-- Fixed reference data written only by migrations: daily_quotes grants SELECT
-- to authenticated and has no write policy, so there is no admin UI -- the
-- migration/service-role IS the intended write path. Idempotent via
-- `on conflict (bank_position) do nothing`, so a re-run (or a later position
-- edited by hand) is never clobbered.
--
-- author is left null for the quotes the journal prints unattributed -- no
-- attributions are invented. The render (ThemedCheckinForm) only shows the
-- footer when author is present.
insert into public.daily_quotes (bank_position, quote_text, author)
values
  (1, 'Your happiness depends on the quality of your thoughts.', 'Marcus Aurelius'),
  (2, 'Thoughts become things.', null),
  (3, 'Every adversity, every failure, every heartache carries with it the seed of an equal or greater benefit.', 'Napoleon Hill'),
  (4, 'The mind is everything. What you think, you become.', 'Buddha'),
  (5, 'You cannot control what happens to you, but you can control how you respond.', null),
  (6, 'Where focus goes, energy flows.', null),
  (7, 'Your thoughts shape your reality.', null),
  (8, 'Discipline is choosing between what you want now and what you want most.', null),
  (9, 'Win the next point.', null),
  (10, 'The strongest people are built through the hardest moments.', null),
  (11, 'Energy grows where gratitude goes.', null),
  (12, 'You become what you repeatedly do.', null),
  (13, 'One small positive thought can change your whole day.', null),
  (14, 'There is no difference between a hero and a coward in what they feel. It''s what they do that makes them different.', null),
  (15, 'Your habits shape your future.', null)
on conflict (bank_position) do nothing;
