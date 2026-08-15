/**
 * The community section's sub-navigation, as data. Kept in a plain module (not
 * the "use client" CommunityTabs component) so the visibility rule is pure and
 * unit-testable without a DOM.
 */
export type CommunityTab = {
  href: string;
  label: string;
  /** Whether this tab is active for a given pathname. */
  match: (pathname: string) => boolean;
};

export const COMMUNITY_TABS: readonly CommunityTab[] = [
  { href: "/community", label: "Feed", match: (p) => p === "/community" },
  { href: "/community/wins", label: "Wins Board", match: (p) => p.startsWith("/community/wins") },
  { href: "/community/company", label: "My Company", match: (p) => p.startsWith("/community/company") },
  { href: "/community/guidelines", label: "Guidelines", match: (p) => p.startsWith("/community/guidelines") },
];

/**
 * The tabs a member should see. The "My Company" space is hidden for Direct
 * (self-signup) members, whose company is the shared NTITT-Direct row -- a
 * "company" feed there would pool unrelated strangers
 * (docs/PLATFORM_STRUCTURE.md decision 6).
 */
export function visibleCommunityTabs(showCompanyTab: boolean): readonly CommunityTab[] {
  return COMMUNITY_TABS.filter((tab) => showCompanyTab || tab.href !== "/community/company");
}
