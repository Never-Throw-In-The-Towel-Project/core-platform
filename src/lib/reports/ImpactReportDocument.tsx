import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  ParticipationTrend,
  ReviewCompletionSummary,
  WeekdayEngagement,
  WeeklyParticipation,
} from "@/lib/dashboard/aggregates";

/**
 * "Make it look professional -- it needs to work as a standalone document
 * in a board meeting without Anthony being in the room." Real server-side
 * PDF generation (@react-pdf/renderer -- pure JS, no headless browser,
 * fine on Vercel's Node runtime), deliberately different from Phase 3's
 * print-friendly page for the user's own 90-day summary: that one is
 * opened by a logged-in person who can click print; this one has to be
 * generated and emailed unattended by the day-90 cron job with nobody
 * present to click anything.
 */

export interface ImpactReportData {
  companyName: string;
  generatedAt: string;
  supportCount: number;
  reviewCompletions: ReviewCompletionSummary[];
  weeklyParticipation: WeeklyParticipation[];
  weekdayEngagement: WeekdayEngagement[];
  trend: ParticipationTrend;
}

const TREND_LABEL: Record<ParticipationTrend, string> = {
  rising: "Rising",
  falling: "Falling",
  steady: "Steady",
  not_enough_data: "Not enough data yet",
};

const WEEKDAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const REVIEW_LABEL: Record<string, string> = {
  "30_day": "30-Day Review",
  "90_day": "90-Day Review",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#555", marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  label: { color: "#333333" },
  value: { fontWeight: 700 },
  statGrid: { flexDirection: "row", gap: 12, marginTop: 4 },
  statCard: { flex: 1, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 4 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 9, color: "#666666", marginTop: 2 },
  note: { fontSize: 9, color: "#888888", marginTop: 16 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
  },
});

export function ImpactReportDocument({ data }: { data: ImpactReportData }) {
  const engaged = data.weekdayEngagement.filter((w) => w.percent !== null);
  const mostEngaged = [...engaged].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
  const leastEngaged = [...engaged].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];

  const thirtyDay = data.reviewCompletions.find((r) => r.reviewType === "30_day");
  const ninetyDay = data.reviewCompletions.find((r) => r.reviewType === "90_day");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Never Throw In The Towel</Text>
        <Text style={styles.subtitle}>Wellbeing Programme Impact Report — {data.companyName}</Text>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{TREND_LABEL[data.trend]}</Text>
            <Text style={styles.statLabel}>Participation trend</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.supportCount}</Text>
            <Text style={styles.statLabel}>Ask for Support uses (all time)</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Review completion</Text>
        {[thirtyDay, ninetyDay].map(
          (review, i) =>
            review && (
              <View style={styles.row} key={i}>
                <Text style={styles.label}>{REVIEW_LABEL[review.reviewType]} completed</Text>
                <Text style={styles.value}>
                  {review.completedCount} of {review.eligibleCount}
                </Text>
              </View>
            )
        )}

        <Text style={styles.sectionTitle}>Engagement by day</Text>
        {mostEngaged && (
          <View style={styles.row}>
            <Text style={styles.label}>Most engaged day</Text>
            <Text style={styles.value}>
              {WEEKDAY_LABEL[mostEngaged.weekday]} ({mostEngaged.percent}%)
            </Text>
          </View>
        )}
        {leastEngaged && (
          <View style={styles.row}>
            <Text style={styles.label}>Least engaged day</Text>
            <Text style={styles.value}>
              {WEEKDAY_LABEL[leastEngaged.weekday]} ({leastEngaged.percent}%)
            </Text>
          </View>
        )}
        {engaged.length === 0 && <Text style={styles.note}>Not enough data yet.</Text>}

        <Text style={styles.sectionTitle}>
          Weekly participation (most recent {data.weeklyParticipation.length} weeks)
        </Text>
        {data.weeklyParticipation.length === 0 && (
          <Text style={styles.note}>Not enough data yet.</Text>
        )}
        {data.weeklyParticipation.map((week) => (
          <View style={styles.row} key={week.weekStartDate}>
            <Text style={styles.label}>Week of {week.weekStartDate}</Text>
            <Text style={styles.value}>
              Morning {week.morningPercent ?? "—"}% · Night {week.nightPercent ?? "—"}% · Check-ins{" "}
              {week.themedPercent ?? "—"}%
            </Text>
          </View>
        ))}

        <Text style={styles.note}>
          Aggregate, anonymised data only — no individual answers, names, or scores are ever
          included in this report or accessible to {data.companyName}.
        </Text>

        <Text style={styles.footer}>Generated {data.generatedAt} · Keep on Living.</Text>
      </Page>
    </Document>
  );
}
