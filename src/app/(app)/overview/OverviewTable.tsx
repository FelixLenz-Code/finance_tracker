"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Input, NumberInput, Label, Select, cn } from "@/components/ui";
import { money, num, fmtDate, pnlClass } from "@/lib/format";
import {
  closePositionAction,
  expireOptionAction,
  assignOptionAction,
  saveTransactionNote,
  undoRollAction,
  reopenOptionAction,
} from "../trades/actions";
import { RollForm } from "./RollForm";
import { EditForm } from "./EditForm";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { ActionButton } from "./ActionButton";
import type { Row } from "./types";

type Account = { id: string; name: string };
type SortKey = "openedAt" | "symbol" | "realizedPnl";

const today = () => new Date().toISOString().slice(0, 10);
const OPEN_STATES = new Set(["OPEN"]);

function optionLabel(r: Row | { optionRight: string | null; strike: number | null; expiry: string | null; direction: string }) {
  if (!r.optionRight) return r.direction === "LONG" ? "Long" : "Short";
  return `${r.direction === "SHORT" ? "Short" : "Long"} ${r.optionRight} ${r.strike ?? ""} @ ${r.expiry ? fmtDate(r.expiry) : "—"}`;
}

export function OverviewTable({
  rows,
  accounts,
  initialAccount,
}: {
  rows: Row[];
  accounts: Account[];
  initialAccount?: string;
}) {
  const [accFilter, setAccFilter] = useState<Set<string>>(
    new Set(initialAccount ? [initialAccount] : []),
  );
  const [kind, setKind] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [right, setRight] = useState("ALL");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("openedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<{ id: string; type: string } | null>(null);
  const [notesRow, setNotesRow] = useState<Row | null>(null);

  function toggleAcc(id: string) {
    setAccFilter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (accFilter.size > 0 && !accFilter.has(r.accountId)) return false;
      if (kind !== "ALL" && r.kind !== kind) return false;
      if (status !== "ALL" && r.status !== status) return false;
      if (right !== "ALL" && r.optionRight !== right) return false;
      if (q && !`${r.symbol} ${r.name}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (from && new Date(r.openedAt) < new Date(from)) return false;
      if (to && new Date(r.openedAt) > new Date(to + "T23:59:59")) return false;
      return true;
    });
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "openedAt") cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
      else if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else cmp = a.realizedPnl - b.realizedPnl;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, accFilter, kind, status, right, q, from, to, sortKey, sortDir]);

  const totalRealized = filtered.reduce((s, r) => s + r.realizedPnl, 0);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const th = "px-3 py-2 text-left font-medium text-zinc-400";
  const td = "px-3 py-2 align-top";

  return (
    <div className="space-y-4">
      {/* Filterleiste */}
      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400">Konten:</span>
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAcc(a.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  accFilter.has(a.id)
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                )}
              >
                {a.name}
              </button>
            ))}
            {accFilter.size > 0 && (
              <button
                onClick={() => setAccFilter(new Set())}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                alle
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div>
            <Label>Art</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="ALL">Alle</option>
              <option value="STOCK">Aktien</option>
              <option value="OPTION">Optionen</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Alle</option>
              <option value="OPEN">Offen</option>
              <option value="CLOSED">Geschlossen</option>
              <option value="ROLLED">Gerollt</option>
              <option value="EXPIRED">Verfallen</option>
              <option value="ASSIGNED">Angedient</option>
            </Select>
          </div>
          <div>
            <Label>Call/Put</Label>
            <Select value={right} onChange={(e) => setRight(e.target.value)}>
              <option value="ALL">Alle</option>
              <option value="CALL">Call</option>
              <option value="PUT">Put</option>
            </Select>
          </div>
          <div>
            <Label>Suche</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol/Name" />
          </div>
          <div>
            <Label>Von</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Bis</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{filtered.length} Einträge</span>
        <span>
          Realisierter P&amp;L (gefiltert):{" "}
          <span className={cn("font-semibold", pnlClass(totalRealized))}>
            {num(totalRealized)}
          </span>
        </span>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/60">
            <tr>
              <th className={th}></th>
              <th className={th}>Konto</th>
              <th className={cn(th, "cursor-pointer")} onClick={() => sortBy("symbol")}>
                Instrument {sortKey === "symbol" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th className={th}>Details</th>
              <th className={th}>Menge</th>
              <th className={th}>Ø Preis</th>
              <th className={th}>Status</th>
              <th className={cn(th, "cursor-pointer")} onClick={() => sortBy("realizedPnl")}>
                Real. P&amp;L {sortKey === "realizedPnl" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th className={cn(th, "cursor-pointer")} onClick={() => sortBy("openedAt")}>
                Eröffnet {sortKey === "openedAt" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th className={th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={10}>
                  Keine Einträge. Erfasse deinen ersten Trade.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isOpen = OPEN_STATES.has(r.status);
              const isExp = expanded.has(r.id);
              return (
                <FragmentRow
                  key={r.id}
                  r={r}
                  isOpen={isOpen}
                  isExp={isExp}
                  td={td}
                  onToggleExpand={() =>
                    setExpanded((p) => {
                      const n = new Set(p);
                      if (n.has(r.id)) n.delete(r.id);
                      else n.add(r.id);
                      return n;
                    })
                  }
                  action={action?.id === r.id ? action.type : null}
                  setAction={(type) =>
                    setAction((cur) => (cur?.id === r.id && cur.type === type ? null : { id: r.id, type }))
                  }
                  clearAction={() => setAction(null)}
                  onShowNotes={() => setNotesRow(r)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {notesRow && <NotesModal row={notesRow} onClose={() => setNotesRow(null)} />}
    </div>
  );
}

function NotesModal({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">
            Notizen · {row.symbol}
            {row.kind === "OPTION" ? ` ${row.optionRight ?? ""} ${row.strike ?? ""}` : ""}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100" aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          {row.transactions.map((t) => (
            <NoteEditor
              key={t.id}
              txnId={t.id}
              initial={t.note ?? ""}
              label={`${txnLabel(t.type)} · ${fmtDate(t.tradeDate)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ txnId, initial, label }: { txnId: string; initial: string; label: string }) {
  const [val, setVal] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = val !== initial;

  function save() {
    start(async () => {
      await saveTransactionNote(txnId, val);
      setSaved(true);
    });
  }

  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/50 p-3">
      <p className="mb-1.5 flex items-center gap-2 text-xs text-zinc-500">
        <Badge color="zinc">{label}</Badge>
      </p>
      <textarea
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          setSaved(false);
        }}
        rows={2}
        placeholder="Notiz…"
        className="w-full resize-y rounded-md border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={save} disabled={pending || !dirty}>
          {pending ? "Speichern…" : "Speichern"}
        </Button>
        {saved && !dirty && <span className="text-xs text-emerald-400">gespeichert ✓</span>}
      </div>
    </div>
  );
}

