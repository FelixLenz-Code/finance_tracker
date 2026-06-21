import { ForgotForm } from "../forms";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Wir senden dir einen Link zum Zurücksetzen.
      </p>
      <ForgotForm />
    </div>
  );
}
