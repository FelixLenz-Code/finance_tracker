"use client";

import { useTransition } from "react";
import { deletePosition } from "../trades/actions";

export function DeleteEntryButton({
  positionId,
  label,
  legs,
}: {
  positionId: string;
  label: string;
  legs: number;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    const msg =
      legs > 1
        ? `Diese Roll-Kette (${label}, ${legs} Legs) endgültig löschen?\n\nAlle zugehörigen Transaktionen werden entfernt.`
        : `Eintrag „${label}" endgültig löschen?\n\nAlle zugehörigen Transaktionen werden entfernt.`;
    if (!confirm(msg)) return;
    const fd = new FormData();
    fd.set("positionId", positionId);
    start(() => {
      void deletePosition(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-red-900/60 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
    >
      {pending ? "Löschen…" : "Löschen"}
    </button>
  );
}
