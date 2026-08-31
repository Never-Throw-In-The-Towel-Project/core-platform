// Pure (no DB, no "server-only") so it's unit-testable. The account-level
// community identity choice a member makes at signup, plus the non-identifying
// default handle used when they appear anonymously. The peer-facing RESOLVER
// (turning a member + their preference into the label other members see) lands
// with the community render work; this module is just the shared vocabulary and
// the anonymous-handle default so signup and settings agree.

import type { CommunityIdentityPreference } from "@/types/database";

export const IDENTITY_PREFERENCES: {
  value: CommunityIdentityPreference;
  label: string;
  hint: string;
}[] = [
  { value: "full_name", label: "My full name", hint: "Other members see your full name." },
  { value: "first_name_only", label: "First name only", hint: "Other members see just your first name." },
  { value: "anonymous", label: "Anonymously", hint: "Other members see a nickname — never your real name. Admins always can." },
];

export function isIdentityPreference(value: unknown): value is CommunityIdentityPreference {
  return value === "full_name" || value === "first_name_only" || value === "anonymous";
}

// Two short word lists -> a few hundred friendly, non-identifying handles. The
// handle is DETERMINISTIC in the seed (the user id) so a member's anonymous
// posts stay recognisably "the same person" across the feed without revealing
// who they are -- and stable across renders. Members can change it in settings.
const ADJECTIVES = [
  "Quiet", "Bright", "Steady", "Calm", "Bold", "Kind",
  "Swift", "Wise", "Warm", "Brave", "Gentle", "Keen",
];
const ANIMALS = [
  "Otter", "Heron", "Fox", "Wren", "Hare", "Finch",
  "Lynx", "Robin", "Marten", "Owl", "Stag", "Kestrel",
];

/** A stable, non-identifying "Adjective Animal" handle derived from `seed`
 *  (the user id). Never throws; falls back to a fixed handle for an empty seed. */
export function generateAnonHandle(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
  return `${adjective} ${animal}`;
}
