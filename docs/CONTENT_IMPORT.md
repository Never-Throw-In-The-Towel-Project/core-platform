# Bulk content import (CSV)

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
