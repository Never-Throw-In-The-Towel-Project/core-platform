import { NextResponse } from "next/server";
import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { collectImpactReportData } from "@/lib/reports/collectImpactReportData";

/**
 * On-demand impact report download for the logged-in HR admin -- unlike the
 * day-90 auto-generated report (a separate cron job, since that one has to
 * run and email itself with nobody present), this is available any time
 * from the dashboard, not gated to a specific milestone.
 *
 * This route lives under /api, which src/proxy.ts deliberately excludes
 * from its auth gate (see the comment there) -- every other /api route
 * authenticates itself independently (Twilio signing, CRON_SECRET, an ack
 * token) because none of them have a user session to check. This one is
 * the exception: it's called by a logged-in browser, so it gates itself
 * explicitly with requireHrAdmin() rather than relying on proxy.
 */
export async function GET() {
  const profile = await requireHrAdmin();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js), the same gap already closed on every other
  // call site -- but this one's a Route Handler, not a page render, so it
  // isn't covered by app/error.tsx at all. Unwrapped, this returned Next's
  // raw unstyled default 500 to an HR admin clicking "Download impact
  // report" instead of a JSON error the client can show a message for.
  try {
    const supabase = await createClient();

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .single();

    if (!company) {
      return NextResponse.json({ error: "company not found" }, { status: 404 });
    }

    const data = await collectImpactReportData(supabase, profile.company_id, company.name);
    // Loaded on demand so the heavy @react-pdf/renderer subtree stays out of
    // this route's cold-start graph (import() is cached across requests).
    const { generateImpactReportPdf } = await import("@/lib/reports/generateImpactReportPdf");
    const pdf = await generateImpactReportPdf(data);

    // NextResponse's body type doesn't line up with Node's Buffer (a TS/@types
    // mismatch -- Buffer's `.buffer` is typed ArrayBufferLike, which includes
    // SharedArrayBuffer, while the DOM lib's BlobPart wants a plain
    // ArrayBuffer specifically). Uint8Array.from copies into a fresh,
    // plain-ArrayBuffer-backed array, not a real runtime incompatibility.
    return new NextResponse(new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ntitt-impact-report-${data.generatedAt}.pdf"`,
      },
    });
  } catch (err) {
    console.error("GET /api/reports/impact: failed to generate report", err);
    return NextResponse.json({ error: "failed to generate report" }, { status: 500 });
  }
}
