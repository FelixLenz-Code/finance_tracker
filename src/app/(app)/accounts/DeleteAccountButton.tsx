"use client";

import { useTransition } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccountButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    // Drei Sicherheitsabfragen vor dem unwiderruflichen Löschen.
    if (!confirm(`Depot „${name}" löschen?\n\nAlle zugehörigen Positionen und Transaktionen werden mitgelöscht.`)) return;
    if (!confirm("Bist du wirklich sicher? Dieser Schritt kann NICHT rückgängig gemacht werden.")) return;
    if (!confirm(`Letzte Bestätigung: „${name}" jetzt endgültig löschen?`)) return;

    const fd = new FormData();
    fd.set("id", id);
    start(() => {
      void deleteAccount(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-sm text-zinc-500 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? "Löschen…" : "Löschen"}
    </button>
  );
}
