import Image from "next/image";
import Link from "next/link";
import { PreAuthSupport } from "@/components/PreAuthSupport";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

/**
 * Public "Forgot password?" entry. Sends a branded recovery email; the link in
 * it lands on /auth/confirm (type=recovery) and on to /reset-password. The
 * request action is anti-enumeration (same response whether or not the email
 * has an account), so this page is safe to expose while logged out.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={65} />
      <h1 className="text-3xl font-extrabold tracking-tight">Reset your password</h1>
      <p className="max-w-sm text-center text-sm text-muted">
        Enter your email and we’ll send you a link to set a new password.
      </p>
      <ForgotPasswordForm />
      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold underline underline-offset-2 hover:text-foreground">
          Back to sign in
        </Link>
      </p>
      <PreAuthSupport />
    </main>
  );
}
