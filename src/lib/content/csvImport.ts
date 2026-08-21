import { z } from "zod";
import type { ContentType, VideoCategory } from "@/types/database";

/**
 * Shared content-input validator + CSV bulk-import parsing.
 *
 * `ContentInputSchema` is the ONE source of truth for a content item's shape:
 * the single-add Studio action (`createContentItem`) and the bulk importer
 * (`importContentItems`) both parse through it, so a rule added here (the Vimeo
 * numeric-only regex, the http(s) link check, the day 1–7 range) applies to
 * both paths. It lives in this plain module rather than in the `"use server"`
 * actions file because a server-actions module may only export async functions.
 *
 * The CSV parser is deliberately pure (no Supabase, no `FormData`) so it is
 * unit-testable in isolation -- see csvImport.test.ts. The server action layers
 * auth + the DB insert on top of `parseContentImportCsv`.
 */
export const ContentInputSchema = z.object({
  type: z.enum(["video", "document", "image", "text"]),
  title: z.string().trim().min(1).max(200),
  category: z.enum(["mental_fitness", "physical_fitness", "nutrition", "tools_tips"]),
  summary: z.string().trim().max(1000).optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  vimeoId: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the numeric Vimeo ID only (e.g. 123456789), not a URL.")
    .max(64)
    .optional(),
  externalUrl: z
    .string()
    .trim()
    .regex(/^https?:\/\/.+/i, "Enter a valid http(s) link.")
    .max(2000)
    .optional(),
  tags: z.string().max(500).optional(),
  publish: z.enum(["true", "false"]).optional(),
});

/** An insert-ready content row: exactly the columns `content_items` takes,
 *  minus `created_by` (the action stamps that from the session). */
export type ContentImportRow = {
  type: ContentType;
  title: string;
  summary: string | null;
  category: VideoCategory;
  day_of_week: number | null;
  vimeo_id: string | null;
  asset_path: null;
  external_url: string | null;
  tags: string[];
  is_published: boolean;
  /** Optional Brain folder NAME to file this item under (create-or-reuse by
   *  name in the importer action). null = Unfiled. */
  folder: string | null;
};

/** A per-row problem, anchored to the 1-based line in the uploaded file so the
 *  operator can jump straight to the offending spreadsheet row. */
export type ContentImportError = { line: number; message: string };

export type ContentImportParseResult = {
  rows: ContentImportRow[];
  errors: ContentImportError[];
  /** A whole-file problem (bad/absent header, empty file). When set, `rows`
   *  and `errors` are empty -- there was nothing to validate row-by-row. */
  fatal?: string;
  /** Count of non-blank data rows seen (valid or not), for the summary. */
  dataRowCount: number;
};

export type ContentImportState =
  | { status: "idle" }
  | { status: "error"; message: string; rowErrors?: ContentImportError[] }
  | { status: "success"; message: string; created: number; published: number; drafted: number };

export const initialContentImportState: ContentImportState = { status: "idle" };

/** Hard cap per import so one insert stays well-bounded; larger loads split. */
export const MAX_IMPORT_ROWS = 500;

/**
 * Minimal RFC-4180 CSV tokenizer: quoted fields (`"..."`), escaped quotes
 * (`""`), and commas/newlines inside quotes are all handled, so a quoted
 * `"grief, sleep"` cell survives. Strips a leading UTF-8 BOM (Excel adds one).
 * Blank lines are preserved as records here and filtered by the mapper, which
 * keeps every line number aligned with the source file.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

type Canon = "type" | "title" | "category" | "summary" | "day" | "vimeo" | "url" | "tags" | "publish" | "folder";

/** Header spellings we accept, normalised (lowercased, spaces/hyphens → `_`). */
const HEADER_ALIASES: Record<string, Canon> = {
  type: "type",
  kind: "type",
  title: "title",
  name: "title",
  category: "category",
  theme: "category",
  summary: "summary",
  description: "summary",
  desc: "summary",
  day: "day",
  day_of_week: "day",
  dayofweek: "day",
  weekday: "day",
  vimeo: "vimeo",
  vimeo_id: "vimeo",
  vimeoid: "vimeo",
  external_url: "url",
  url: "url",
  link: "url",
  tags: "tags",
  tag: "tags",
  publish: "publish",
  published: "publish",
  folder: "folder",
  folder_name: "folder",
  group: "folder",
};

const DAY_NAMES: Record<string, number> = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 7, sunday: 7,
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

function parseDay(raw: string): { ok: true; value: number | undefined } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: undefined };
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 7 ? { ok: true, value: n } : { ok: false };
  }
  const n = DAY_NAMES[s.toLowerCase()];
  return n ? { ok: true, value: n } : { ok: false };
}

function normalizePublish(raw: string): "true" | "false" | null {
  const s = raw.trim().toLowerCase();
  if (["true", "yes", "y", "1", "live", "publish", "published"].includes(s)) return "true";
  if (["false", "no", "n", "0", "draft", "unpublished", "hidden"].includes(s)) return "false";
  return null;
}

function friendlyIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  const path = issue?.path[0];
  if (path === "type") return "type must be video, document, image, or text.";
  if (path === "category")
    return "category must be one of mental_fitness, physical_fitness, nutrition, tools_tips.";
  if (path === "title") return "title is required (1–200 characters).";
  return issue?.message ?? "Please check this row.";
}

/**
 * Parse a CSV catalogue into insert-ready content rows. Pure: no auth, no DB.
 *
 * Contract mirrored by the caller: validation is all-or-nothing at the row
 * level -- the action imports rows ONLY when `errors` is empty, so a single bad
 * row never leaves a partial catalogue behind (which would duplicate on a
 * re-run). A `fatal` string signals a whole-file problem (no header, missing
 * required columns) where row-by-row validation never got started.
 *
 * Media is validated to the same shape the `content_items` CHECK constraint
 * enforces: a video needs a `vimeo_id`; a document/image needs an
 * `external_url` (binary uploads can't ride a CSV, so those stay in the form).
 */
export function parseContentImportCsv(
  input: string,
  opts: { defaultPublish: boolean }
): ContentImportParseResult {
  const empty = (fatal?: string): ContentImportParseResult => ({ rows: [], errors: [], fatal, dataRowCount: 0 });

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

  if (col.title === undefined || col.category === undefined) {
    return empty(
      "The CSV needs at least a `title` and a `category` column in the first row. See the format guide below."
    );
  }

  const rows: ContentImportRow[] = [];
  const errors: ContentImportError[] = [];
  let dataRowCount = 0;

  for (let i = headerIdx + 1; i < records.length; i++) {
    const rec = records[i];
    if (isBlank(rec)) continue;
    const line = i + 1; // 1-based file line; header is line headerIdx+1
    dataRowCount++;

    if (dataRowCount > MAX_IMPORT_ROWS) {
      errors.push({ line, message: `More than ${MAX_IMPORT_ROWS} rows — split the file and import in batches.` });
      continue;
    }

    // More cells than the header, with content spilling past it, almost always
    // means an unquoted comma inside a value. Flag it precisely rather than
    // silently truncating.
    if (rec.length > header.length && rec.slice(header.length).some((c) => c.trim() !== "")) {
      errors.push({
        line,
        message:
          "This row has more columns than the header — wrap any value containing a comma in double quotes, or separate tags with ; instead.",
      });
      continue;
    }

    const get = (c: Canon): string => {
      const idx = col[c];
      return idx === undefined ? "" : (rec[idx] ?? "").trim();
    };

    const publishCell = get("publish");
    let publish: "true" | "false";
    if (publishCell === "") {
      publish = opts.defaultPublish ? "true" : "false";
    } else {
      const p = normalizePublish(publishCell);
      if (p === null) {
        errors.push({ line, message: `publish must be true or false (got "${publishCell}").` });
        continue;
      }
      publish = p;
    }

    const dayRes = parseDay(get("day"));
    if (!dayRes.ok) {
      errors.push({ line, message: `day must be 1–7 or a weekday name (got "${get("day")}").` });
      continue;
    }

    const parsed = ContentInputSchema.safeParse({
      type: (get("type") || "video").toLowerCase(),
      title: get("title") || undefined,
      category: get("category").toLowerCase() || undefined,
      summary: get("summary") || undefined,
      dayOfWeek: dayRes.value,
      vimeoId: get("vimeo") || undefined,
      externalUrl: get("url") || undefined,
      tags: get("tags") || undefined,
      publish,
    });
    if (!parsed.success) {
      errors.push({ line, message: friendlyIssue(parsed.error) });
      continue;
    }
    const d = parsed.data;

    if (d.type === "video" && !d.vimeoId) {
      errors.push({ line, message: "A video row needs a vimeo_id." });
      continue;
    }
    // `text` items (a journal principle / prompt / quote) carry no media at all
    // -- title + summary is the whole item. document/image still need a URL.
    if ((d.type === "document" || d.type === "image") && !d.externalUrl) {
      errors.push({
        line,
        message: `A ${d.type} row needs an external_url (file uploads can’t ride a CSV — add those in the form above).`,
      });
      continue;
    }

    const tags = [
      ...new Set(
        (d.tags ?? "")
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ];

    const folderCell = get("folder");
    rows.push({
      type: d.type,
      title: d.title,
      summary: d.summary ?? null,
      category: d.category,
      day_of_week: d.dayOfWeek ?? null,
      // Only video/document/image carry media; a text item never does.
      vimeo_id: d.type === "video" ? d.vimeoId ?? null : null,
      asset_path: null,
      external_url: d.type === "document" || d.type === "image" ? d.externalUrl ?? null : null,
      tags,
      is_published: d.publish === "true",
      folder: folderCell.length > 0 ? folderCell.slice(0, 100) : null,
    });
  }

  return { rows, errors, dataRowCount };
}
