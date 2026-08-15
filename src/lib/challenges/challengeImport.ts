import { parseCsv } from "@/lib/content/csvImport";

/**
 * CSV bulk-import parsing for a challenge's day sequence (challenge → day_index →
 * content). The companion to the content bulk importer: content items are loaded
 * once via the content CSV / Studio, and THIS importer lays a whole challenge's
 * daily plan (which item, and/or a prompt, on which day) in one pass instead of
 * one `addChallengeDay` at a time.
 *
 * Two pure phases, both unit-tested (no Supabase, no FormData); the server action
 * (`importChallengeDays`) layers auth, the DB content lookup, and the insert on
 * top:
 *   1. `parseChallengeImportCsv` — structure only: a valid `day_index` (1–366),
 *      within-file uniqueness of the day, the "content or prompt (or both)" rule
 *      that mirrors `addChallengeDay`, and a raw content reference string.
 *   2. `resolveChallengeContent` — turns each raw reference (a content item's
 *      title, or its id) into a real `content_item_id` against an index built
 *      from the admin content list. Kept separate from parsing because it needs
 *      DB data, yet stays pure by taking the index as an argument.
 *
 * All-or-nothing at the row level, exactly like the content importer: the action
 * writes rows only when there are zero errors across BOTH phases, so a bad row
 * never leaves a half-sequenced challenge that would collide on a re-run.
 */

/** A per-row problem, anchored to the 1-based line in the uploaded file. */
export type ChallengeImportError = { line: number; message: string };

/** A structurally-valid row, content reference not yet resolved to an id. */
export type ParsedChallengeRow = {
  line: number;
  dayIndex: number;
  /** Raw reference to a content item (title or id); null = prompt-only day. */
  contentRef: string | null;
  prompt: string | null;
};

export type ChallengeImportParseResult = {
  rows: ParsedChallengeRow[];
  errors: ChallengeImportError[];
  /** A whole-file problem (empty file, no `day` column); rows/errors are empty. */
  fatal?: string;
  dataRowCount: number;
};

/** An insert-ready `challenge_days` row, minus the challenge_id the action adds. */
export type ResolvedChallengeDay = {
  day_index: number;
  content_item_id: string | null;
  prompt: string | null;
};

/** A lookup over the admin content list, for resolving references by id or title. */
export type ChallengeContentIndex = {
  byId: Set<string>;
  /** normalised (trim+lowercase) title → the ids that carry it (usually one). */
  byTitle: Map<string, string[]>;
};

export type ChallengeImportState =
  | { status: "idle" }
  | { status: "error"; message: string; rowErrors?: ChallengeImportError[] }
  | { status: "success"; message: string; created: number; withContent: number; promptOnly: number };

export const initialChallengeImportState: ChallengeImportState = { status: "idle" };

/** A challenge has at most 366 days, so this doubles as the row cap. */
export const MAX_CHALLENGE_IMPORT_ROWS = 366;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Canon = "day" | "content" | "prompt";

