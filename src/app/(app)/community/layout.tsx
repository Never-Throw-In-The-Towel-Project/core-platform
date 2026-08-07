import Link from "next/link";

const TABS = [
  { href: "/community", label: "Feed" },
  { href: "/community/wins", label: "Wins Board" },
  { href: "/community/company", label: "My Company" },
  { href: "/community/guidelines", label: "Guidelines" },
];

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 overflow-x-auto border-b border-black/10 px-6 py-3 text-sm">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="shrink-0 whitespace-nowrap opacity-70 hover:opacity-100">
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
