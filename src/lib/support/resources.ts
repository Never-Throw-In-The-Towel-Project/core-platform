// The external-support signposting list shown by the "Check in with me" hub
// (src/components/AskForSupport.tsx) and the pre-auth support panel
// (src/components/PreAuthSupport.tsx). A plain module (NOT server-only): the
// client hub imports it directly.
//
// Two tiers, by how urgent the need is:
//   - URGENT_RESOURCES  — "I need help right now": crisis lines, one-tap call/text.
//   - ONGOING_RESOURCES — "I need support, but not urgently": NTITT's own events +
//     community, then lower-intensity men's mental-health charities.
//
// SAFETY / SIGN-OFF: every number, hours and link below was checked against the
// organisation's own website (Sept 2026) before being committed here. It is
// deliberately a small, curated CODE list (not admin-editable) so a change is a
// reviewed diff, never an accidental edit to a crisis number. Treat this file as
// safety-critical: do not add or change an entry without re-verifying it at
// source, and the live list is signed off by NTITT (Anthony) before release.

/** A single way to reach a resource. `call`/`text` become tel:/sms: (one-tap on
 *  mobile); `link` is an external site (new tab); `internal` is an in-app route. */
export type SupportAction =
  | { type: "call"; label: string; tel: string }
  | { type: "text"; label: string; sms: string }
  | { type: "link"; label: string; href: string }
  | { type: "internal"; label: string; href: string };

export type SupportResource = {
  /** Stable key (for React lists + tests); not shown to the user. */
  id: string;
  name: string;
  /** One line: what they do / who they're for. */
  blurb: string;
  /** Cost + when, e.g. "Free · 24/7". Optional. */
  availability?: string;
  /** Primary action first; at most a couple. */
  actions: SupportAction[];
};

// ── Tier 1: urgent / right now ──────────────────────────────────────────────
export const URGENT_RESOURCES: readonly SupportResource[] = [
  {
    id: "emergency",
    name: "Emergency — 999",
    blurb: "If your life or someone else's is at immediate risk.",
    actions: [{ type: "call", label: "Call 999", tel: "999" }],
  },
  {
    id: "nhs-111",
    name: "NHS 111 — mental health",
    blurb: "Call 111 and select the mental health option to reach a trained NHS professional.",
    availability: "24/7 · all ages (England)",
    actions: [{ type: "call", label: "Call 111", tel: "111" }],
  },
  {
    id: "samaritans",
    name: "Samaritans",
    blurb: "Someone to talk to, whatever you're going through. You don't have to be suicidal to call.",
    availability: "Free · 24/7",
    actions: [{ type: "call", label: "Call 116 123", tel: "116123" }],
  },
  {
    id: "shout",
    name: "Shout",
    blurb: "Free, confidential crisis support by text — if talking on the phone feels like too much.",
    availability: "Free · 24/7",
    actions: [{ type: "text", label: "Text SHOUT to 85258", sms: "85258" }],
  },
];

// ── Tier 2: ongoing / not urgent ────────────────────────────────────────────
export const ONGOING_RESOURCES: readonly SupportResource[] = [
  {
    id: "ntitt-events",
    name: "Come to an event",
    blurb: "Meet people who get it — in person and online, run by Never Throw In The Towel.",
    actions: [{ type: "internal", label: "See what's on", href: "/events" }],
  },
  {
    id: "ntitt-community",
    name: "Talk to the community",
    blurb: "Share a win, or just say where you're at, with others walking the same road.",
    actions: [{ type: "internal", label: "Open the community", href: "/community" }],
  },
  {
    id: "andys-man-club",
    name: "Andy's Man Club",
    blurb: "Free peer talking groups for men (18+) — no booking, just turn up. Every Monday, 7pm.",
    availability: "Free · in person & online",
    actions: [{ type: "link", label: "Find a group", href: "https://andysmanclub.co.uk/groups/" }],
  },
  {
    id: "calm",
    name: "CALM",
    blurb: "Campaign Against Living Miserably — helpline and webchat for anyone who's struggling.",
    availability: "5pm–midnight, every day",
    actions: [
      { type: "call", label: "Call 0800 58 58 58", tel: "0800585858" },
      { type: "link", label: "Webchat", href: "https://www.thecalmzone.net/" },
    ],
  },
  {
    id: "mind",
    name: "Mind",
    blurb: "Information and signposting to mental-health support and services near you.",
    availability: "Infoline Mon–Fri, 9am–6pm",
    actions: [
      { type: "call", label: "Call 0300 123 3393", tel: "03001233393" },
      { type: "link", label: "mind.org.uk", href: "https://www.mind.org.uk/information-support/helplines/" },
    ],
  },
];

/** The href for an action: tel:/sms: for phone/text, the URL as-is otherwise. */
export function supportActionHref(action: SupportAction): string {
  switch (action.type) {
    case "call":
      return `tel:${action.tel}`;
    case "text":
      return `sms:${action.sms}`;
    case "link":
    case "internal":
      return action.href;
  }
}
