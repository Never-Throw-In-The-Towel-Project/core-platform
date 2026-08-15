import type { UserRole } from "@/types/database";

/**
 * Which first-run a role gets. HR and NTITT admins are provisioned by invite and
 * arrive to run a company or the Control Tower -- the member flow's routine
 * reminder times and "your employer can't see this" framing don't fit them, and
 * forcing them through it before role landing is the bug this fixes
 * (docs/PLATFORM_STRUCTURE.md, Phase 3). Everyone else gets the member flow.
 */
export type OnboardingVariant = "member" | "staff";

export function onboardingVariant(role: UserRole): OnboardingVariant {
  return role === "hr_admin" || role === "ntitt_admin" ? "staff" : "member";
}
