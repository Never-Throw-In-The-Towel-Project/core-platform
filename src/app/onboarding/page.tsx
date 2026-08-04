import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { resolveHelplineNumber } from "@/lib/support/helpline";

// Sits outside (app) deliberately -- it's the thing that must run *before*
// (app)/layout.tsx's gate lets someone through, so it can't live behind
// that same gate. No BottomNav, matching the design reference's full-bleed
// onboarding frames -- but OnboardingFlow still renders AskForSupport
// itself (per its own non-negotiable "every screen inside the platform"
// requirement), since this page is reached post-auth.
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/home");
  }

  return <OnboardingFlow profile={profile} helplineNumber={resolveHelplineNumber()} />;
}
