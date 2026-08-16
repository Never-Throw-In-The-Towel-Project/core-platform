"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The {Company} Workspace section nav. Styled for the dark shell the (company)
// group inherits (same token approach as the member AppHeader).
const LINKS = [
  { href: "/workspace", label: "Overview", exact: true },
  { href: "/workspace/people", label: "People" },
  { href: "/workspace/challenges", label: "Challenges" },
  { href: "/workspace/events", label: "Events" },
  { href: "/workspace/reports", label: "Reports" },
];

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4" aria-label="Workspace sections">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? "border-brand-accent text-brand-foreground"
                : "border-transparent text-brand-foreground/60 hover:text-brand-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
