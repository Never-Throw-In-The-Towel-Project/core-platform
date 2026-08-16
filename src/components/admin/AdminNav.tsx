"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The NTITT Control Tower section nav. One place, so adding an admin surface
// means one entry here -- no more hand-rolled per-page "Admin tools" link lists.
const LINKS = [
  { href: "/admin/content", label: "Content" },
  { href: "/admin/brain", label: "Brain" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/challenges", label: "Challenges" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/podcast", label: "Podcast" },
  { href: "/admin/companies", label: "Companies" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4" aria-label="Admin sections">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              active ? "border-brand-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
