import Image from "next/image";
import { SetNewPasswordForm } from "@/components/auth/SetNewPasswordForm";

/**
 * The recovery landing: a member who clicked a "reset your password" email link
 * arrives here already signed in via the recovery session (verified at
 * /auth/confirm, type=recovery), and sets a new password. Gated by the proxy
 * like any other authed route, so only a verified recovery/active session
 * reaches it; setPassword itself also re-checks the session.
 */
export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={65} />
      <h1 className="text-3xl font-extrabold tracking-tight">Set a new password</h1>
      <div className="w-full max-w-sm">
        <SetNewPasswordForm
          helpText="Choose a new password for signing in."
          submitLabel="Update password"
          redirectTo="/home"
        />
      </div>
    </main>
  );
}
