# Bulk CSV import (content + challenge days)

Two CSV importers, both Super Admin (`ntitt_admin`) only, both **all-or-nothing**
with per-row errors. They compose: load your content library once, then sequence
it into a challenge's days.

1. **Content catalogue** — Admin → Content Studio → "Bulk import from CSV" (below).
2. **Challenge days** — Admin → Challenges → open a challenge → "Bulk import days
   from CSV" ([Challenge day sequencing](#challenge-day-sequencing-csv)).

---

## Content catalogue import

Load a whole content catalogue in one go instead of adding pieces one at a time.
Super Admins (`ntitt_admin`) only — **Admin → Content Studio → "Bulk import from CSV"**.

Every row is validated through the **same rules as the single-add form** (the
Vimeo numeric-ID check, the http(s) link check, the day-of-week range, the
category list). Validation is **all-or-nothing**: if any row is wrong, nothing
is imported and you're shown exactly which rows to fix. That means a re-upload
after a fix never double-creates the rows that were already fine.

## What it does and doesn't cover

- ✅ **Video** rows (a numeric Vimeo ID) and **document/image** rows that point at
  an **external URL**.
- ✅ Publishes on import (or saves as drafts — your choice).
- ❌ **File uploads.** A CSV can't carry a PDF or an image binary, so document/image
  rows must use `external_url`. To upload a file, use the single-add form above.
- ❌ **Channel targeting.** Imported items are **NTITT-wide** (visible to every
  company). To target a piece at one partner channel, add it in the single-add form.

## Columns

First row is the header. Column names are case-insensitive and a few aliases are
accepted (e.g. `Theme` → `category`, `Day of week` → `day`, `Vimeo ID` → `vimeo_id`).

| Column | Required | Values |
| --- | --- | --- |
| `title` | **yes** | 1–200 characters |
| `category` | **yes** | `mental_fitness`, `physical_fitness`, `nutrition`, `tools_tips` |
| `type` | no (default `video`) | `video`, `document`, `image` |
| `day` | no (default: any day) | `1`–`7` (Mon–Sun) or a weekday name (`mon`, `friday`, …) |
| `vimeo_id` | video rows | numeric Vimeo ID only, e.g. `123456789` (not a URL) |
| `external_url` | document/image rows | `http(s)://…` |
| `tags` | no | separate with `;` (or wrap a comma-containing cell in double quotes) |
| `summary` | no | up to 1000 characters |
| `publish` | no | `true`/`false` (also `yes`/`no`, `live`/`draft`). Blank follows the "Publish imported items now" checkbox. |

Media rules mirror the database constraint: a **video** row needs a `vimeo_id`; a
**document/image** row needs an `external_url`.

## Example

```csv
type,title,category,day,vimeo_id,external_url,tags,summary,publish
video,Breathing reset,mental_fitness,monday,123456789,,"stress;sleep",A 5-minute box-breathing reset,true
video,Mobility flow,physical_fitness,,987654321,,mobility,,true
document,Nutrition basics,nutrition,,,https://example.com/guide.pdf,nutrition,One-page starter guide,false
```

## Tips

- Export from Google Sheets / Excel as **CSV** and either upload the file or paste it.
- Up to **500 rows** per import — split larger catalogues into batches.
- Getting a "more columns than the header" error usually means a value contains a
  comma — wrap it in double quotes, or use `;` to separate tags.
- Fixing a bad piece after import: use the per-item **Unpublish** / **Delete**
  controls in the Studio list (delete + re-import, or delete + re-add in the form).

---

## Challenge day sequencing (CSV)

Lay out a whole challenge's daily plan in one pass instead of adding days one at a
time. Super Admins only — **Admin → Challenges → open a challenge → "Bulk import
days from CSV"**. Scoped to the challenge you're editing (you don't put the
challenge in the CSV).

This importer **sequences content that already exists** — it does not create
content. Load the pieces via the content catalogue import (above) or the single-add
form first, then reference them here.

### Columns

First row is the header. Column names are case-insensitive with a few aliases
(`day_index`/`day_number` → `day`, `content_title`/`content_id`/`item` → `content`,
`note`/`label` → `prompt`).

| Column | Required | Values |
| --- | --- | --- |
| `day` | **yes** | a whole number `1`–`366`; each day appears once |
| `content` | no | an existing content item's **exact title**, or its **id** |
| `prompt` | no | guidance/label for the day, up to 1000 characters |

Each row needs a `content`, a `prompt`, or **both** — a `prompt`-only row is a
rest / reflection day (no content).

- A `content` value must match **exactly one** existing item. If two items share a
  title, reference the one you mean by its **id** (copy it from the Studio).
- A `day` number that **already exists** in the challenge is reported, not
  overwritten — remove it from the file, or delete that day first, then re-import.

### Example

```csv
day,content,prompt
1,Breathing reset,Start with five minutes of box breathing.
2,,Rest day — take a gentle walk and reflect.
3,Mobility flow,
```

Here day 1 pairs the existing **Breathing reset** item with a prompt, day 2 is a
prompt-only rest day, and day 3 is the **Mobility flow** item with no extra prompt.
