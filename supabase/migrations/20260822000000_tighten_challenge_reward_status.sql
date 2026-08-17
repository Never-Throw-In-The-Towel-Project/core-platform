-- ============================================================================
-- Tighten company_step_challenges: drop the retired 'anthony_visit' reward and
-- the 'pending_confirmation' status from their CHECK constraints.
-- ============================================================================
-- The Anthony-visit reward -- an NTITT-run, paid, in-person booking gated behind
-- an HMAC-signed availability-confirm link -- and its interim
-- 'pending_confirmation' state were retired: the step-challenge prize is the
-- partner company's to choose, fund and host, so every challenge now launches
-- straight to 'active'. The application already stopped writing both values (the
-- reward type is gone from the selectable set and the create-action schema, and
-- the whole confirm-email flow was removed).
--
-- The original table migration (20260813020000_company_step_challenges.sql) left
-- both values valid in the CHECKs as a deliberate, harmless superset so that no
-- later migration was FORCED. This is that (now-wanted) later migration: it makes
-- the retirement authoritative at the schema level, so no code path -- a raw
-- insert, a bulk import, another service, or a hand-edit in the dashboard -- can
-- reintroduce a retired value. Bringing either back would now require an explicit,
-- reviewed widening migration rather than slipping in unnoticed.
--
-- Guarded: Postgres would reject the narrowed CHECK on its own if a legacy row
-- still held a retired value, but with an opaque constraint error. We assert
-- emptiness FIRST and raise a clear, actionable message instead -- settle those
-- rows, then re-run. (Pre-launch there are none; this is belt-and-braces.)
do $$
declare
  n_reward int;
  n_status int;
begin
  select count(*) into n_reward
    from public.company_step_challenges where reward_type = 'anthony_visit';
  select count(*) into n_status
    from public.company_step_challenges where status = 'pending_confirmation';
  if n_reward > 0 or n_status > 0 then
    raise exception
      'Cannot tighten company_step_challenges CHECKs: % row(s) use reward_type=anthony_visit and % row(s) use status=pending_confirmation; migrate them to a supported value first.',
      n_reward, n_status;
  end if;
end
$$;

-- reward_type: drop 'anthony_visit'. Postgres names an inline column CHECK
-- deterministically as <table>_<column>_check; drop-and-re-add is the only way to
-- narrow a CHECK (it cannot be altered in place).
alter table public.company_step_challenges
  drop constraint company_step_challenges_reward_type_check,
  add constraint company_step_challenges_reward_type_check
    check (reward_type in (
      'team_experience', 'extra_day_off', 'charity_donation', 'prize_draw'
    ));

-- status: drop 'pending_confirmation'; the lifecycle is now draft -> active ->
-- completed, with cancelled as the off-ramp.
alter table public.company_step_challenges
  drop constraint company_step_challenges_status_check,
  add constraint company_step_challenges_status_check
    check (status in ('draft', 'active', 'completed', 'cancelled'));
