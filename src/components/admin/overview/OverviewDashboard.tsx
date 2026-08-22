import Link from "next/link";
import type { AdminOverviewData } from "@/lib/admin/overviewSummary";
import { CONTENT_TYPE_LABEL, CoverageStrip, ProportionBar, SectionHeading, StatTile } from "./primitives";

/**
 * The Super Admin Overview board — the Admin Centre home. Reads as a live,
 * scannable read on the platform: what's live, what's queued, how the community
 * is moving, and quick links into each management surface. Purely presentational
 * (takes a resolved `AdminOverviewData`); the page fetches and the render check
 * feeds it mock data. Aggregate/operational numbers only — no member's private
 * data ever reaches this component.
 */

// The management surfaces, with a one-line description — the old Control Tower
// launcher, folded into the dashboard so entering the Admin Centre still gives
// one-click access to everything.
const MANAGE_LINKS: { href: string; title: string; desc: string }[] = [
  { href: "/admin/content", title: "Content Studio", desc: "Author, tag, target and publish content." },
  { href: "/admin/brain", title: "Brain", desc: "The AI knowledge base — uploaded, foldered and tagged." },
  { href: "/admin/calendar", title: "Calendar", desc: "Plan content across the Mon–Sun framework." },
  { href: "/admin/notices", title: "Notice Board", desc: "Timely announcements on the Today board." },
  { href: "/admin/challenges", title: "Challenges", desc: "Build guided multi-day programmes." },
  { href: "/admin/events", title: "Events", desc: "List real-world meet-ups and manage bookings." },
  { href: "/admin/moderation", title: "Moderation", desc: "Review reported community posts." },
  { href: "/admin/podcast", title: "Podcast Guests", desc: "See who's opted in to appear as a guest." },
  { href: "/admin/companies", title: "Companies", desc: "Create and manage partner company portals." },
  { href: "/admin/settings", title: "Settings", desc: "Super-admin invites and platform settings." },
];

export function OverviewDashboard({ data }: { data: AdminOverviewData }) {
  const { content, community, events, programming } = data;
  const typeMax = Math.max(1, ...content.byType.map((t) => t.count));

  return (
    <div className="space-y-12">
      {/* ---- Platform at a glance ---- */}
      <section>
        <SectionHeading>Platform at a glance</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={data.companies} label="Companies" href="/admin/companies" />
          <StatTile value={content.published} label="Published content" href="/admin/content" />
          <StatTile
            value={content.drafts}
            label="Drafts"
            accent={content.drafts > 0}
            hint={content.scheduledAhead > 0 ? `${content.scheduledAhead} scheduled ahead` : undefined}
            href="/admin/brain"
          />
          <StatTile value={community.postsLast7d} label="Posts · last 7 days" href="/admin/moderation" />
          <StatTile
            value={community.openReports}
            label="Open reports"
            accent={community.openReports > 0}
            href="/admin/moderation"
          />
          <StatTile value={events.upcoming} label="Upcoming events" href="/admin/events" />
        </div>
        <p className="mt-3 text-xs text-muted">
          Live counts, refreshed each time you open this page. Aggregate and operational data only — members&rsquo;
          private check-ins, ratings and reviews are never shown here.
        </p>
      </section>

      {/* ---- Content & programming ---- */}
      <section>
        <SectionHeading count={content.total}>Content &amp; programming</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={content.published} label="Published" />
          <StatTile value={content.drafts} label="Drafts" accent={content.drafts > 0} />
          <StatTile value={content.scheduledAhead} label="Scheduled ahead" />
          <StatTile value={content.folders} label="Brain folders" />
          <StatTile value={programming.challengesPublished} label="Challenges live" />
          <StatTile value={programming.noticesLive} label="Notices live" />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Library by type</p>
            <div className="mt-2 space-y-2">
              {content.byType.map((t) => (
                <ProportionBar key={t.type} label={CONTENT_TYPE_LABEL[t.type]} count={t.count} max={typeMax} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {programming.podcastEpisodes} podcast episode{programming.podcastEpisodes === 1 ? "" : "s"}.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Coverage</p>
            <div className="mt-2">
              <CoverageStrip coverage={content.coverage} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Community health ---- */}
      <section>
        <SectionHeading>Community health</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={community.feedPosts} label="Feed posts" />
          <StatTile value={community.winsPosts} label="Wins shared" />
          <StatTile value={community.comments} label="Comments" />
          <StatTile value={community.likes} label="Likes" />
          <StatTile value={community.badgesShared} label="Badges shared" />
          <StatTile
            value={community.openReports}
            label="Open reports"
            accent={community.openReports > 0}
            hint={community.resolvedReports > 0 ? `${community.resolvedReports} resolved` : undefined}
            href="/admin/moderation"
          />
        </div>
      </section>

      {/* ---- Events ---- */}
      <section>
        <SectionHeading>Events</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile value={events.published} label="Published" href="/admin/events" />
          <StatTile value={events.upcoming} label="Upcoming" href="/admin/events" />
          <StatTile value={events.bookingsConfirmed} label="Confirmed bookings" />
          <StatTile value={events.bookingsTotal} label="Bookings · all" />
        </div>
      </section>

      {/* ---- Manage (quick links into every surface) ---- */}
      <section>
        <SectionHeading>Manage</SectionHeading>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MANAGE_LINKS.map((s) => (
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
      </section>
    </div>
  );
}
