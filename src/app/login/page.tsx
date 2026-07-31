import Image from "next/image";
import { LoginForm } from "./LoginForm";
import logoMark from "../../../public/logo-mark.png";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Image src={logoMark} alt="Never Throw In The Towel" width={64} height={65} />
      <h1 className="text-2xl font-bold">Sign in</h1>
      <LoginForm next={next} />
    </main>
  );
}
