import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { StaffOnboarding } from "@/components/onboarding/StaffOnboarding";
import { onboardingVariant } from "@/lib/onboarding/variant";
import { resolveHelplineNumber } from "@/lib/support/helpline";

// Sits outside (app) deliberately -- it's the thing that must run *before*
// (app)/layout.tsx's gate lets someone through, so it can't live behind
// that same gate. No BottomNav, matching the design reference's full-bleed
// onboarding frames -- but the flows still render AskForSupport themselves
// (per the "every screen inside the platform" requirement), since this page
// is reached post-auth.
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/home");
  }

  const helplineNumber = resolveHelplineNumber();

  // HR / NTITT admins get a short, role-appropriate first-run instead of the
  // member routine-setup flow they were previously forced through
  // (docs/PLATFORM_STRUCTURE.md, Phase 3).
  if (onboardingVariant(profile.role) === "staff") {
    let companyName = "your company";
    if (profile.role === "hr_admin") {
      // Best-effort: a transient failure just falls back to a generic label.
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .maybeSingle();
        if (data?.name) companyName = data.name;
      } catch {
        // keep the default label
      }
    }
    return <StaffOnboarding profile={profile} companyName={companyName} helplineNumber={helplineNumber} />;
  }

  return <OnboardingFlow profile={profile} helplineNumber={helplineNumber} />;
}