function statusColor(s: string): "green" | "zinc" | "amber" | "blue" | "red" {
  if (s === "OPEN") return "green";
  if (s === "ROLLED") return "blue";
  if (s === "ASSIGNED") return "amber";
  if (s === "EXPIRED") return "zinc";
  return "zinc";
}

function FragmentRow({
  r,
  isOpen,
  isExp,
  td,
  onToggleExpand,
  action,
  setAction,
  clearAction,
  onShowNotes,
}: {
  r: Row;
  isOpen: boolean;
  isExp: boolean;
  td: string;
  onToggleExpand: () => void;
  action: string | null;
  setAction: (t: string) => void;
  clearAction: () => void;
  onShowNotes: () => void;
}) {
  return (
    <>
      <tr className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
        <td className={td}>
          <button onClick={onToggleExpand} className="text-zinc-400 hover:text-zinc-100" title="Details ein-/ausklappen">
            {isExp ? "▼" : "▶"}
          </button>
        </td>
        <td className={td}>{r.accountName}</td>
        <td className={td}>
          <div className="flex items-center gap-1.5 font-medium">
            {r.symbol}
            {r.hasNotes && (
              <button
                type="button"
                onClick={onShowNotes}
                title="Notizen anzeigen"
                aria-label="Notizen anzeigen"
                className="text-amber-400/80 transition-colors hover:text-amber-300"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M9 13h6M9 17h4" />
                </svg>
              </button>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            {r.exchange} {r.isChain && <Badge color="blue">Roll-Kette · {r.legs.length}</Badge>}
          </div>
        </td>
        <td className={td}>
          {r.kind === "OPTION"
            ? optionLabel(r)
            : r.direction === "SHORT"
              ? "Aktie einzeln (Short)"
              : "Aktie einzeln"}
        </td>
        <td className={td}>{num(r.qty, 4)}</td>
        <td className={td}>{money(r.avgOpenPrice, r.currency)}</td>
        <td className={td}>
          <Badge color={statusColor(r.status)}>{r.status}</Badge>
        </td>
        <td className={cn(td, "font-medium", pnlClass(r.realizedPnl))}>
          {num(r.realizedPnl)} {r.currency}
        </td>
        <td className={td}>{fmtDate(r.openedAt)}</td>
        <td className={td}>
          <div className="flex flex-wrap gap-1">
            {isOpen && (
              <>
                <ActBtn
                  label={r.kind === "STOCK" ? "Verkaufen" : "Schließen"}
                  onClick={() => setAction("close")}
                />
                {r.kind === "OPTION" && <ActBtn label="Rollen" onClick={() => setAction("roll")} />}
                {r.kind === "OPTION" && <ActBtn label="Verfall" onClick={() => setAction("expire")} />}
                {r.kind === "OPTION" && <ActBtn label="Andienung" onClick={() => setAction("assign")} />}
              </>
            )}
            {r.status === "OPEN" && r.transactions.length === 1 && (
              <ActBtn label="Bearbeiten" onClick={() => setAction("edit")} />
            )}
            {r.isChain && r.status === "OPEN" && (
              <ActionButton
                action={undoRollAction}
                positionId={r.id}
                label="Roll rückgängig"
                confirmText="Letzten Roll rückgängig machen? Die neue Position wird gelöscht und die vorherige wieder geöffnet."
              />
            )}
            {r.kind === "OPTION" && ["CLOSED", "EXPIRED", "ASSIGNED"].includes(r.status) && (
              <ActionButton
                action={reopenOptionAction}
                positionId={r.id}
                label="Wieder öffnen"
                confirmText="Diese Option wieder öffnen? Die Abschluss-Buchung (Schließen/Verfall/Andienung) wird rückgängig gemacht."
              />
            )}
            <DeleteEntryButton
              positionId={r.id}
              label={`${r.symbol}${r.kind === "OPTION" ? ` ${r.optionRight ?? ""} ${r.strike ?? ""}` : ""}`}
              legs={r.legs.length}
            />
          </div>
        </td>
      </tr>

      {/* Roll-Kette (Legs) */}
      {isExp &&
        r.isChain &&
        r.legs.map((leg) => (
          <tr key={leg.id} className="border-b border-zinc-800/40 bg-zinc-950/40 text-xs">
            <td className={td}></td>
            <td className={td}></td>
            <td className={cn(td, "text-zinc-500")}>↳ Leg</td>
            <td className={cn(td, "text-zinc-400")}>{optionLabel(leg)}</td>
            <td className={cn(td, "text-zinc-400")}>{num(leg.qty, 4)}</td>
            <td className={cn(td, "text-zinc-400")}>{money(leg.avgOpenPrice, r.currency)}</td>
            <td className={td}>
              <Badge color={statusColor(leg.status)}>{leg.status}</Badge>
            </td>
            <td className={cn(td, pnlClass(leg.realizedPnl))}>{num(leg.realizedPnl)}</td>
            <td className={cn(td, "text-zinc-400")}>{fmtDate(leg.openedAt)}</td>
            <td className={td}></td>
          </tr>
        ))}

      {/* Transaktions-Historie inkl. Notizen */}
      {isExp && (
        <tr className="border-b border-zinc-800 bg-zinc-950/40">
          <td className={td}></td>
          <td className={td} colSpan={9}>
            <div className="py-1">
              <p className="mb-1 text-xs font-medium text-zinc-400">Transaktionen</p>
              <div className="space-y-1">
                {r.transactions.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-zinc-500">{fmtDate(t.tradeDate)}</span>
                    <Badge color="zinc">{txnLabel(t.type)}</Badge>
                    <span className="text-zinc-400">
                      {num(t.qty, 4)} × {money(t.price, t.currency)}
                      {t.fees ? ` · Geb. ${money(t.fees, t.currency)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Aktionspanel */}
      {action && (
        <tr className="border-b border-zinc-800 bg-zinc-950/60">
          <td className={td}></td>
          <td className={td} colSpan={9}>
            <ActionPanel r={r} action={action} onDone={clearAction} />
          </td>
        </tr>
      )}
    </>
  );
}

function txnLabel(type: string): string {
  const map: Record<string, string> = {
    BUY: "Kauf",
    SELL: "Verkauf",
    SELL_TO_OPEN: "STO (Short eröffnet)",
    BUY_TO_OPEN: "BTO (Long eröffnet)",
    BUY_TO_CLOSE: "BTC (Short geschlossen)",
    SELL_TO_CLOSE: "STC (Long geschlossen)",
    ASSIGNMENT: "Andienung",
    EXPIRATION: "Verfall",
    DIVIDEND: "Dividende",
    FEE: "Gebühr",
  };
  return map[type] ?? type;
}

function ActBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

function ActionPanel({ r, action, onDone }: { r: Row; action: string; onDone: () => void }) {
  if (action === "edit") {
    return <EditForm r={r} />;
  }
  if (action === "roll" && r.kind === "OPTION") {
    return <RollForm positionId={r.id} currency={r.currency} currentStrike={r.strike} />;
  }
  if (action === "close") {
    const isStock = r.kind === "STOCK";
    return (
      <form action={closePositionAction} onSubmit={onDone} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="positionId" value={r.id} />
        {isStock && (
          <Field label="Anzahl">
            <div className="w-28">
              <NumberInput name="qty" unit="Stück" defaultValue={num(r.qty, 4)} />
            </div>
          </Field>
        )}
        <Field label={isStock ? "Verkaufskurs je Stück" : "Schluss-Prämie"}>
          <div className="w-36">
            <NumberInput name="price" unit={r.currency} required />
          </div>
        </Field>
        <Field label="Gebühren">
          <div className="w-28">
            <NumberInput name="fees" unit={r.currency} defaultValue="0" />
          </div>
        </Field>
        <Field label="Datum">
          <Input name="tradeDate" type="date" defaultValue={today()} />
        </Field>
        <Button type="submit" variant="secondary">{isStock ? "Verkaufen" : "Schließen"}</Button>
      </form>
    );
  }
  if (action === "expire") {
    return (
      <form action={expireOptionAction} onSubmit={onDone} className="flex items-end gap-3">
        <input type="hidden" name="positionId" value={r.id} />
        <Field label="Datum">
          <Input name="tradeDate" type="date" defaultValue={r.expiry?.slice(0, 10) ?? today()} />
        </Field>
        <Button type="submit" variant="secondary">Als verfallen buchen</Button>
      </form>
    );
  }
  if (action === "assign") {
    return (
      <form action={assignOptionAction} onSubmit={onDone} className="flex items-end gap-3">
        <input type="hidden" name="positionId" value={r.id} />
        <Field label="Datum">
          <Input name="tradeDate" type="date" defaultValue={r.expiry?.slice(0, 10) ?? today()} />
        </Field>
        <Button type="submit" variant="secondary">Andienung buchen</Button>
      </form>
    );
  }
  return null;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
