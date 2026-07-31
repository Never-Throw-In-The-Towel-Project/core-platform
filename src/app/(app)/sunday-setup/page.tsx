import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { weekdayNameOrWeekend } from "@/lib/routines/dates";
import { SundaySetupForm } from "@/components/routines/SundaySetupForm";

export default async function SundaySetupPage() {
  const profile = await getProfile();
  if (weekdayNameOrWeekend(new Date(), profile.timezone) !== "sunday") {
    redirect("/home");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <SundaySetupForm />
    </main>
  );
}
