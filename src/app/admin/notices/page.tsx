import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllNoticesForAdmin, type NoticeView } from "@/lib/notices/queries";
import { NoticeStudioForm } from "@/components/admin/NoticeStudioForm";
import { NoticeAdminList } from "@/components/admin/NoticeAdminList";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const SECTION_HEADING =
  "border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]";

/**
 * The Notice Board Studio: write a promo card (video, image quote, or a quick
 * message), schedule it by weekday and/or a date window, then publish it to
 * every member's Today page. ntitt_admin only, like the rest of the Admin Centre.
 * Drafts stay hidden until published.
 */
export default async function AdminNoticesPage() {
  await requireNtittAdmin();

  let notices: NoticeView[] = [];
  try {
    const supabase = await createClient();
    notices = await listAllNoticesForAdmin(supabase);
  } catch {
    notices = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <AdminPageHeader
        title="Notice Board"
        description="Promote a video, an image quote, or a quick message on every member’s Today page. Schedule it for a weekday, a date range, or leave it running. Drafts stay hidden until you publish."
      />

      <section className="mt-8">
        <h2 className={SECTION_HEADING}>Create a notice</h2>
        <div className="mt-5">
          <NoticeStudioForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className={`${SECTION_HEADING} flex items-baseline gap-2`}>
          Manage notices <span className="text-brand-accent-deep">{notices.length}</span>
        </h2>
        <NoticeAdminList notices={notices} />
      </section>
    </main>
  );
}
