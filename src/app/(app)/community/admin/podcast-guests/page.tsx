import { requireNtittAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PodcastGuestAnonymityPreference } from "@/types/database";

const ANONYMITY_LABEL: Record<PodcastGuestAnonymityPreference, string> = {
  full_name: "Full name",
  first_name_only: "First name only",
  anonymous: "Anonymous",
};

/**
 * "Podcast guest opt-in... feeds into a private list for Anthony to
 * review, not a public sign-up" (brief). profiles has no ntitt_admin read
 * policy (Phase 1's self-read-only design is deliberate), so this uses the
 * service-role admin client -- the same justified exception as the Phase 6
 * HR admin email lookup, gated by requireNtittAdmin() so only NTITT staff
 * ever reach this page.
 */
export default async function PodcastGuestsPage() {
  await requireNtittAdmin();

  const supabase = createAdminClient();

  const { data: guests } = await supabase
    .from("profiles")
    .select("id, display_name, company_id, podcast_guest_anonymity_preference, podcast_guest_consented_at")
    .eq("podcast_guest_opt_in", true);

  const companyIds = Array.from(new Set((guests ?? []).map((g) => g.company_id as string)));
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const guestsWithEmail = await Promise.all(
    (guests ?? []).map(async (guest) => {
      const { data } = await supabase.auth.admin.getUserById(guest.id as string);
      return {
        id: guest.id as string,
        displayName: guest.display_name as string,
        company: companyName.get(guest.company_id as string) ?? "Unknown",
        email: data?.user?.email ?? null,
        anonymityPreference:
          guest.podcast_guest_anonymity_preference as PodcastGuestAnonymityPreference | null,
        consentedAt: guest.podcast_guest_consented_at as string | null,
      };
    })
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Podcast Guest Interest</h1>
      <p className="mt-1 text-sm opacity-70">
        Private list -- never shown publicly. Reach out directly to follow up. Each person&apos;s credit
        choice is what they agreed to when they opted in -- honour it when producing and publishing.
      </p>

      {guestsWithEmail.length === 0 ? (
        <p className="mt-6 text-sm opacity-60">No one has opted in yet.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {guestsWithEmail.map((guest) => (
            <div key={guest.id} className="rounded-lg border border-black/10 p-4 text-sm">
              <p className="font-semibold">{guest.displayName}</p>
              <p className="opacity-70">
                {guest.company} · {guest.email ?? "no email on file"}
              </p>
              <p className="mt-1 text-xs opacity-60">
                Credit as:{" "}
                {guest.anonymityPreference ? ANONYMITY_LABEL[guest.anonymityPreference] : "not recorded"}
                {guest.consentedAt &&
                  ` · consented ${new Date(guest.consentedAt).toLocaleDateString("en-GB")}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
