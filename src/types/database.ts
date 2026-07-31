// Hand-written types mirroring supabase/migrations/20260730000000_init_schema.sql.
// Once a live Supabase project exists, regenerate with `supabase gen types
// typescript` and reconcile — this file exists so we get type safety before
// that project exists, not as a permanent hand-maintained source of truth.

export type UserRole = "employee" | "hr_admin" | "ntitt_admin";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type ReviewType = "30_day" | "90_day";
export type SupportUrgency = "check_in" | "talk_today" | "urgent";
export type SupportStatus = "new" | "contacted" | "resolved";
export type VideoCategory = "mental_fitness" | "physical_fitness" | "tools_tips";
export type WorkoutTier = "beginner" | "intermediate" | "advanced" | "elite";
export type CommunityScope = "global" | "company";
export type CommunityBoard = "feed" | "wins";

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

export interface Profile {
  id: string;
  company_id: string;
  role: UserRole;
  display_name: string;
  community_opt_in: boolean;
  podcast_guest_opt_in: boolean;
  morning_notification_time: string | null;
  night_notification_time: string | null;
  sunday_notification_time: string | null;
  timezone: string;
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
