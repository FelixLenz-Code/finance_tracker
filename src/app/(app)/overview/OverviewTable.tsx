"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Badge, Button, Input, NumberInput, Label, Select, cn } from "@/components/ui";
import { money, num, fmtDate, pnlClass, statusLabel } from "@/lib/format";
import {
  closePositionAction,
  expireOptionAction,
  assignOptionAction,
  saveTransactionNote,
  undoRollAction,
  reopenOptionAction,
} from "../trades/actions";
import { Modal } from "@/components/Modal";
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
  const [accFilter, setAccFilter] = useState<string>(initialAccount ?? "ALL");
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
  const [editRow, setEditRow] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (accFilter !== "ALL" && r.accountId !== accFilter) return false;
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
  const actionRow = action ? rows.find((r) => r.id === action.id) ?? null : null;

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
          <div className="w-full sm:w-64">
            <Label>Depot</Label>
            <Select value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
              <option value="ALL">Alle Depots</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
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
          Realisierter G&amp;V (gefiltert):{" "}
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
                Real. G&amp;V {sortKey === "realizedPnl" && (sortDir === "asc" ? "▲" : "▼")}
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
                  setAction={(type) => setAction({ id: r.id, type })}
                  onShowNotes={() => setNotesRow(r)}
                  onShowEdit={() => setEditRow(r)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {actionRow && action && (
        <Modal title={actionTitle(actionRow, action.type)} onClose={() => setAction(null)}>
          <ActionPanel r={actionRow} action={action.type} onDone={() => setAction(null)} />
        </Modal>
      )}
      {notesRow && <NotesModal row={notesRow} onClose={() => setNotesRow(null)} />}
      {editRow && <EditModal row={editRow} onClose={() => setEditRow(null)} />}
    </div>
  );
}

function actionTitle(r: Row, action: string): string {
  const sfx = r.kind === "OPTION" ? ` · ${r.symbol} ${r.optionRight ?? ""} ${r.strike ?? ""}`.trimEnd() : ` · ${r.symbol}`;
  const base =
    action === "roll" ? "Option rollen"
    : action === "expire" ? "Verfall buchen"
    : action === "assign" ? "Andienung buchen"
    : r.kind === "STOCK" ? "Position verkaufen"
    : "Position schließen";
  return base + sfx;
}

function EditModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const sfx = row.kind === "OPTION" ? ` ${row.optionRight ?? ""} ${row.strike ?? ""}` : "";
  return (
    <Modal title={`Bearbeiten · ${row.symbol}${sfx}`} onClose={onClose}>
      <EditForm r={row} onSuccess={onClose} />
    </Modal>
  );
}

function NotesModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const sfx = row.kind === "OPTION" ? ` ${row.optionRight ?? ""} ${row.strike ?? ""}` : "";
  return (
    <Modal title={`Notizen · ${row.symbol}${sfx}`} onClose={onClose}>
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
    </Modal>
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
  setAction,
  onShowNotes,
  onShowEdit,
}: {
  r: Row;
  isOpen: boolean;
  isExp: boolean;
  td: string;
  onToggleExpand: () => void;
  setAction: (t: string) => void;
  onShowNotes: () => void;
  onShowEdit: () => void;
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
          <Badge color={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
        </td>
        <td className={cn(td, "font-medium", pnlClass(r.realizedPnl))}>
          {num(r.realizedPnl)} {r.currency}
        </td>
        <td className={td}>{fmtDate(r.openedAt)}</td>
        <td className={td}>
          <div className="flex items-center gap-1">
            {isOpen && (
              <ActBtn
                label={r.kind === "STOCK" ? "Verkaufen" : "Schließen"}
                onClick={() => setAction("close")}
              />
            )}
            <ActionsMenu>
              {(close) => {
                const showRoll = isOpen && r.kind === "OPTION";
                const showEdit = r.status === "OPEN" && r.transactions.length === 1;
                const showUndo = r.isChain && r.status === "OPEN";
                const showReopen =
                  r.kind === "OPTION" && ["CLOSED", "EXPIRED", "ASSIGNED"].includes(r.status);
                const hasAbove = showRoll || showEdit || showUndo || showReopen;
                return (
                  <>
                    {showRoll && (
                      <>
                        <MenuItem label="Rollen" onClick={() => { setAction("roll"); close(); }} />
                        <MenuItem label="Verfall buchen" onClick={() => { setAction("expire"); close(); }} />
                        <MenuItem label="Andienung buchen" onClick={() => { setAction("assign"); close(); }} />
                      </>
                    )}
                    {showEdit && (
                      <MenuItem label="Bearbeiten" onClick={() => { onShowEdit(); close(); }} />
                    )}
                    {showUndo && (
                      <ActionButton
                        action={undoRollAction}
                        positionId={r.id}
                        label="Roll rückgängig"
                        confirmText="Letzten Roll rückgängig machen? Die neue Position wird gelöscht und die vorherige wieder geöffnet."
                        className={MENU_ITEM_CLASS}
                        onSelect={close}
                      />
                    )}
                    {showReopen && (
                      <ActionButton
                        action={reopenOptionAction}
                        positionId={r.id}
                        label="Wieder öffnen"
                        confirmText="Diese Option wieder öffnen? Die Abschluss-Buchung (Schließen/Verfall/Andienung) wird rückgängig gemacht."
                        className={MENU_ITEM_CLASS}
                        onSelect={close}
                      />
                    )}
                    {hasAbove && <div className="my-1 h-px bg-white/5" />}
                    <DeleteEntryButton
                      positionId={r.id}
                      label={`${r.symbol}${r.kind === "OPTION" ? ` ${r.optionRight ?? ""} ${r.strike ?? ""}` : ""}`}
                      legs={r.legs.length}
                      className={cn(MENU_ITEM_CLASS, "text-red-400 hover:bg-red-950/40")}
                      onSelect={close}
                    />
                  </>
                );
              }}
            </ActionsMenu>
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
              <Badge color={statusColor(leg.status)}>{statusLabel(leg.status)}</Badge>
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

const MENU_ITEM_CLASS =
  "block w-full px-3 py-1.5 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50";

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={MENU_ITEM_CLASS}>
      {label}
    </button>
  );
}

/**
 * „⋯"-Menü für Sekundär-Aktionen. Das Panel wird `fixed` an der Triggerposition
 * gerendert, damit es nicht vom `overflow`-Container der Tabelle abgeschnitten wird.
 */
function ActionsMenu({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 176) });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Weitere Aktionen"
        className={cn(
          "rounded border px-2 py-1 text-xs leading-none transition-colors",
          open
            ? "border-zinc-600 bg-zinc-800 text-zinc-100"
            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
        )}
      >
        ⋯
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </>
  );
}

function ActionPanel({ r, action, onDone }: { r: Row; action: string; onDone: () => void }) {
  if (action === "roll" && r.kind === "OPTION") {
    return <RollForm positionId={r.id} currency={r.currency} currentStrike={r.strike} onDone={onDone} />;
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
