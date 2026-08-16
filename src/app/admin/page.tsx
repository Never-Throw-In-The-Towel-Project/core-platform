import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";

const SECTIONS = [
  { href: "/admin/content", title: "Content Studio", desc: "Author, tag, target and publish content." },
  { href: "/admin/brain", title: "Brain", desc: "The AI knowledge base — upload, foldered and tagged." },
  { href: "/admin/calendar", title: "Calendar", desc: "Plan content across the Mon–Sun motivation framework." },
  { href: "/admin/challenges", title: "Challenges", desc: "Build guided multi-day challenge programmes." },
  { href: "/admin/events", title: "Events", desc: "List real-world meet-ups and manage bookings." },
  { href: "/admin/moderation", title: "Moderation", desc: "Review reported community posts." },
  { href: "/admin/podcast", title: "Podcast guests", desc: "See who's opted in to appear as a guest." },
  { href: "/admin/companies", title: "Companies", desc: "Create and manage partner company portals." },
];

/**
 * Control Tower home -- the landing for admin.neverthrowinthetowel.uk. Guard is also on the
 * layout; kept here as defence in depth (matches the codebase pattern).
 */
export default async function AdminHomePage() {
  await requireNtittAdmin();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">NTITT Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Control Tower</h1>
      <p className="mt-1 text-sm text-muted">Everything NTITT curates and manages, in one place.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border border-rule-border p-5 transition-colors hover:border-brand-accent hover:bg-foreground/[0.03]"
          >
            <p className="font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
