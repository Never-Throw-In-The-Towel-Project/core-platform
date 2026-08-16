// The Admin Centre section list — one source of truth shared by the sidebar,
// the mobile header and the top-bar breadcrumb. Counts (where a section has a
// countKey) are fetched in the admin layout and passed in by key.

export type AdminCountKey = "content" | "challenges" | "events" | "moderation" | "companies";
export type AdminCounts = Partial<Record<AdminCountKey, number>>;

export const ADMIN_SECTIONS: { href: string; label: string; countKey?: AdminCountKey }[] = [
  { href: "/admin/content", label: "Content Studio", countKey: "content" },
  { href: "/admin/brain", label: "Brain" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/challenges", label: "Challenges", countKey: "challenges" },
  { href: "/admin/events", label: "Events", countKey: "events" },
  { href: "/admin/moderation", label: "Moderation", countKey: "moderation" },
  { href: "/admin/podcast", label: "Podcast Guests" },
  { href: "/admin/companies", label: "Companies", countKey: "companies" },
  { href: "/admin/settings", label: "Settings" },
];

/** The section whose page is currently shown (longest-prefix match). */
export function activeAdminSection(pathname: string) {
  return ADMIN_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
}
