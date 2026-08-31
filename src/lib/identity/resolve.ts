// Pure (no DB, no "server-only") so it's unit-testable. Turns a member's stored
// identity (real name + public handle + their preference) into the name a given
// audience sees. The whole point: PEERS see what the member chose (full name,
// first name, or their anonymous handle, with an optional per-post override),
// while ADMINS always see the real name. Callers in lib/community/queries.ts pick
// the right function for the surface; full_name never reaches a peer client
// except already reduced to the label below.

import type { CommunityIdentityPreference } from "@/types/database";

export interface CommunityIdentity {
  /** The member's real name (admin-visible). Null only for legacy rows not yet
   *  backfilled; we fall back to the handle so a name always renders. */
  fullName: string | null;
  /** The public handle -- what peers see when the member is anonymous. */
  displayName: string;
  /** The member's account-level default. */
  preference: CommunityIdentityPreference;
}

/** First whitespace-delimited token, or the whole (trimmed) name if there's no
 *  space. Never returns empty for a non-empty input. */
export function firstNameOf(name: string): string {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

/**
 * The name OTHER members see for this author. Honours a per-post `override`
 * when given, otherwise the account default. Admins never use this -- they see
 * the real name (see `realName`).
 *
 *   full_name       -> the real name
 *   first_name_only -> just the first name
 *   anonymous       -> the public handle (a non-identifying nickname for new
 *                      members; legacy members set a distinct handle in settings)
 */
export function peerCommunityName(
  identity: CommunityIdentity,
  override?: CommunityIdentityPreference | null
): string {
  const preference = override ?? identity.preference;
  const real = identity.fullName?.trim() || identity.displayName;
  switch (preference) {
    case "anonymous":
      return identity.displayName;
    case "first_name_only":
      return firstNameOf(real);
    case "full_name":
    default:
      return real;
  }
}

/** The author's real name, for admin surfaces (moderation, roster) -- never
 *  reduced or hidden, whatever the member's community preference. */
export function realName(identity: Pick<CommunityIdentity, "fullName" | "displayName">): string {
  return identity.fullName?.trim() || identity.displayName;
}
