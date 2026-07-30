import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <LoginForm />
    </main>
  );
}
