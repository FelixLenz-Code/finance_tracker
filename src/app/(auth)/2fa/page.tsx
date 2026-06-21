import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TotpForm } from "../forms";

export default async function TwoFactorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.pending2fa) redirect("/");
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Gib den Code aus deiner Authenticator-App ein.
      </p>
      <TotpForm />
    </div>
  );
}
