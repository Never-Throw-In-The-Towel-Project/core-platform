import { NextResponse } from "next/server";

// Lightweight liveness probe for uptime monitoring. It intentionally does NOT
// touch the database or read any secret -- it answers "is the app process up and
// serving requests?" so an external monitor can alert on hard downtime without a
// dependency that could itself fail. Public and unauthenticated by design: it
// exposes nothing beyond liveness. force-dynamic so it is never statically cached.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
