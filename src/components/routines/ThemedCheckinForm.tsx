"use client";

import { useActionState } from "react";
import { submitThemedCheckin } from "@/lib/actions/themedCheckin";
import { initialRoutineState } from "@/lib/actions/routineState";
import { CHECKIN_CONFIG, FRIDAY_GOAL_OPTIONS, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";

type Props = {
  weekday: TextCheckinWeekday;
  /** Friday only: this week's Monday goals, read back to close the loop. */
  mondayGoals?: string[];
  /** Thursday only: this week's rotating quote. */
  quote?: { quote_text: string; author: string | null } | null;
  /** Tuesday only: this month's podcast episode, surfaced on the first Tuesday. */
  podcastEpisode?: { title: string; embed_url: string } | null;
};

export function ThemedCheckinForm({ weekday, mondayGoals, quote, podcastEpisode }: Props) {
  const [state, formAction, isPending] = useActionState(submitThemedCheckin, initialRoutineState);
  const config = CHECKIN_CONFIG[weekday];

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">{config.title} complete.</h1>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="opacity-80">{config.subtitle}</p>
      </header>

      {quote && (
        <blockquote className="rounded-lg border border-white/10 p-4 text-sm italic">
          &ldquo;{quote.quote_text}&rdquo;
          {quote.author && <footer className="mt-1 not-italic opacity-70">— {quote.author}</footer>}
        </blockquote>
      )}

      {podcastEpisode && (
        <div className="rounded-lg border border-white/10 p-4 text-sm">
          <p className="font-medium">🎙️ This month&apos;s podcast episode</p>
          <p className="mt-1">{podcastEpisode.title}</p>
          <a href={podcastEpisode.embed_url} className="mt-2 inline-block underline opacity-80">
            Listen now
          </a>
        </div>
      )}

      {weekday === "monday" && (
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">What are my 3 main goals this week?</legend>
          {[1, 2, 3].map((n) => (
            <input
              key={n}
              name={`goal${n}`}
              type="text"
              placeholder={`Goal ${n}`}
              className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          ))}
        </fieldset>
      )}

      {/* Per Anthony's guidance: if Monday was skipped that week, Friday
          just skips the goal check entirely -- no empty question, no
          penalty for dipping in and out. */}
      {weekday === "friday" && mondayGoals && mondayGoals.length > 0 && (
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">Did you achieve your goals from Monday?</legend>
          <ul className="list-inside list-disc rounded-lg border border-white/10 p-3 opacity-80">
            {mondayGoals.map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
          {FRIDAY_GOAL_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input type="radio" name="achieved_monday_goals" value={option.value} required />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}

      {config.fields.map((field) => (
        <label key={field.key} className="block text-sm">
          <span className="font-medium">{field.label}</span>
          {field.type === "textarea" ? (
            <textarea
              name={field.key}
              rows={2}
              className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          ) : (
            <input
              name={field.key}
              type="text"
              className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          )}
        </label>
      ))}

      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : `Complete ${config.title}`}
      </button>
    </form>
  );
}
