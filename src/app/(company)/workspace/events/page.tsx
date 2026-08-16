import Link from "next/link";
import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listCompanyEvents } from "@/lib/events/queries";
import { createCompanyEvent } from "@/lib/actions/events";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow } from "@/types/database";

function statusBadge(e: EventRow): { label: string; className: string } {
  if (e.cancelled_at) return { label: "Cancelled", className: "border-brand-accent-deep text-brand-accent-deep" };
  if (!e.is_published) return { label: "Draft", className: "border-brand-accent bg-brand-accent text-brand-accent-foreground" };
  return { label: "Live", className: "border-rule-border text-muted" };
}

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
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Events</h1>
      <p className="mt-1 text-sm text-muted">
        Meet-ups for your team — walks, socials, wellbeing sessions. Only your staff see them; they’re never public.
        Drafts stay hidden until you publish.
      </p>

      <div className="mt-6">
        <EventStudioForm createAction={createCompanyEvent} />
      </div>

      <div className="mt-10">
        <h2 className="flex items-baseline gap-2 border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          Your events <span className="text-brand-accent-deep">{events.length}</span>
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet — create your first above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
            {events.map((e) => {
              const badge = statusBadge(e);
              const cap = e.capacity != null ? `/${e.capacity}` : "";
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <Link href={`/workspace/events/${e.id}`} className="group min-w-0 flex-1">
                    <span className="block truncate font-extrabold leading-tight tracking-tight group-hover:text-brand-accent-deep">
                      {e.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {formatEventWhen(e.starts_at, e.ends_at)} · {e.confirmed_count}
                      {cap} booked
                    </span>
                  </Link>
                  <span
                    className={
                      "shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                      badge.className
                    }
                  >
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
