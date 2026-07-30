// Hand-written types mirroring supabase/migrations/20260730000000_init_schema.sql.
// Once a live Supabase project exists, regenerate with `supabase gen types
// typescript` and reconcile — this file exists so we get type safety before
// that project exists, not as a permanent hand-maintained source of truth.

export type UserRole = "employee" | "hr_admin";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type ReviewType = "30_day" | "90_day";
export type SupportUrgency = "check_in" | "talk_today" | "urgent";
export type SupportStatus = "new" | "contacted" | "resolved";
export type VideoCategory = "mental_fitness" | "physical_fitness" | "tools_tips";
export type WorkoutTier = "beginner" | "intermediate" | "advanced" | "elite";

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
