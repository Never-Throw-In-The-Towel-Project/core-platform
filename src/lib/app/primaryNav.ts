/**
 * The member app's primary navigation tabs, as data. Shared by the desktop
 * HeaderNav and the mobile BottomNav so the set, order and active-state rules
 * live in one place (kept out of the "use client" components so `match` is a
 * pure, unit-testable function -- see primaryNav.test.ts).
 *
 * Feed and Wins both live under /community, so their matchers are written to be
 * mutually exclusive: Wins owns /community/wins*, and Feed owns the rest of
 * /community (the feed itself and "My Company"), never lighting up on a wins
 * path. Everything else is a plain "href or a sub-path of it" match.
 */
export type PrimaryNavTab = {
  href: string;
  label: string;
  /** Whether this tab is the active one for a given pathname. */
  match: (pathname: string) => boolean;
};

const under = (base: string) => (p: string) => p === base || p.startsWith(`${base}/`);

export const PRIMARY_NAV_TABS: readonly PrimaryNavTab[] = [
  { href: "/home", label: "Today", match: under("/home") },
  {
    href: "/community",
    label: "Feed",
    // /community and its sub-paths EXCEPT the wins board (which has its own tab).
    match: (p) => (p === "/community" || p.startsWith("/community/")) && !p.startsWith("/community/wins"),
  },
  { href: "/community/wins", label: "Wins", match: (p) => p.startsWith("/community/wins") },
  { href: "/events", label: "Events", match: under("/events") },
  { href: "/content", label: "Training", match: under("/content") },
];
