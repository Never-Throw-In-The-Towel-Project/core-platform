import { notFound } from "next/navigation";
import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getNoticeForAdmin, type NoticeView } from "@/lib/notices/queries";
import { NoticeStudioForm } from "@/components/admin/NoticeStudioForm";

/**
 * Edit one notice -- the counterpart to the Notice Board Studio's create
 * composer. ntitt_admin only (layout guard + requireNtittAdmin here). Loads the
 * notice (with its resolved image URL) and hands it to the shared
 * NoticeStudioForm, which submits to updateNotice.
 */
export default async function EditNoticePage({ params }: { params: Promise<{ id: string }> }) {
  await requireNtittAdmin();
  const { id } = await params;

  let notice: NoticeView | null = null;
  try {
    const supabase = await createClient();
    notice = await getNoticeForAdmin(supabase, id);
  } catch {
    notice = null;
  }

  if (!notice) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin/notices"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← Notice Board
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Edit notice</h1>
      <p className="mt-1 text-sm text-muted">Change any field and save. Leave the image as is to keep it.</p>

      <div className="mt-8">
        <NoticeStudioForm notice={notice} />
      </div>
    </main>
  );
}
