// Hand-written types mirroring supabase/migrations/20260730000000_init_schema.sql.
// Once a live Supabase project exists, regenerate with `supabase gen types
// typescript` and reconcile — this file exists so we get type safety before
// that project exists, not as a permanent hand-maintained source of truth.

export type UserRole = "employee" | "hr_admin" | "ntitt_admin";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type ReviewType = "30_day" | "90_day";
export type SupportUrgency = "check_in" | "talk_today" | "urgent";
export type SupportStatus = "new" | "contacted" | "resolved";
export type VideoCategory = "mental_fitness" | "physical_fitness" | "nutrition" | "tools_tips";
export type WorkoutTier = "beginner" | "intermediate" | "advanced" | "elite";
export type CommunityScope = "global" | "company";
export type CommunityBoard = "feed" | "wins";
export type PushNotificationType = "morning" | "night" | "sunday";

export interface Company {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  welcome_copy: string | null;
  support_contact_name: string | null;
  support_contact_phone: string | null;
  support_contact_email: string | null;
  ninety_day_report_sent_at: string | null;
  created_at: string;
}

export type PodcastGuestAnonymityPreference = "full_name" | "first_name_only" | "anonymous";

export interface Profile {
  id: string;
  company_id: string;
  role: UserRole;
  display_name: string;
  onboarding_completed: boolean;
  community_opt_in: boolean;
  podcast_guest_opt_in: boolean;
  podcast_guest_anonymity_preference: PodcastGuestAnonymityPreference | null;
  podcast_guest_consented_at: string | null;
  morning_notification_time: string | null;
  night_notification_time: string | null;
  sunday_notification_time: string | null;
  timezone: string;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface MorningEntry {
  id: string;
  user_id: string;
  entry_date: string;
  sleep_score: number | null; // NEVER surface this outside the owning user's own view
  morning_walk: boolean;
  breathwork: boolean;
  cold_dip: boolean;
  power_list: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface NightEntry {
  id: string;
  user_id: string;
  entry_date: string;
  no_phone_before_bed: boolean;
  hot_bath_or_shower: boolean;
  gratitude: string | null;
  highlight: string | null;
  day_rating: number | null; // NEVER surface this outside the owning user's own view
  looking_ahead: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ThemedCheckin {
  id: string;
  user_id: string;
  week_start_date: string;
  weekday: Weekday;
  goals: Record<string, unknown> | null;
  answers: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
}

export interface SundaySetup {
  id: string;
  user_id: string;
  week_start_date: string;
  prep_notes: string | null;
  intention: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ContentVideo {
  id: string;
  vimeo_id: string;
  title: string;
  category: VideoCategory;
  tags: string[];
  workout_tier: WorkoutTier | null;
  duration_seconds: number | null;
  created_at: string;
}

// The content-platform spine (see docs/CONTENT_PLATFORM_STRATEGY.md and
// supabase/migrations/20260812010000_content_platform_spine.sql). Generalises
// content_videos into typed, day-taggable, channel-targetable content.
export type ContentType = "video" | "document" | "image";

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  summary: string | null;
  /** The "theme" dimension; reuses the video category enum for now. */
  category: VideoCategory;
  /** ISO weekday, 1 = Monday … 7 = Sunday. null = day-agnostic. */
  day_of_week: number | null;
  vimeo_id: string | null;
  /** Object path within the `content-assets` Storage bucket (document/image). */
  asset_path: string | null;
  external_url: string | null;
  tags: string[];
  workout_tier: WorkoutTier | null;
  duration_seconds: number | null;
  is_published: boolean;
  created_by: string | null;
  /** Which Brain folder this item is filed in; null = "Unfiled". */
  folder_id: string | null;
  /** Distribution-calendar publish date (ISO yyyy-mm-dd). A draft carrying one
   *  is auto-published on that date by the publish-scheduled-content cron;
   *  null = not date-scheduled. */
  scheduled_for: string | null;
  created_at: string;
}

// Per-partner targeting join. ZERO rows for an item = NTITT-wide (visible to
// every channel); a row per company targets/restricts it, ordered by priority.
export interface ContentChannelPlacement {
  id: string;
  content_item_id: string;
  company_id: string;
  priority: number;
  created_at: string;
}

// The Brain knowledge base's organising unit (see
// supabase/migrations/20260815000000_brain_content_folders.sql). ntitt_admin-only,
// internal to the Super Admin Brain — members never see folders. A content_item's
// folder_id points here; null = "Unfiled".
export interface ContentFolder {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

// Challenges — the "container" pillar (docs/CONTENT_PLATFORM_STRATEGY.md
// "Pillar 3", supabase/migrations/20260812020000_challenges.sql). The public
// definition (challenges + challenge_days) sequences the content spine; a
// member's participation (enrollment + completions) is private.
export interface Challenge {
  id: string;
  title: string;
  summary: string | null;
  category: VideoCategory;
  length_days: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChallengeDay {
  id: string;
  challenge_id: string;
  day_index: number;
  content_item_id: string | null;
  prompt: string | null;
  created_at: string;
}

// Private participation (own-rows-only RLS). Deliberately no start-date /
// expected-day field: progress is completion-count only. See the migration.
export interface ChallengeEnrollment {
  id: string;
  user_id: string;
  challenge_id: string;
  created_at: string;
}

export interface ChallengeDayCompletion {
  id: string;
  user_id: string;
  challenge_day_id: string;
  challenge_id: string;
  completed_at: string;
}

// A challenge day joined to its (optional) spine item, for the detail view.
export interface ChallengeDayWithContent extends ChallengeDay {
  content: ContentItem | null;
}

// A published challenge plus the caller's own progress, for the list view.
export interface ChallengeWithProgress extends Challenge {
  enrolled: boolean;
  completed_days: number;
}

// Events -- real-world community meet-ups shown on three surfaces (super-admin
// Studio, members' app, and the logged-out marketing site). See
// supabase/migrations/20260817000000_events.sql. Named EventRow, not Event, to
// avoid shadowing the DOM `Event` global in client components.
export type EventBookingStatus = "confirmed" | "waitlisted" | "pending" | "cancelled";

export interface EventRow {
  id: string;
  /** null = NTITT-global (public + every member); set = one company's staff only. */
  company_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_url: string | null;
  image_url: string | null;
  /** null = unlimited; else the confirmed-booking cap (further bookings waitlist). */
  capacity: number | null;
  /** Denormalised confirmed tally, kept current by book_event()/cancel_my_booking();
   *  lets the anon marketing surface show "12 / 20 booked" without exposing bookings. */
  confirmed_count: number;
  is_published: boolean;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// A member/guest booking. Exactly one identity: user_id XOR guest_email (CHECK).
export interface EventBooking {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: EventBookingStatus;
  created_at: string;
  updated_at: string;
}

// A published event decorated with the caller's own booking status (null = not
// booked / cancelled), for the members' list + detail views.
export interface EventWithBooking extends EventRow {
  my_booking_status: EventBookingStatus | null;
}

// A booking row joined to the member's display name (member bookings only;
// guests carry their own name), for the admin attendee roster.
export interface EventBookingWithIdentity extends EventBooking {
  member: { display_name: string } | null;
}

// Self-reported daily steps (Track 2 · D2). A PRIVATE, never-reportable health
// metric -- own-rows-only, exactly like sleep_score / day_rating. See the
// step_entries migration.
export interface StepEntry {
  id: string;
  user_id: string;
  entry_date: string;
  steps: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutWeek {
  id: string;
  bank_position: number;
  created_at: string;
}

export interface WorkoutWeekExercise {
  id: string;
  workout_week_id: string;
  exercise_order: number;
  exercise_name: string;
  beginner_video_id: string | null;
  intermediate_video_id: string | null;
  advanced_video_id: string | null;
  elite_video_id: string | null;
  created_at: string;
}

export interface DailyQuote {
  id: string;
  bank_position: number;
  quote_text: string;
  author: string | null;
  created_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start_date: string;
  habits_served_well: string | null;
  challenges_helped_grow: string | null;
  lessons_learned: string | null;
  challenges_overcome: string | null;
  feels_better_from_habits: string | null;
  one_thing_to_improve: string | null;
  habits_to_double_down: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SelfAssessment {
  mindset: number;
  energy: number;
  discipline: number;
  relationships: number;
  confidence: number;
  overall: number;
}

export interface HabitSummary {
  morning_completed: number;
  morning_eligible: number;
  night_completed: number;
  night_eligible: number;
  themed_completed: number;
  themed_eligible: number;
}

// 90-day-only fields, kept out of the shared column set (see the Phase 1
// migration's comment on `extra`) so the 30-day review doesn't carry sparse
// unused columns.
export interface PeriodicReviewExtra {
  life_changes?: string;
  next_period_vision?: string;
  habit_summary?: HabitSummary;
  comparison_self_assessment?: SelfAssessment; // snapshot of the prior 30-day scores, for the delta view
}

export interface PeriodicReview {
  id: string;
  user_id: string;
  review_type: ReviewType;
  period_start: string;
  period_end: string;
  most_proud_of: string | null;
  most_consistent_habits: string | null;
  challenges_faced: string | null;
  whats_working: string | null;
  needs_to_change: string | null;
  top_wins: string[];
  self_assessment: SelfAssessment | null;
  focus_next_period: string | null;
  commitment_signed_name: string | null;
  commitment_signed_date: string | null;
  extra: PeriodicReviewExtra;
  pdf_generated_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SupportRequestInsert {
  user_id: string;
  company_id: string;
  contact_display_name: string | null;
  urgency: SupportUrgency;
  contact_method: string | null;
}

export interface CompanySupportCounts {
  company_id: string;
  total_count: number;
  updated_at: string;
}

export interface CompanyDailyParticipation {
  id: string;
  company_id: string;
  entry_date: string;
  weekday: Weekday | null;
  segment: "morning" | "night" | "themed_checkin";
  completed_count: number;
  eligible_count: number;
  created_at: string;
}

export interface CompanyReviewCompletions {
  id: string;
  company_id: string;
  review_type: ReviewType;
  period_start: string;
  completed_count: number;
  eligible_count: number;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  company_id: string;
  scope: CommunityScope;
  board: CommunityBoard;
  body: string;
  image_url: string | null;
  // Set when this post is a member's conscious share of a badge they earned
  // (private.earned_badges); NULL for an ordinary post. See the share action.
  shared_badge_key: string | null;
  is_removed: boolean;
  removed_by: string | null;
  removed_at: string | null;
  removal_reason: string | null;
  created_at: string;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  scope: CommunityScope;
  company_id: string;
  body: string;
  // Self-FK: null = top-level comment; set = a reply to that comment. Threads
  // are kept two levels deep by the submitting server action (a reply-to-a-reply
  // is re-pointed onto the top-level ancestor). See the threading migration.
  parent_comment_id: string | null;
  is_removed: boolean;
  removed_by: string | null;
  removed_at: string | null;
  created_at: string;
}

export interface CommunityLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommunityReport {
  id: string;
  post_id: string;
  reporter_user_id: string;
  reason: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}
