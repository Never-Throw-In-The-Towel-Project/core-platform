-- ============================================================================
-- SUBSCRIPTIONS & BILLING — Phase 1 (B2C) schema.
-- ============================================================================
-- Stripe-backed subscriptions for self-service Direct individuals. See
-- docs/SUBSCRIPTIONS_PLAN.md. Two per-user tables in `public` (deliberately NOT
-- `private` -- this is billing state, not personal wellbeing data; it is never
-- aggregated into company metrics):
--
--   billing_customers — one row per user with a billing footprint: the Stripe
--                       customer mapping + the no-card trial guard.
--   subscriptions     — one row per user: their CURRENT subscription/trial
--                       state, the authoritative input to the entitlement layer.
--
-- SECURITY MODEL (critical): a member may READ their own row (to show plan/status
-- in Settings) but may NEVER write either table. All writes come from the Stripe
-- webhook and the start-trial action via the SERVICE-ROLE client, which bypasses
-- RLS -- so entitlement is tamper-proof, exactly like profiles.tc_agreed_at. We
-- therefore grant ONLY `select` to `authenticated`, enable RLS, and define ONLY a
-- select-own-row policy. With no insert/update/delete policy, RLS denies member
-- writes regardless of any default grant Supabase adds to public tables.
-- ============================================================================

-- ---- billing_customers: per-user Stripe customer map + trial guard -----------
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The Stripe Customer for this user. Null until they first reach Checkout.
  stripe_customer_id text unique,
  -- Set when the user starts their no-card app-level trial. THE one-trial guard:
  -- the start-trial action refuses when this is already set, so a lapsed user
  -- never gets a second free trial. Service-role write only.
  trial_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.billing_customers to authenticated;
alter table public.billing_customers enable row level security;
create policy "own billing_customers read" on public.billing_customers
  for select using (auth.uid() = user_id);

-- ---- subscriptions: the authoritative per-user subscription/trial state -------
create table public.subscriptions (
  -- One row per user: their CURRENT subscription (or trial). The app-trial row is
  -- updated IN PLACE on conversion to a paid Stripe subscription, so the
  -- entitlement layer only ever reads a single row per user.
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Where this row came from: an app-level (no-card) trial, or a real Stripe sub.
  source text not null,
  -- Stripe's own subscription status values (plus app-trial's 'trialing').
  status text not null,
  tier text not null default 'pro',
  -- The Stripe Price the user is on (monthly/annual). Null for an app-trial.
  price_id text,
  -- The Stripe Subscription id. Null for an app-trial (no Stripe object yet);
  -- set on conversion. Unique so the webhook can reconcile by it.
  stripe_subscription_id text unique,
  -- End of the current paid period (Stripe). Null for an app-trial.
  current_period_end timestamptz,
  -- Trial expiry (app-trial or a Stripe trial).
  trial_end timestamptz,
  -- "Cancels at period end": keeps full access until current_period_end passes.
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_source_chk check (source in ('app_trial', 'stripe')),
  constraint subscriptions_status_chk check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')
  ),
  constraint subscriptions_tier_chk check (tier in ('pro'))
);

grant select on public.subscriptions to authenticated;
alter table public.subscriptions enable row level security;
create policy "own subscriptions read" on public.subscriptions
  for select using (auth.uid() = user_id);

-- The webhook reconciles by stripe_subscription_id; the FK + PK already index
-- user_id. This indexes the Stripe-id lookup (nullable; app-trials excluded).
create index subscriptions_stripe_sub_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
