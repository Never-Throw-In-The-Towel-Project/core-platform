import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listCompanyEvents } from "@/lib/events/queries";
import { createCompanyEvent } from "@/lib/actions/events";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { EventAdminList } from "@/components/events/EventAdminList";
import type { EventRow } from "@/types/database";

const SECTION_HEADING =
  "border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]";

/**
 * Workspace › Events -- an HR admin lists meet-ups for their OWN company's staff
 * (walks, socials, wellbeing sessions). Company events are visible only to that
 * company's members and are never public. RLS scopes everything to the admin's
 * own company; createCompanyEvent stamps company_id from their profile.
 */
export default async function WorkspaceEventsPage() {
  const profile = await requireHrAdmin();

  let events: EventRow[] = [];
  try {
    const supabase = await createClient();
    events = await listCompanyEvents(supabase, profile.company_id);
  } catch {
    events = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="border-b-2 border-foreground pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Events</h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Meet-ups for your team — walks, socials, wellbeing sessions. Only your staff see them; they’re never
          public. Drafts stay hidden until you publish.
        </p>
      </div>

      <section className="mt-8">
        <h2 className={SECTION_HEADING}>Create an event</h2>
        <div className="mt-5">
          <EventStudioForm createAction={createCompanyEvent} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className={`${SECTION_HEADING} flex items-baseline gap-2`}>
          Your events <span className="text-brand-accent-deep">{events.length}</span>
        </h2>
        <div className="mt-4">
          <EventAdminList events={events} basePath="/workspace/events" nowMs={new Date().getTime()} />
        </div>
      </section>
    </main>
  );
}
