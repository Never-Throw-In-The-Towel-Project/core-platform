"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { completeStaffOnboarding } from "@/lib/actions/onboarding";
import { setPassword, type SetPasswordState } from "@/lib/actions/auth";
import { initialRoutineState } from "@/lib/actions/routineState";
import { AskForSupport } from "@/components/AskForSupport";
import type { Profile } from "@/types/database";

const TOTAL_STEPS = 3;

/**
 * First-run for HR (`hr_admin`) and NTITT (`ntitt_admin`) admins. They're invited
 * to run a company or the Control Tower, so this is a short, role-appropriate
 * orientation -- welcome + the privacy boundary from the *steward's* side, an
 * optional password (they arrive by magic link), and a display name -- not the
 * member routine-reminder flow. Finishing lands them on /workspace or /admin via
 * role-aware landing. The member OnboardingFlow is left untouched.
 *
 * Reuses the shared `setPassword` action (same as the member flow) and matches
 * the member flow's visual language (progress bar, brand-accent frames), so the
 * two feel like one product.
 */
export function StaffOnboarding({
  profile,
  companyName,
  helplineNumber,
}: {
  profile: Profile;
  companyName: string;
  helplineNumber: string;
}) {
  const [step, setStep] = useState(1);
  const isHr = profile.role === "hr_admin";

  let content: React.ReactNode;
  if (step === 1) {
    content = <WelcomeStep isHr={isHr} companyName={companyName} onContinue={() => setStep(2)} />;
  } else if (step === 2) {
    content = <PasswordStep onContinue={() => setStep(3)} />;
  } else {
    content = <FinishStep profile={profile} isHr={isHr} />;
  }

  return (
    <>
      {content}
      <AskForSupport helplineNumber={helplineNumber} variant="inline" />
    </>
  );
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex h-1">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => (
        <div key={index} className={`flex-1 ${index < step ? "bg-brand-accent" : "bg-foreground/15"}`} />
      ))}
    </div>
  );
}

function WelcomeStep({
  isHr,
  companyName,
  onContinue,
}: {
  isHr: boolean;
  companyName: string;
  onContinue: () => void;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <ProgressBar step={1} />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-10">
        <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={56} height={57} />
        <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Step 1 of 3</p>
        <h1 className="mt-3 text-3xl leading-tight font-extrabold uppercase">
          {isHr ? `Welcome to ${companyName} Workspace` : "Welcome to NTITT Admin"}
        </h1>
        {isHr ? (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Your Workspace is where you run your company&apos;s wellbeing programme — invite staff,
              set up step challenges, and see how engagement is going.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              You see <span className="font-semibold">aggregate numbers only</span> — never an
              individual&apos;s routines, check-ins or answers. That privacy line is the whole point,
              and it works in your favour too: no one can ask you to breach it.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              The Control Tower is where you curate content, run the challenge programmes, moderate
              the community, and manage partner companies.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Members&apos; private wellbeing data is never yours to read — the platform keeps that
              boundary for you.
            </p>
          </>
        )}
        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={onContinue}
            className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}

const initialSetPasswordState: SetPasswordState = { status: "idle" };

/**
 * Optional password. Invited admins are provisioned by magic link (see
 * lib/actions/auth.ts), so this just adds a faster sign-in next time; "Skip for
 * now" keeps the magic-link path. Same shared `setPassword` action as the member
 * flow's step, re-presented for the 3-step staff frame.
 */
function PasswordStep({ onContinue }: { onContinue: () => void }) {
  const [state, formAction, isPending] = useActionState(setPassword, initialSetPasswordState);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <ProgressBar step={2} />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Step 2 of 3</p>
        <h1 className="mt-3 text-3xl font-extrabold uppercase">Set a password</h1>
        <p className="mt-2 text-sm text-muted">
          Optional. Add one so you can sign in without waiting on an email link next time.
        </p>

        {state.status === "success" ? (
          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-sm font-semibold text-foreground">Password set.</p>
            <button
              type="button"
              onClick={onContinue}
              className="mt-auto w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground"
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
                className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
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
                className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
              />
            </label>

            {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Set password"}
              </button>
              <button type="button" onClick={onContinue} className="text-sm text-muted underline">
                Skip for now
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

/**
 * completeStaffOnboarding redirects itself on success (to /workspace or /admin
 * via role-aware landing), so this only ever needs to render the error case.
 */
function FinishStep({ profile, isHr }: { profile: Profile; isHr: boolean }) {
  const [state, formAction, isPending] = useActionState(completeStaffOnboarding, initialRoutineState);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <ProgressBar step={3} />
      <div className="mx-auto w-full max-w-sm flex-1 px-6 py-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Step 3 of 3</p>
        <h1 className="mt-3 text-3xl font-extrabold uppercase">Your display name</h1>
        <p className="mt-2 text-sm text-muted">
          How you appear if you post in the community. It doesn&apos;t have to be your real name.
        </p>

        <form action={formAction} className="mt-6 space-y-5">
          <div>
            <label htmlFor="displayName" className="text-sm font-semibold">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={40}
              defaultValue={profile.display_name}
              className="mt-2 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Saving…" : isHr ? "Go to Workspace →" : "Go to Admin →"}
          </button>
        </form>
      </div>
    </main>
  );
}
