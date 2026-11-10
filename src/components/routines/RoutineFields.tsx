import { ROUTINE_WEEKDAYS } from "@/lib/routines/userRoutinesConfig";

/**
 * The shared fields for adding or editing a routine: a name, the weekday chips
 * (native checkboxes styled via peer-checked, so the set submits with the form
 * and needs no client state), and an optional time. Used by both RoutineComposer
 * (add) and RoutineRow's inline editor. `idPrefix` keeps label/input ids unique
 * when several of these render on one page.
 */
export function RoutineFields({
  idPrefix,
  initialLabel = "",
  initialWeekdays = [],
  initialTime = "",
}: {
  idPrefix: string;
  initialLabel?: string;
  initialWeekdays?: number[];
  initialTime?: string;
}) {
  const selected = new Set(initialWeekdays);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}-label`}
          className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted"
        >
          Routine
        </label>
        <input
          id={`${idPrefix}-label`}
          name="label"
          type="text"
          required
          maxLength={80}
          defaultValue={initialLabel}
          placeholder="e.g. Gym, Meditate, Read 10 pages"
          className="mt-2 w-full border-2 border-foreground bg-transparent px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Which days?</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROUTINE_WEEKDAYS.map((w) => (
            <label key={w.iso} className="cursor-pointer">
              <input
                type="checkbox"
                name="weekdays"
                value={w.iso}
                defaultChecked={selected.has(w.iso)}
                className="peer sr-only"
              />
              <span
                className="inline-block border-2 border-rule-border px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:border-foreground peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent-vivid"
              >
                {w.short}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-time`}
          className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted"
        >
          Time <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-time`}
          name="timeOfDay"
          type="time"
          defaultValue={initialTime}
          className="mt-2 block border-2 border-foreground bg-transparent px-3 py-2 text-base"
        />
      </div>
    </div>
  );
}
