import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  if (token) {
    const email = await consumeToken(token, "EMAIL_VERIFY");
    if (email) {
      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });
      ok = true;
    }
  }
  return (
    <div className="space-y-4 text-center">
      {ok ? (
        <p className="text-emerald-300">E-Mail bestätigt. Du kannst dich jetzt anmelden.</p>
      ) : (
        <p className="text-red-300">Link ungültig oder abgelaufen.</p>
      )}
      <Link href="/login" className="text-emerald-400">Zum Login</Link>
    </div>
  );
}