/** Header spellings we accept, normalised (lowercased, spaces/hyphens → `_`). */
const HEADER_ALIASES: Record<string, Canon> = {
  day: "day",
  day_index: "day",
  day_number: "day",
  dayindex: "day",
  index: "day",
  number: "day",
  content: "content",
  content_title: "content",
  content_id: "content",
  item: "content",
  title: "content",
  video: "content",
  prompt: "prompt",
  note: "prompt",
  label: "prompt",
  text: "prompt",
  guidance: "prompt",
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

function parseDayIndex(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 366 ? n : null;
}

/**
 * Parse a CSV of challenge days into structurally-valid rows. Pure: no auth, no
 * DB, no content resolution (see `resolveChallengeContent`). A `fatal` string
 * signals a whole-file problem where row-by-row validation never started.
 */
export function parseChallengeImportCsv(input: string): ChallengeImportParseResult {
  const empty = (fatal?: string): ChallengeImportParseResult => ({ rows: [], errors: [], fatal, dataRowCount: 0 });

  const records = parseCsv(input);
  const isBlank = (r: string[]) => r.every((c) => c.trim() === "");

  const headerIdx = records.findIndex((r) => !isBlank(r));
  if (headerIdx === -1) return empty("The file is empty — paste some CSV or choose a .csv file.");

  const header = records[headerIdx].map(normalizeHeader);
  const col: Partial<Record<Canon, number>> = {};
  header.forEach((h, i) => {
    const canon = HEADER_ALIASES[h];
    if (canon && col[canon] === undefined) col[canon] = i;
  });

  if (col.day === undefined) {
    return empty(
      "The CSV needs at least a `day` column in the first row (the day number). See the format guide below."
    );
  }

  const rows: ParsedChallengeRow[] = [];
  const errors: ChallengeImportError[] = [];
  const seenDays = new Map<number, number>(); // dayIndex → first line it appeared on
  let dataRowCount = 0;

  for (let i = headerIdx + 1; i < records.length; i++) {
    const rec = records[i];
    if (isBlank(rec)) continue;
    const line = i + 1; // 1-based file line
    dataRowCount++;

    if (dataRowCount > MAX_CHALLENGE_IMPORT_ROWS) {
      errors.push({ line, message: `More than ${MAX_CHALLENGE_IMPORT_ROWS} rows — a challenge has at most 366 days.` });
      continue;
    }

    if (rec.length > header.length && rec.slice(header.length).some((c) => c.trim() !== "")) {
      errors.push({
        line,
        message:
          "This row has more columns than the header — wrap any value containing a comma in double quotes.",
      });
      continue;
    }

    const get = (c: Canon): string => {
      const idx = col[c];
      return idx === undefined ? "" : (rec[idx] ?? "").trim();
    };

    const dayIndex = parseDayIndex(get("day"));
    if (dayIndex === null) {
      errors.push({ line, message: `day must be a whole number 1–366 (got "${get("day")}").` });
      continue;
    }

    const prior = seenDays.get(dayIndex);
    if (prior !== undefined) {
      errors.push({ line, message: `day ${dayIndex} is used twice (also on row ${prior}) — each day appears once.` });
      continue;
    }
    // Claim the day now, so a later duplicate is always caught even if this row
    // fails a later check.
    seenDays.set(dayIndex, line);

    const contentRaw = get("content");
    const contentRef = contentRaw === "" ? null : contentRaw;

    const promptRaw = get("prompt");
    if (promptRaw.length > 1000) {
      errors.push({ line, message: "prompt is too long (max 1000 characters)." });
      continue;
    }
    const prompt = promptRaw === "" ? null : promptRaw;

    if (!contentRef && !prompt) {
      errors.push({ line, message: "Each day needs a content reference, a prompt, or both." });
      continue;
    }

    rows.push({ line, dayIndex, contentRef, prompt });
  }

  return { rows, errors, dataRowCount };
}

/** Build the id/title lookup from the admin content list. */
export function buildContentIndex(items: { id: string; title: string }[]): ChallengeContentIndex {
  const byId = new Set<string>();
  const byTitle = new Map<string, string[]>();
  for (const item of items) {
    byId.add(item.id);
    const key = item.title.trim().toLowerCase();
    const list = byTitle.get(key) ?? [];
    list.push(item.id);
    byTitle.set(key, list);
  }
  return { byId, byTitle };
}

/**
 * Resolve each row's raw content reference to a real `content_item_id`. Pure:
 * takes the index as an argument. A reference is a content item's id (exact) or
 * its title (must match exactly one item — an ambiguous title is an error that
 * asks for the id). An empty reference is a valid prompt-only day.
 */
export function resolveChallengeContent(
  rows: ParsedChallengeRow[],
  index: ChallengeContentIndex
): { resolved: ResolvedChallengeDay[]; errors: ChallengeImportError[] } {
  const resolved: ResolvedChallengeDay[] = [];
  const errors: ChallengeImportError[] = [];

  for (const row of rows) {
    let contentItemId: string | null = null;

    if (row.contentRef) {
      if (UUID_RE.test(row.contentRef)) {
        if (index.byId.has(row.contentRef)) {
          contentItemId = row.contentRef;
        } else {
          errors.push({ line: row.line, message: `No content item with id ${row.contentRef}.` });
          continue;
        }
      } else {
        const matches = index.byTitle.get(row.contentRef.trim().toLowerCase()) ?? [];
        if (matches.length === 1) {
          contentItemId = matches[0];
        } else if (matches.length === 0) {
          errors.push({
            line: row.line,
            message: `No content item titled “${row.contentRef}”. Load it first, or reference it by id.`,
          });
          continue;
        } else {
          errors.push({
            line: row.line,
            message: `More than one content item is titled “${row.contentRef}” — reference it by id instead.`,
          });
          continue;
        }
      }
    }

    resolved.push({ day_index: row.dayIndex, content_item_id: contentItemId, prompt: row.prompt });
  }

  return { resolved, errors };
}
