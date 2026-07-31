import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectImpactReportData } from "@/lib/reports/collectImpactReportData";
import { generateImpactReportPdf } from "@/lib/reports/generateImpactReportPdf";
import { getHrAdminEmails } from "@/lib/reports/getHrAdminEmails";
import { sendImpactReportEmail } from "@/lib/reports/sendImpactReportEmail";
import { todayISODate } from "@/lib/routines/dates";

/**
 * "At day 90 the company dashboard automatically generates an aggregate
 * impact report for HR... should generate automatically and notify the HR
 * contact when ready" (brief). "Day 90" for a company is 90 calendar days
 * since `companies.created_at` -- there's no other "company start date"
 * concept in the schema, and unlike the per-user 30/90-Day Review (which is
 * active-engagement based, see docs/ARCHITECTURE.md), a company-wide
 * milestone reasonably is calendar time since onboarding: the report covers
 * a fixed quarter of the company's subscription regardless of how many
 * individual employees engaged, which is exactly the "here's your impact
 * over the quarter" business conversation this report exists to trigger.
 *
 * Runs daily via Vercel Cron (see vercel.json). Only sends once per company
 * (`ninety_day_report_sent_at`) -- if sending fails or there's no HR admin
 * to send to yet, it's left null so the next run retries rather than
 * silently losing the report forever.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  const { data: dueCompanies } = await supabase
    .from("companies")
    .select("id, name")
    .is("ninety_day_report_sent_at", null)
    .lte("created_at", ninetyDaysAgo.toISOString());

  let sentCount = 0;

  for (const company of dueCompanies ?? []) {
    const emails = await getHrAdminEmails(company.id);
    if (emails.length === 0) continue; // no HR admin provisioned yet -- retry next run

    const data = await collectImpactReportData(supabase, company.id, company.name);
    const pdf = await generateImpactReportPdf(data);

    const result = await sendImpactReportEmail({
      toEmails: emails,
      companyName: company.name,
      pdfBuffer: pdf,
      filename: `ntitt-impact-report-${todayISODate()}.pdf`,
    });

    if (result.ok) {
      await supabase
        .from("companies")
        .update({ ninety_day_report_sent_at: new Date().toISOString() })
        .eq("id", company.id);
      sentCount += 1;
    }
    // send failed -- left null so this retries on the next run rather than
    // silently losing the report.
  }

  return NextResponse.json({ ok: true, checked: dueCompanies?.length ?? 0, sent: sentCount });
}
