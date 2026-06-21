"use client";

import { useTransition } from "react";
import { deleteCashTransaction } from "./actions";

export function DeleteCashButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Buchung löschen?")) return;
        const fd = new FormData();
        fd.set("id", id);
        start(() => {
          void deleteCashTransaction(fd);
        });
      }}
      className="text-xs text-zinc-500 transition-colors hover:text-red-400 disabled:opacity-50"
    >
      löschen
    </button>
  );
}
