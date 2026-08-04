import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

// Sits outside (app) deliberately -- it's the thing that must run *before*
// (app)/layout.tsx's gate lets someone through, so it can't live behind
// that same gate. No BottomNav/AskForSupport chrome, matching the design
// reference's full-bleed onboarding frames.
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/home");
  }

  return <OnboardingFlow profile={profile} />;
}
