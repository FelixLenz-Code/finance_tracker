import { requireUser } from "@/lib/auth";
import { twelveDataKeySource, openFigiKeySource, backupStatus, smtpStatus, reminderStatus, isRegistrationEnabled } from "@/lib/settings";
import { mailConfigured } from "@/lib/mail";
import { Card, Badge } from "@/components/ui";
import { TwoFactor } from "./TwoFactor";
import { ApiKeyField } from "./ApiKeyField";
import { BackupSettings } from "./BackupSettings";
import { SmtpSettings } from "./SmtpSettings";
import { ReminderSettings } from "./ReminderSettings";
import { MyReminderSettings } from "./MyReminderSettings";
import { RegistrationSettings } from "./RegistrationSettings";
import {
  saveTwelveDataKey,
  removeTwelveDataKey,
  saveOpenFigiKey,
  removeOpenFigiKey,
  saveBackupConfig,
  removeBackupConfig,
  runBackupNow,
  regenerateBackupToken,
  downloadRcloneConf,
  saveSmtpConfig,
  removeSmtpConfig,
  sendTestMail,
  saveReminderPrefs,
  regenerateReminderToken,
  runRemindersNow,
  setRegistration,
} from "./actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const tdSource = isAdmin ? await twelveDataKeySource() : null;
  const ofSource = isAdmin ? await openFigiKeySource() : null;
  const backup = isAdmin ? await backupStatus() : null;
  const smtp = isAdmin ? await smtpStatus() : null;
  const reminder = isAdmin ? await reminderStatus() : null;
  const registrationOpen = isAdmin ? await isRegistrationEnabled() : false;
  const mailOk = await mailConfigured();
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

      <Card>
        <h2 className="mb-1 text-lg font-medium">Erinnerungen</h2>
        <p className="mb-3 text-sm text-zinc-500">
          E-Mail- und Push-Erinnerung für deine offenen Optionen, die bald verfallen.
        </p>
        <MyReminderSettings
          initial={{
            enabled: user.remindersEnabled,
            days: user.reminderDays,
            hour: user.reminderHour,
            pushEnabled: user.pushEnabled,
          }}
          mailConfigured={mailOk}
          saveAction={saveReminderPrefs}
        />
      </Card>

      {isAdmin && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">Registrierung (Admin)</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Steuert, ob sich neue Nutzer eigenständig ein Konto anlegen können.
          </p>
          <RegistrationSettings initialEnabled={registrationOpen} saveAction={setRegistration} />
        </Card>
      )}

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

      {isAdmin && smtp && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">E-Mail-Server — SMTP</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Für E-Mail-Verifizierung, Passwort-Reset und Erinnerungen.
          </p>
          <SmtpSettings
            status={smtp}
            saveAction={saveSmtpConfig}
            removeAction={removeSmtpConfig}
            testAction={sendTestMail}
          />
        </Card>
      )}

      {isAdmin && reminder && smtp && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">Optionsablauf-Erinnerungen (Admin)</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Sammel-Versand & externe Auslösung. Frist/Uhrzeit stellt jede:r Nutzer:in selbst ein.
          </p>
          <ReminderSettings
            hasToken={reminder.hasToken}
            smtpConfigured={smtp.configured}
            tokenAction={regenerateReminderToken}
            runAction={runRemindersNow}
          />
        </Card>
      )}

      {isAdmin && backup && (
        <Card>
          <h2 className="mb-1 text-lg font-medium">Offsite-Backup — rclone</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Verschlüsseltes Backup der Datenbank an einen rclone-Speicher (S3, Backblaze,
            WebDAV, …).
          </p>
          <BackupSettings
            status={backup}
            saveAction={saveBackupConfig}
            removeAction={removeBackupConfig}
            runAction={runBackupNow}
            tokenAction={regenerateBackupToken}
            downloadAction={downloadRcloneConf}
          />
        </Card>
      )}
    </div>
  );
}
