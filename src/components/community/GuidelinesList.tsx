import { COMMUNITY_GUIDELINES } from "@/lib/community/guidelines";

/**
 * The numbered community-guidelines list (deep-red numerals on flat rule cards).
 * Presentational and stateless, so it renders both inside the client accept gate
 * (CommunityGuidelines) and directly in the server-rendered Settings page.
 */
export function GuidelinesList() {
  return (
    <ol className="space-y-3">
      {COMMUNITY_GUIDELINES.map((rule, i) => (
        <li key={rule} className="flex gap-3 border border-rule-border p-4 text-sm">
          <span className="font-extrabold tabular-nums text-brand-accent-deep" aria-hidden="true">
            {i + 1}
          </span>
          <span>{rule}</span>
        </li>
      ))}
    </ol>
  );
}
