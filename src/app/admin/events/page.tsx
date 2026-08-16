import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllEventsForAdmin } from "@/lib/events/queries";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow } from "@/types/database";

function statusBadge(e: EventRow): { label: string; className: string } {
  if (e.cancelled_at) {
    return { label: "Cancelled", className: "border-brand-accent-deep text-brand-accent-deep" };
  }
  if (!e.is_published) {
    return { label: "Draft", className: "border-brand-accent bg-brand-accent text-brand-accent-foreground" };
  }
  return { label: "Live", className: "border-rule-border text-muted" };
}

/**
 * The Events index: create a meet-up, then open it to manage bookings. ntitt_admin
 * only, like the rest of the Admin Centre. Draft events stay invisible to members
 * and the public until published.
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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AdminPageHeader
        title="Events"
        description="List real-world meet-ups — cold-plunge dips, walks, socials — then manage who’s booked. Drafts stay hidden until you publish."
      />

      <div className="mt-8">
        <EventStudioForm />
      </div>

      <div className="mt-10">
        <h2 className="flex items-baseline gap-2 border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          All events <span className="text-brand-accent-deep">{events.length}</span>
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
                  <Link href={`/admin/events/${e.id}`} className="group min-w-0 flex-1">
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
