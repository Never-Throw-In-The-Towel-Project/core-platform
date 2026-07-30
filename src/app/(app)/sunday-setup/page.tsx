import { redirect } from "next/navigation";
import { weekdayNameOrWeekend } from "@/lib/routines/dates";
import { SundaySetupForm } from "@/components/routines/SundaySetupForm";

export default function SundaySetupPage() {
  if (weekdayNameOrWeekend(new Date()) !== "sunday") {
    redirect("/home");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <SundaySetupForm />
    </main>
  );
}
