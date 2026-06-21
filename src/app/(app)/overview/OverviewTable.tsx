"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Input, Label, Select, cn } from "@/components/ui";
import { money, num, fmtDate, pnlClass } from "@/lib/format";
import {
  closePositionAction,
  expireOptionAction,
  assignOptionAction,
} from "../trades/actions";
import { RollForm } from "./RollForm";
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
                />
              );
            })}
          </tbody>
        </table>
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
}: {
  r: Row;
  isOpen: boolean;
  isExp: boolean;
  td: string;
  onToggleExpand: () => void;
  action: string | null;
  setAction: (t: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
        <td className={td}>
          {r.isChain && (
            <button onClick={onToggleExpand} className="text-zinc-400 hover:text-zinc-100">
              {isExp ? "▼" : "▶"}
            </button>
          )}
        </td>
        <td className={td}>{r.accountName}</td>
        <td className={td}>
          <div className="font-medium">{r.symbol}</div>
          <div className="text-xs text-zinc-500">
            {r.exchange} {r.isChain && <Badge color="blue">Roll-Kette · {r.legs.length}</Badge>}
          </div>
        </td>
        <td className={td}>
          {r.kind === "OPTION" ? optionLabel(r) : r.direction === "LONG" ? "Long" : "Short"}
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
          {isOpen ? (
            <div className="flex flex-wrap gap-1">
              <ActBtn label="Schließen" onClick={() => setAction("close")} />
              {r.kind === "OPTION" && <ActBtn label="Rollen" onClick={() => setAction("roll")} />}
              {r.kind === "OPTION" && <ActBtn label="Verfall" onClick={() => setAction("expire")} />}
              {r.kind === "OPTION" && <ActBtn label="Andienung" onClick={() => setAction("assign")} />}
            </div>
          ) : (
            <span className="text-xs text-zinc-600">—</span>
          )}
        </td>
      </tr>

      {/* Roll-Kette */}
      {isExp &&
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

      {/* Aktionspanel */}
      {action && (
        <tr className="border-b border-zinc-800 bg-zinc-950/60">
          <td className={td}></td>
          <td className={td} colSpan={9}>
            <ActionPanel r={r} action={action} />
          </td>
        </tr>
      )}
    </>
  );
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

function ActionPanel({ r, action }: { r: Row; action: string }) {
  if (action === "roll" && r.kind === "OPTION") {
    return <RollForm positionId={r.id} currency={r.currency} currentStrike={r.strike} />;
  }
  if (action === "close") {
    return (
      <form action={closePositionAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="positionId" value={r.id} />
        {r.kind === "STOCK" && (
          <Field label="Menge">
            <Input name="qty" defaultValue={num(r.qty, 4)} className="w-28" />
          </Field>
        )}
        <Field label={r.kind === "OPTION" ? "Schluss-Prämie" : "Preis"}>
          <Input name="price" inputMode="decimal" className="w-28" required />
        </Field>
        <Field label="Gebühren">
          <Input name="fees" defaultValue="0" className="w-24" />
        </Field>
        <Field label="Datum">
          <Input name="tradeDate" type="date" defaultValue={today()} />
        </Field>
        <Button type="submit" variant="secondary">Schließen</Button>
      </form>
    );
  }
  if (action === "expire") {
    return (
      <form action={expireOptionAction} className="flex items-end gap-3">
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
      <form action={assignOptionAction} className="flex items-end gap-3">
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
