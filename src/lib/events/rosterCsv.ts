// Pure (no DB, no "server-only") so it's unit-testable -- the roster export
// action assembles rows (resolving member emails server-side) and hands them
// here. A register the organiser can actually use: every row carries a contact
// email, members included, which the old client-side export left blank.

export type RosterCsvRow = {
  status: string;
  name: string;
  email: string;
  type: "Member" | "Guest";
  bookedAt: string;
};

const HEADER = ["Status", "Name", "Email", "Type", "Booked at"];

/** RFC-4180-ish CSV: every field quoted, embedded quotes doubled, CRLF rows. */
export function buildRosterCsv(rows: RosterCsvRow[]): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = HEADER.map(esc).join(",");
  const lines = rows.map((r) =>
    [r.status, r.name, r.email, r.type, r.bookedAt].map((v) => esc(String(v ?? ""))).join(",")
  );
  return [header, ...lines].join("\r\n");
}

/** A safe, descriptive download filename derived from the event title. */
export function rosterCsvFilename(eventTitle: string): string {
  const slug =
    eventTitle
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event";
  return `${slug}-roster.csv`;
}
