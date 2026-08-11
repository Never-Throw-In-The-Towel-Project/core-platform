import Link from "next/link";
import type { RecentWin } from "@/lib/gamification/todayStats";

/**
 * The wins board widget: recent public wins other members chose to share. These
 * are community posts (board = "wins"), never anything from a private journal,
 * so surfacing name + text here is exactly what the poster intended. Links
 * through to the full Wins Board in Community.
 */
export function WinsBoard({ wins }: { wins: RecentWin[] }) {
  if (wins.length === 0) {
    return (
      <p className="text-sm text-muted">
        Wins people share will show up here.{" "}
        <Link href="/community/wins" className="font-semibold text-brand-accent-deep underline">
          Add yours →
        </Link>
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {wins.map((win) => (
        <li key={win.id} className="border-t border-rule-hairline py-2.5 text-sm first:border-t-0 first:pt-0">
          <span className="font-extrabold">{win.authorDisplayName}</span>{" "}
          <span className="text-foreground/80">— {win.body}</span>
        </li>
      ))}
    </ul>
  );
}
