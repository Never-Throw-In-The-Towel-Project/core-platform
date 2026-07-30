import { getProfile } from "@/lib/auth/dal";

// Placeholder proving the (app) auth boundary and privacy-scoped data
// access work end to end. The real Morning/Night Routine and themed
// weekday check-ins are Phase 2 -- see docs/ARCHITECTURE.md roadmap.
export default async function HomePage() {
  const profile = await getProfile();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Win the morning, win the day.</h1>
      <p className="mt-2 text-brand-foreground/80">
        Hi {profile.display_name}. The daily habit loop (Morning Routine, themed
        weekday check-ins, Night Routine, reviews) builds here in Phase 2.
      </p>
    </main>
  );
}
