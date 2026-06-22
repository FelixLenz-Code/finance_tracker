"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { TradeForm } from "./new/TradeForm";

type Account = { id: string; name: string; baseCurrency: string };

const BTN =
  "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 transition-all hover:from-emerald-400 hover:to-emerald-500";

export function NewTradeButton({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);

  if (accounts.length === 0) {
    return (
      <Link href="/accounts" className={BTN}>
        + Depot anlegen
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={BTN} onClick={() => setOpen(true)}>
        + Trade erfassen
      </button>
      {open && (
        <Modal title="Trade erfassen" size="lg" onClose={() => setOpen(false)}>
          <TradeForm accounts={accounts} onSuccess={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
