/**
 * Deterministic config-readiness summary for the `/api/health` detail probe.
 *
 * Pure (takes an env map, returns a plain object) so it is unit-testable and so
 * the route handler stays thin. It answers the question the launch-readiness
 * audit kept raising: several env vars **silently no-op when unset** and disable
 * a safety-critical feature (email, push, the support-escalation net) with no
 * signal. This reports which groups are configured -- as booleans + the names of
 * any missing vars, NEVER the values -- so an operator can verify a prod
 * deployment before a real client relies on it.
 *
 * Grouped by feature, each flagged `critical` (a launch-blocking capability) or
 * not (degrades but doesn't break launch). `criticalOk` is the single roll-up an
 * operator or an uptime check can gate on.
 */
export type ConfigGroup = {
  key: string;
  label: string;
  critical: boolean;
  configured: boolean;
  /** Names (never values) of the group's vars that are unset/blank. */
  missing: string[];
};

export type ConfigSummary = {
  groups: ConfigGroup[];
  /** True when every `critical` group is fully configured. */
  criticalOk: boolean;
};

/**
 * Feature groups and the env vars each needs. Kept in sync with `.env.example`
 * and `docs/LAUNCH_READINESS.md` "Required prod env vars". Note: the Supabase
 * Auth SMTP secret (`SUPABASE_AUTH_SMTP_PASS`) is deliberately absent -- it's set
 * on the Supabase project, not this app's env, so the app can't observe it.
 *
 * The `authEmailHook` group checks only the app-side secret. The hook must ALSO
 * be *enabled* on the Supabase project (Auth -> Hooks -> Send Email) for branded
 * auth mail to fire -- that toggle lives on the project, not in this env, so it
 * can't be observed here (see docs/POST_MERGE_PROD_CHECKLIST.md).
 */
const GROUP_DEFS: { key: string; label: string; critical: boolean; vars: string[] }[] = [
  {
    key: "supabase",
    label: "Supabase (database + service role)",
    critical: true,
    vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  { key: "site", label: "Site URL", critical: true, vars: ["NEXT_PUBLIC_SITE_URL"] },
  { key: "cron", label: "Cron authentication", critical: true, vars: ["CRON_SECRET"] },
  { key: "email", label: "Email (Brevo)", critical: true, vars: ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"] },
  {
    key: "authEmailHook",
    label: "Auth email hook secret (branded auth mail)",
    critical: true,
    vars: ["SUPABASE_AUTH_HOOK_SECRET"],
  },
  {
    key: "push",
    label: "Web push (VAPID)",
    critical: true,
    vars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
  },
  {
    key: "supportEscalation",
    label: "Support escalation safety net",
    critical: true,
    vars: ["SUPPORT_ACK_TOKEN_SECRET", "NTITT_FALLBACK_CONTACT_EMAIL"],
  },
  {
    key: "sms",
    label: "Support SMS (Twilio)",
    critical: false,
    vars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  },
  { key: "ai", label: "AI Studio assist", critical: false, vars: ["ANTHROPIC_API_KEY"] },
];

const isSet = (value: string | undefined) => typeof value === "string" && value.trim().length > 0;

export function summarizeConfig(env: Record<string, string | undefined>): ConfigSummary {
  const groups: ConfigGroup[] = GROUP_DEFS.map((group) => {
    const missing = group.vars.filter((name) => !isSet(env[name]));
    return {
      key: group.key,
      label: group.label,
      critical: group.critical,
      configured: missing.length === 0,
      missing,
    };
  });
  const criticalOk = groups.every((group) => !group.critical || group.configured);
  return { groups, criticalOk };
}
