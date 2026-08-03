import Link from "next/link";
import { PodcastOptIn } from "@/app/(app)/community/podcast-optin";

const SPACE_LINKS = [
  { key: "feed", href: "/community", label: "Everyone on NTITT" },
  { key: "wins", href: "/community/wins", label: "Wins Board" },
] as const;

/**
 * The left "Spaces" rail from the design reference -- which community space
 * you're in, plus this month's podcast episode and the guest opt-in. Shown
 * on the feed screens (/community, /community/company); the Wins Board is a
 * deliberately full-width, sidebar-free layout in the reference, so it
 * doesn't use this.
 */
export function CommunitySidebar({
  active,
  companyName,
  podcastEpisode,
  podcastOptedIn,
}: {
  active: "feed" | "company";
  companyName: string | null;
  podcastEpisode: { title: string; embed_url: string } | null;
  podcastOptedIn: boolean;
}) {
  return (
    <aside className="space-y-6 text-sm">
      <div>
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Spaces</p>
        <div className="mt-2 space-y-1">
          {SPACE_LINKS.map((space) => (
            <Link
              key={space.key}
              href={space.href}
              className={active === space.key ? "block font-semibold text-brand-accent" : "block opacity-70 hover:opacity-100"}
            >
              {space.label}
            </Link>
          ))}
          {companyName && (
            <Link
              href="/community/company"
              className={active === "company" ? "block font-semibold text-brand-accent" : "block opacity-70 hover:opacity-100"}
            >
              {companyName} only
            </Link>
          )}
        </div>
      </div>

      {podcastEpisode && (
        <div className="border border-current/10 p-3">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-60">This month</p>
          <p className="mt-2 font-medium">{podcastEpisode.title}</p>
          <a href={podcastEpisode.embed_url} className="mt-2 inline-block text-brand-accent underline">
            Listen →
          </a>
        </div>
      )}

      <div className="border border-current/10 p-3">
        <PodcastOptIn optedIn={podcastOptedIn} />
      </div>
    </aside>
  );
}
