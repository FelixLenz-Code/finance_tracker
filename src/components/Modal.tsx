"use client";

import { useEffect } from "react";
import { cn } from "@/components/ui";

/** Zentriertes Popup mit Abdunklung. Schließt per ✕, Klick außerhalb oder Escape. */
export function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const max = size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-sm" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl",
          max,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 transition-colors hover:text-zinc-100"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
