// The Admin Centre section list — one source of truth shared by the sidebar,
// the mobile header and the top-bar breadcrumb. Counts (where a section has a
// countKey) are fetched in the admin layout and passed in by key.

export type AdminCountKey = "content" | "notices" | "challenges" | "events" | "moderation" | "companies";
export type AdminCounts = Partial<Record<AdminCountKey, number>>;

export const ADMIN_SECTIONS: { href: string; label: string; countKey?: AdminCountKey }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/content", label: "Content Studio", countKey: "content" },
  { href: "/admin/brain", label: "Brain" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/notices", label: "Notice Board", countKey: "notices" },
  { href: "/admin/challenges", label: "Challenges", countKey: "challenges" },
  { href: "/admin/events", label: "Events", countKey: "events" },
  { href: "/admin/moderation", label: "Moderation", countKey: "moderation" },
  { href: "/admin/podcast", label: "Podcast Guests" },
  { href: "/admin/companies", label: "Companies", countKey: "companies" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Is `href` the active section for `pathname`? A section is active on its own
 * page or any sub-route — EXCEPT the Overview home ("/admin"), which matches its
 * exact path only. Without that exception "/admin" is a prefix of every other
 * section's route and would light up (and win the breadcrumb) everywhere.
 */
export function isAdminSectionActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The section whose page is currently shown. */
export function activeAdminSection(pathname: string) {
  return ADMIN_SECTIONS.find((s) => isAdminSectionActive(pathname, s.href));
}
