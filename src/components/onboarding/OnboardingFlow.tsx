"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { finishOnboarding } from "@/lib/actions/onboarding";
import { setPassword, type SetPasswordState } from "@/lib/actions/auth";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { Profile } from "@/types/database";

const TOTAL_STEPS = 5;

/** Postgres `time` comes back as "HH:MM:SS" -- <input type="time"> wants "HH:MM". */
function toHHMM(value: string | null, fallback: string) {
  return (value ?? fallback).slice(0, 5);
}

function ProgressBar({ step, inverted }: { step: number; inverted: boolean }) {
  const filled = inverted ? "bg-background" : "bg-brand-accent";
  const empty = inverted ? "bg-background/35" : "bg-black/15";
  return (
    <div className="flex h-1">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => (
        <div key={index} className={`flex-1 ${index < step ? filled : empty}`} />
      ))}
    </div>
  );
}

/**
 * Four interactive screens, not five: design reference frame 1j's own
 * "Finish setup" button links straight to the Today screen (frame 1a), so
 * step 5 is landing there -- not a separate confirmation screen. Steps 1
 * (welcome) and 3 (password) have no design reference frame; they're new
 * for this build.
 */
export function OnboardingFlow({ profile }: { profile: Profile }) {
  const [step, setStep] = useState(1);

  if (step === 1) {
    return (
      <main className="flex min-h-full flex-1 flex-col">
        <ProgressBar step={1} inverted={false} />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={65} />
          <h1 className="mt-6 text-3xl font-extrabold uppercase">Welcome</h1>
          <p className="mt-3 opacity-80">
            A few quick things before you get started -- takes about a minute.
          </p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-8 w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="flex min-h-full flex-1 flex-col bg-brand-accent text-brand-accent-foreground">
        <ProgressBar step={2} inverted={true} />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-8">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-75">Step 2 of 5</p>
          <h1 className="mt-5 text-4xl leading-tight font-extrabold uppercase">
            What you write here is yours.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed opacity-90">
            Every answer in your routines, check-ins and reviews is private to you. Your employer
            cannot see it. Not your sleep score, not your day rating, not a single word you write.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed opacity-90">
            Your company sees numbers only, across everyone: who completed a check-in, not what
            they said.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed opacity-90">
            Nothing you write triggers anything. If you want someone to check in with you, you
            press the button yourself.
          </p>
          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full bg-background px-4 py-3 text-sm font-semibold text-foreground"
            >
              Understood, continue →
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 3) {
    return <PasswordStep onContinue={() => setStep(4)} />;
  }

  return <ScheduleStep profile={profile} />;
}

const initialSetPasswordState: SetPasswordState = { status: "idle" };

/**
 * Optional -- accounts are provisioned via magic link (see
 * lib/actions/auth.ts), so this only adds a faster path for next time. Users
 * can skip it and keep signing in with a magic link indefinitely.
 */
function PasswordStep({ onContinue }: { onContinue: () => void }) {
  const [state, formAction, isPending] = useActionState(setPassword, initialSetPasswordState);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <ProgressBar step={3} inverted={false} />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-8">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Step 3 of 5</p>
        <h1 className="mt-4 text-3xl font-extrabold uppercase">Set a password</h1>
        <p className="mt-2 text-sm opacity-70">
          Optional. Add one so you can sign in without waiting on an email link next time.
        </p>

        {state.status === "success" ? (
          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-sm text-green-700">Password set.</p>
            <button
              type="button"
              onClick={onContinue}
              className="mt-auto w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground"
            >
              Continue
            </button>
          </div>
        ) : (
          <form action={formAction} className="mt-6 flex flex-1 flex-col gap-4">
            <label className="text-sm">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full border border-black/20 bg-transparent px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full border border-black/20 bg-transparent px-3 py-2 text-sm"
              />
            </label>

            {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Set password"}
              </button>
              <button type="button" onClick={onContinue} className="text-sm opacity-60 underline">
                Skip for now
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function ScheduleStep({ profile }: { profile: Profile }) {
  // finishOnboarding redirects itself on success (see its own doc comment
  // for why) -- this only ever needs to render the error case.
  const [state, formAction, isPending] = useActionState(finishOnboarding, initialRoutineState);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <ProgressBar step={4} inverted={false} />
      <div className="mx-auto w-full max-w-sm flex-1 px-6 py-8">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Step 4 of 5</p>
        <h1 className="mt-4 text-3xl font-extrabold uppercase">Set your own times</h1>
        <p className="mt-2 text-sm opacity-70">
          You choose when the platform speaks to you. Your company does not.
        </p>

        <form action={formAction} className="mt-6 space-y-5">
          <TimeField
            name="morningTime"
            label="Morning routine"
            hint="Win the morning, win the day."
            defaultValue={toHHMM(profile.morning_notification_time, "07:00")}
          />
          <TimeField
            name="nightTime"
            label="Night routine"
            hint="Tomorrow is a new day."
            defaultValue={toHHMM(profile.night_notification_time, "21:00")}
          />
          <TimeField
            name="sundayTime"
            label="Sunday setup"
            hint="Optional. Ready for Monday?"
            defaultValue={toHHMM(profile.sunday_notification_time, "18:00")}
          />

          <div className="border-t border-black/10 pt-5">
            <label htmlFor="displayName" className="text-sm font-semibold">
              Your community display name
            </label>
            <p className="mt-1 text-xs opacity-60">This does not have to be your real name.</p>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={40}
              defaultValue={profile.display_name}
              className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <p className="border-t border-black/10 pt-4 text-xs leading-relaxed opacity-60">
            Reminder: everything you write in the platform stays private to you. Your company sees
            completion numbers across all staff, nothing more.
          </p>

          {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Finish setup →"}
          </button>
        </form>
      </div>
    </main>
  );
}

function TimeField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-black/10 pb-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs opacity-60">{hint}</p>
      </div>
      <input
        name={name}
        type="time"
        required
        defaultValue={defaultValue}
        className="border border-black/20 bg-transparent px-3 py-2 text-sm font-semibold"
      />
    </div>
  );
}
