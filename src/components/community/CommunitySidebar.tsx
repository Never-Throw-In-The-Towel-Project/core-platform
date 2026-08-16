import Image from "next/image";
import Link from "next/link";
import { PodcastOptIn } from "@/app/(app)/community/podcast-optin";
import type { PodcastGuestAnonymityPreference } from "@/types/database";

const SPACE_LINKS = [
  { key: "feed", href: "/community", label: "Everyone on NTITT" },
  { key: "wins", href: "/community/wins", label: "Wins Board" },
] as const;

/**
 * The left "Spaces" rail from the design reference -- which community space
 * you're in, plus this month's podcast episode and the guest opt-in. Restyled
 * to the Modernist system: wide-tracked eyebrow labels, the active space marked
 * with a left accent bar + deep-red text (not an opacity shift), and flat
 * hairline-bordered cards. Shown on the feed screens (/community,
 * /community/company); the Wins Board is a deliberately full-width,
 * sidebar-free layout in the reference, so it doesn't use this.
 */
export function CommunitySidebar({
  active,
  companyName,
  podcastEpisode,
  podcastOptedIn,
  podcastAnonymityPreference,
}: {
  active: "feed" | "company";
  companyName: string | null;
  podcastEpisode: { title: string; embed_url: string } | null;
  podcastOptedIn: boolean;
  podcastAnonymityPreference: PodcastGuestAnonymityPreference | null;
}) {
  const spaceClass = (isActive: boolean) =>
    isActive
      ? "block border-l-2 border-brand-accent-vivid pl-2.5 font-semibold text-brand-accent-deep"
      : "block border-l-2 border-transparent pl-2.5 text-muted transition-colors hover:text-foreground";

  return (
    <aside className="space-y-6 text-sm">
      {/* The Spaces links duplicate the CommunityTabs bar, which is always
          visible above the feed -- so on mobile (where this rail stacks below
          the feed) they're redundant. Show them only from lg, where the rail is
          a genuine left column. The podcast card + opt-in below stay on all
          sizes. */}
      <div className="hidden lg:block">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Spaces</p>
        <div className="mt-2.5 space-y-1.5">
          {SPACE_LINKS.map((space) => (
            <Link key={space.key} href={space.href} className={spaceClass(active === space.key)}>
              {space.label}
            </Link>
          ))}
          {companyName && (
            <Link href="/community/company" className={spaceClass(active === "company")}>
              {companyName} only
            </Link>
          )}
        </div>
      </div>

      {podcastEpisode && (
        <div className="border border-rule-border">
          <div className="relative h-24 w-full overflow-hidden border-b border-rule-border">
            <Image
              src="/site/podcast-recording.jpg"
              alt=""
              fill
              sizes="200px"
              className="site-photo object-cover"
            />
          </div>
          <div className="p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">This month</p>
            <p className="mt-2 font-semibold leading-snug">{podcastEpisode.title}</p>
            <a
              href={podcastEpisode.embed_url}
              className="mt-2 inline-block text-xs font-bold uppercase tracking-wide text-brand-accent-deep"
            >
              Listen →
            </a>
          </div>
        </div>
      )}

      <div className="border border-rule-border p-3">
        <PodcastOptIn optedIn={podcastOptedIn} anonymityPreference={podcastAnonymityPreference} />
      </div>
    </aside>
  );
}
