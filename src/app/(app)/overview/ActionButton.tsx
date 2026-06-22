"use client";

import { useTransition } from "react";

/** Kleiner Button, der eine Server-Action (void) mit Rückfrage ausführt. */
export function ActionButton({
  action,
  positionId,
  label,
  confirmText,
  className,
  onSelect,
}: {
  action: (formData: FormData) => Promise<void>;
  positionId: string;
  label: string;
  confirmText: string;
  className?: string;
  /** Wird beim Klick ausgelöst (z. B. um ein umgebendes Menü zu schließen). */
  onSelect?: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        onSelect?.();
        if (!confirm(confirmText)) return;
        const fd = new FormData();
        fd.set("positionId", positionId);
        start(() => {
          void action(fd);
        });
      }}
      className={
        className ??
        "rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
