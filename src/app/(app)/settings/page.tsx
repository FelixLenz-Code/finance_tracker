import { requireUser } from "@/lib/auth";
import { Card, Badge } from "@/components/ui";
import { TwoFactor } from "./TwoFactor";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Profil</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-400">Name</dt>
            <dd>{user.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">E-Mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">Rolle</dt>
            <dd>
              <Badge color={user.role === "ADMIN" ? "blue" : "zinc"}>{user.role}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Zwei-Faktor-Authentifizierung</h2>
        <TwoFactor enabled={user.totpEnabled} />
      </Card>
    </div>
  );
}
