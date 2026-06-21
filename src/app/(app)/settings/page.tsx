import { requireUser } from "@/lib/auth";
import { twelveDataKeySource, openFigiKeySource } from "@/lib/settings";
import { Card, Badge } from "@/components/ui";
import { TwoFactor } from "./TwoFactor";
import { ApiKeyField } from "./ApiKeyField";
import {
  saveTwelveDataKey,
  removeTwelveDataKey,
  saveOpenFigiKey,
  removeOpenFigiKey,
} from "./actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const tdSource = isAdmin ? await twelveDataKeySource() : null;
  const ofSource = isAdmin ? await openFigiKeySource() : null;
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

      {isAdmin && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">Marktdaten — Twelve Data</h2>
          <p className="mb-3 text-sm text-zinc-500">
            API-Key für das Ticker-Auto-Fill (Symbol/Name/ISIN).
          </p>
          <ApiKeyField
            source={tdSource}
            saveAction={saveTwelveDataKey}
            removeAction={removeTwelveDataKey}
            inputLabel="Twelve-Data-API-Key"
            helpUrl="https://twelvedata.com/"
            helpText="Für die Ticker-Suche."
          />
        </Card>
      )}

      {isAdmin && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">WKN-Auflösung — OpenFIGI</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Optional. WKN-Suche funktioniert auch ohne Key — ein Key erhöht nur das
            Rate-Limit.
          </p>
          <ApiKeyField
            source={ofSource}
            saveAction={saveOpenFigiKey}
            removeAction={removeOpenFigiKey}
            inputLabel="OpenFIGI-API-Key"
            helpUrl="https://www.openfigi.com/api"
            helpText="Optional, erhöht das Rate-Limit der WKN-Auflösung."
          />
        </Card>
      )}
    </div>
  );
}
