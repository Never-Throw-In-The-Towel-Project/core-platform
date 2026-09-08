/**
 * The community guidelines -- single source of truth. Shown as the first-visit
 * accept gate on the feed / wins board (via CommunityGuidelines) and read-only
 * in Settings (via GuidelinesList). Keeping the copy here means both surfaces
 * never drift.
 */
export const COMMUNITY_GUIDELINES = [
  "Be kind. This is a space for encouragement, wins, and honest reflection -- not judgement.",
  "You don't have to use your real name, but stand behind what you post.",
  "No harassment, hate speech, or targeting anyone by name.",
  "This isn't a substitute for support -- if you need someone to check in with you, use the Ask for Support button.",
  "Report anything that doesn't belong here. The NTITT team reviews every report.",
] as const;
