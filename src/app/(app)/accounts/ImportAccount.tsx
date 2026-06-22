"use client";

import { useRef, useState, useTransition } from "react";
import { Button, cn } from "@/components/ui";
import { importAccount } from "./actions";

export function ImportAccount() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await importAccount(fd);
      if (res?.ok) setMsg({ ok: true, text: "Depot importiert ✓" });
      else setMsg({ ok: false, text: res?.error ?? "Import fehlgeschlagen." });
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "Importiere…" : "Depot importieren"}
      </Button>
      {msg && (
        <p className={cn("max-w-xs text-right text-xs", msg.ok ? "text-emerald-400" : "text-red-400")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
