import Link from "next/link";
import { ResetForm } from "../forms";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <p className="text-sm text-zinc-400">
        Ungültiger Link.{" "}
        <Link href="/forgot-password" className="text-emerald-400">Neu anfordern</Link>
      </p>
    );
  }
  return <ResetForm token={token} />;
}
