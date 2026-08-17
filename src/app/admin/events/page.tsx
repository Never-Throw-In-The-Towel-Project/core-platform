import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllEventsForAdmin } from "@/lib/events/queries";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { EventAdminList } from "@/components/events/EventAdminList";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { EventRow } from "@/types/database";

const SECTION_HEADING =
  "border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]";

/**
 * The Events index: create a meet-up (with a live preview), then open one to
 * manage bookings. ntitt_admin only, like the rest of the Admin Centre. Draft
 * events stay invisible to members and the public until published.
 */
export default async function AdminEventsPage() {
  await requireNtittAdmin();

  let events: EventRow[] = [];
  try {
    const supabase = await createClient();
    events = await listAllEventsForAdmin(supabase);
  } catch {
    events = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <AdminPageHeader
        title="Events"
        description="List real-world meet-ups — cold-plunge dips, walks, socials — then manage who’s booked. Drafts stay hidden until you publish."
      />

      <section className="mt-8">
        <h2 className={SECTION_HEADING}>Create an event</h2>
        <div className="mt-5">
          <EventStudioForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className={`${SECTION_HEADING} flex items-baseline gap-2`}>
          Manage events <span className="text-brand-accent-deep">{events.length}</span>
        </h2>
        <div className="mt-4">
          <EventAdminList events={events} basePath="/admin/events" nowMs={new Date().getTime()} />
        </div>
      </section>
    </main>
  );
}
