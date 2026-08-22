import Link from "next/link";
import type { AdminOverviewData } from "@/lib/admin/overviewSummary";
import type { PeopleOverview } from "@/lib/admin/overviewPeopleSummary";
import type { EngagementOverview, ParticipationTrend } from "@/lib/admin/overviewEngagementSummary";
import type { UserRole } from "@/types/database";
import { CONTENT_TYPE_LABEL, CoverageStrip, MiniBars, ProportionBar, SectionHeading, StatTile } from "./primitives";

const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employees",
  hr_admin: "HR admins",
  ntitt_admin: "Super admins",
};

/** A tenant's participation trend as an arrow + word, coloured by direction. */
function TrendBadge({ trend, points }: { trend: ParticipationTrend; points: number | null }) {
  if (trend === "not_enough_data") return <span className="text-xs text-muted">—</span>;
  const map: Record<Exclude<ParticipationTrend, "not_enough_data">, { glyph: string; label: string; cls: string }> = {
    rising: { glyph: "↗", label: "Rising", cls: "text-success" },
    falling: { glyph: "↘", label: "Falling", cls: "text-brand-accent-deep" },
    steady: { glyph: "→", label: "Steady", cls: "text-muted" },
  };
  const t = map[trend];
  return (
    <span className={`text-xs font-semibold ${t.cls}`}>
      {t.glyph} {t.label}
      {points != null && points !== 0 ? ` ${points > 0 ? "+" : ""}${points}pts` : ""}
    </span>
  );
}

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

export function OverviewDashboard({
  data,
  people,
  engagement,
}: {
  data: AdminOverviewData;
  people: PeopleOverview;
  engagement: EngagementOverview;
}) {
  const { content, community, events, programming } = data;
  const typeMax = Math.max(1, ...content.byType.map((t) => t.count));
  const roleMax = Math.max(1, ...people.byRole.map((r) => r.count));
  const onboardingPct = Math.round(people.onboardingRate * 100);

  return (
    <div className="space-y-12">
      {/* ---- Platform at a glance ---- */}
      <section>
        <SectionHeading>Platform at a glance</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={people.total} label="Members" />
          <StatTile value={people.newLast30d} label="New · last 30 days" />
          <StatTile value={people.active7d} label="Active · last 7 days" />
          <StatTile value={data.companies} label="Companies" href="/admin/companies" />
          <StatTile value={content.published} label="Published content" href="/admin/content" />
          <StatTile
            value={community.openReports}
            label="Open reports"
            accent={community.openReports > 0}
            href="/admin/moderation"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Live counts, refreshed each time you open this page. Aggregate and operational data only — members&rsquo;
          private check-ins, ratings and reviews are never shown here.
        </p>
      </section>

      {/* ---- People & tenants ---- */}
      <section>
        <SectionHeading count={people.total}>People &amp; tenants</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={people.total} label="Members" />
          <StatTile value={people.newLast7d} label="New · 7 days" />
          <StatTile value={people.newLast30d} label="New · 30 days" />
          <StatTile value={people.activeToday} label="Active today" />
          <StatTile value={people.active7d} label="Active · 7 days" />
          <StatTile value={`${onboardingPct}%`} label="Onboarded" hint={`${people.onboardedCount} of ${people.total}`} />
        </div>
        <p className="mt-3 text-xs text-muted">
          &ldquo;Active&rdquo; counts members seen in-app within the window. Activity tracking is new, so these fill
          in as members return — a fresh install shows low numbers until people sign back in.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">By role</p>
            <div className="mt-2 space-y-2">
              {people.byRole.map((r) => (
                <ProportionBar key={r.role} label={ROLE_LABEL[r.role]} count={r.count} max={roleMax} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {people.communityOptIn} opted into the community · {people.podcastOptIn} open to the podcast.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">New sign-ups · 8 weeks</p>
            <div className="mt-2">
              {people.newByWeek.length > 0 ? (
                <MiniBars data={people.newByWeek.map((w) => ({ label: w.weekStartIso, count: w.count }))} />
              ) : (
                <p className="text-xs text-muted">No sign-up history yet.</p>
              )}
            </div>
          </div>
        </div>

        {people.perCompany.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Members per company</p>
            <ul className="mt-2 divide-y divide-rule-hairline border border-rule-border">
              {people.perCompany.map((c) => (
                <li key={c.companyId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {c.members} member{c.members === 1 ? "" : "s"} · {c.onboarded} onboarded
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---- Company engagement (anonymised aggregates across all tenants) ---- */}
      <section>
        <SectionHeading count={engagement.companiesWithData}>Company engagement</SectionHeading>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            value={engagement.avgParticipationPercent != null ? `${engagement.avgParticipationPercent}%` : "—"}
            label="Avg participation"
            hint={`${engagement.companiesWithData} tenant${engagement.companiesWithData === 1 ? "" : "s"} with data`}
          />
          <StatTile
            value={engagement.reviewRate != null ? `${engagement.reviewRate}%` : "—"}
            label="Reviews completed"
            hint={engagement.reviewEligible > 0 ? `${engagement.reviewCompleted} of ${engagement.reviewEligible}` : undefined}
          />
          <StatTile value={engagement.supportTotal} label="Support requests" />
          <StatTile
            value={`${engagement.trendTally.rising}↗ ${engagement.trendTally.steady}→ ${engagement.trendTally.falling}↘`}
            label="Trend · tenants"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Anonymised, company-level aggregates only — the same numbers each company&rsquo;s HR sees for their own
          team. No individual&rsquo;s check-ins, ratings or reviews are ever shown, here or anywhere. Figures come
          from the weekly aggregation job, so a brand-new tenant reads &ldquo;—&rdquo; until its first week lands.
        </p>

        {engagement.companies.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule-border text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  <th className="py-2 pr-3 font-extrabold">Company</th>
                  <th className="py-2 pr-3 font-extrabold">Participation</th>
                  <th className="py-2 pr-3 font-extrabold">Trend</th>
                  <th className="py-2 pr-3 font-extrabold">Reviews</th>
                  <th className="py-2 pr-3 font-extrabold">Support</th>
                  <th className="py-2 font-extrabold">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-hairline">
                {engagement.companies.map((c) => (
                  <tr key={c.companyId}>
                    <td className="py-2 pr-3 font-semibold">{c.name}</td>
                    {c.hasData ? (
                      <>
                        <td className="py-2 pr-3 tabular-nums">
                          {c.latestParticipationPercent != null ? `${c.latestParticipationPercent}%` : "—"}
                          {c.latestWeekNumber != null ? (
                            <span className="ml-1 text-[10px] text-muted">wk {c.latestWeekNumber}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <TrendBadge trend={c.trend} points={c.trendPoints} />
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-muted">
                          {c.reviewEligible > 0 ? `${c.reviewCompleted}/${c.reviewEligible}` : "—"}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-muted">{c.supportCount}</td>
                        <td className="py-2 tabular-nums text-muted">{c.headcount}</td>
                      </>
                    ) : (
                      <td className="py-2 text-xs text-muted" colSpan={5}>
                        No participation data yet.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No companies yet.</p>
        )}
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
