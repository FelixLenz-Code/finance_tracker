"use client";

import { useMemo, useState } from "react";
import { Card, Select, Label, Button, InfoTip, Badge, cn } from "@/components/ui";
import { money, num, fmtDate, pnlClass } from "@/lib/format";

export type RealizedItem = {
  realizedAt: string;
  symbol: string;
  kind: "STOCK" | "OPTION";
  accountId: string;
  accountName: string;
  currency: string;
  pnl: number;
};

export type DividendItem = {
  date: string;
  accountId: string;
  accountName: string;
  currency: string;
  amount: number;
  symbol: string | null;
  note: string | null;
};

export type TradeItem = {
  date: string;
  accountId: string;
  accountName: string;
  symbol: string;
  kind: "STOCK" | "OPTION";
  type: string;
  qty: number;
  price: number;
  fees: number;
  currency: string;
  cashFlow: number;
};

export type FxGainItem = {
  date: string;
  accountId: string;
  currency: string; // Basiswährung (Ergebnis-Währung)
  pnl: number;
};

type Account = { id: string; name: string };

const TXN_LABEL: Record<string, string> = {
  BUY: "Kauf",
  SELL: "Verkauf",
  SELL_TO_OPEN: "STO (Prämie)",
  BUY_TO_OPEN: "BTO (Kauf)",
  BUY_TO_CLOSE: "BTC (Rückkauf)",
  SELL_TO_CLOSE: "STC (Verkauf)",
  ASSIGNMENT: "Andienung",
  EXPIRATION: "Verfall",
  DIVIDEND: "Dividende",
  FEE: "Gebühr",
};

const yearOf = (iso: string) => new Date(iso).getFullYear();

type Bucket = { gain: number; loss: number };
const emptyBucket = (): Bucket => ({ gain: 0, loss: 0 });
function add(b: Bucket, v: number) {
  if (v >= 0) b.gain += v;
  else b.loss += v;
}
const net = (b: Bucket) => b.gain + b.loss;

type CcyReport = { currency: string; stock: Bucket; option: Bucket; dividends: number; fx: Bucket };

// Gesamtsumme je Währung über Aktien + Optionen + Dividenden + Währungsgewinne.
type Totals = { gain: number; loss: number; saldo: number };
function totalsOf(rep: CcyReport): Totals {
  return {
    gain: rep.stock.gain + rep.option.gain + Math.max(rep.dividends, 0) + rep.fx.gain,
    loss: rep.stock.loss + rep.option.loss + Math.min(rep.dividends, 0) + rep.fx.loss,
    saldo: net(rep.stock) + net(rep.option) + rep.dividends + net(rep.fx),
  };
}

// Vereinheitlichte Journal-Zeile (Trades + Dividenden).
type JournalRow = {
  date: string;
  account: string;
  symbol: string;
  type: string;
  qty: number | null;
  price: number | null;
  fees: number;
  cashFlow: number;
  currency: string;
};

export function TaxView({
  realized,
  trades,
  dividends,
  fxGains,
  accounts,
}: {
  realized: RealizedItem[];
  trades: TradeItem[];
  dividends: DividendItem[];
  fxGains: FxGainItem[];
  accounts: Account[];
}) {
  const years = useMemo(() => {
    const s = new Set<number>();
    realized.forEach((r) => s.add(yearOf(r.realizedAt)));
    trades.forEach((t) => s.add(yearOf(t.date)));
    dividends.forEach((d) => s.add(yearOf(d.date)));
    fxGains.forEach((f) => s.add(yearOf(f.date)));
    return [...s].sort((a, b) => b - a);
  }, [realized, trades, dividends, fxGains]);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(years.includes(currentYear) ? currentYear : years[0] ?? currentYear);
  const [account, setAccount] = useState<string>("ALL");

  const accOk = (id: string) => account === "ALL" || id === account;
  const accountLabel = account === "ALL" ? "Alle Depots" : accounts.find((a) => a.id === account)?.name ?? "—";

  const realizedYear = useMemo(
    () => realized.filter((r) => yearOf(r.realizedAt) === year && accOk(r.accountId)),
    [realized, year, account],
  );

  // Journal: alle Trades + Dividenden des Jahres/Depots.
  const journal = useMemo<JournalRow[]>(() => {
    const rows: JournalRow[] = [];
    for (const t of trades) {
      if (yearOf(t.date) !== year || !accOk(t.accountId)) continue;
      rows.push({
        date: t.date,
        account: t.accountName,
        symbol: t.symbol,
        type: TXN_LABEL[t.type] ?? t.type,
        qty: t.qty,
        price: t.price,
        fees: t.fees,
        cashFlow: t.cashFlow,
        currency: t.currency,
      });
    }
    for (const d of dividends) {
      if (yearOf(d.date) !== year || !accOk(d.accountId)) continue;
      rows.push({
        date: d.date,
        account: d.accountName,
        symbol: d.symbol ?? d.note ?? "",
        type: "Dividende",
        qty: null,
        price: null,
        fees: 0,
        cashFlow: d.amount,
        currency: d.currency,
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [trades, dividends, year, account]);

  const reports = useMemo<CcyReport[]>(() => {
    const map = new Map<string, CcyReport>();
    const get = (ccy: string) => {
      let r = map.get(ccy);
      if (!r) map.set(ccy, (r = { currency: ccy, stock: emptyBucket(), option: emptyBucket(), dividends: 0, fx: emptyBucket() }));
      return r;
    };
    for (const r of realizedYear) add(r.kind === "STOCK" ? get(r.currency).stock : get(r.currency).option, r.pnl);
    for (const d of dividends) if (yearOf(d.date) === year && accOk(d.accountId)) get(d.currency).dividends += d.amount;
    for (const f of fxGains) if (yearOf(f.date) === year && accOk(f.accountId)) add(get(f.currency).fx, f.pnl);
    return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }, [realizedYear, dividends, fxGains, year, account]);

  function exportCsv() {
    const sep = ";";
    const dec = (n: number | null) => (n == null ? "" : n.toFixed(2).replace(".", ","));
    const esc = (s: string) => {
      // CSV-Injection vermeiden: führende Formelzeichen neutralisieren, damit
      // Excel/LibreOffice den Wert nicht als Formel ausführt (z. B. "=HYPERLINK(…)").
      const v = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const lines: string[] = [];
    // Zusammenfassung mit Gesamtsummen je Währung (oben), dann das Journal.
    lines.push(`Zusammenfassung ${year}${account === "ALL" ? "" : " — " + accountLabel}`);
    lines.push(["Währung", "Kategorie", "Gewinne", "Verluste", "Saldo"].join(sep));
    for (const rep of reports) {
      lines.push([rep.currency, "Aktien", dec(rep.stock.gain), dec(rep.stock.loss), dec(net(rep.stock))].join(sep));
      lines.push([rep.currency, "Optionen / Termingeschäfte", dec(rep.option.gain), dec(rep.option.loss), dec(net(rep.option))].join(sep));
      lines.push([rep.currency, "Dividenden", dec(rep.dividends), "", dec(rep.dividends)].join(sep));
      if (rep.fx.gain !== 0 || rep.fx.loss !== 0) {
        lines.push([rep.currency, "Währungsgewinne", dec(rep.fx.gain), dec(rep.fx.loss), dec(net(rep.fx))].join(sep));
      }
      const t = totalsOf(rep);
      lines.push([rep.currency, "Gesamt", dec(t.gain), dec(t.loss), dec(t.saldo)].join(sep));
    }
    lines.push("");
    lines.push(["Datum", "Konto", "Symbol", "Typ", "Menge", "Kurs", "Gebühren", "Cashflow", "Währung"].join(sep));
    for (const r of journal) {
      lines.push([
        new Date(r.date).toLocaleDateString("de-DE"),
        esc(r.account),
        esc(r.symbol),
        esc(r.type),
        r.qty == null ? "" : String(r.qty).replace(".", ","),
        dec(r.price),
        dec(r.fees),
        dec(r.cashFlow),
        r.currency,
      ].join(sep));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Export-Zeitstempel (lokale Zeit) im Dateinamen: YYYY-MM-DD_HH-MM-SS.
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
    a.download = `steuerreport-${year}${account === "ALL" ? "" : "-" + accountLabel}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const cell = (v: number, ccy: string, tone?: "pos" | "neg" | "div") =>
      `<td class="r ${tone ?? ""}">${esc(money(v, ccy))}</td>`;

    const summary = reports
      .map(
        (rep) => `
      <h3>${esc(rep.currency)} — Zusammenfassung ${year}</h3>
      <table>
        <thead><tr><th>Kategorie</th><th class="r">Gewinne</th><th class="r">Verluste</th><th class="r">Saldo</th></tr></thead>
        <tbody>
          <tr><td>Aktien</td>${cell(rep.stock.gain, rep.currency, "pos")}${cell(rep.stock.loss, rep.currency, "neg")}${cell(net(rep.stock), rep.currency)}</tr>
          <tr><td>Optionen / Termingeschäfte</td>${cell(rep.option.gain, rep.currency, "pos")}${cell(rep.option.loss, rep.currency, "neg")}${cell(net(rep.option), rep.currency)}</tr>
          <tr><td>Dividenden</td>${cell(rep.dividends, rep.currency, "div")}<td class="r">—</td>${cell(rep.dividends, rep.currency, "div")}</tr>
          ${rep.fx.gain !== 0 || rep.fx.loss !== 0 ? `<tr><td>Währungsgewinne</td>${cell(rep.fx.gain, rep.currency, "pos")}${cell(rep.fx.loss, rep.currency, "neg")}${cell(net(rep.fx), rep.currency)}</tr>` : ""}
          <tr class="tot"><td>Gesamt</td>${cell(totalsOf(rep).gain, rep.currency, "pos")}${cell(totalsOf(rep).loss, rep.currency, "neg")}${cell(totalsOf(rep).saldo, rep.currency)}</tr>
        </tbody>
      </table>`,
      )
      .join("");

    const realizedRows = realizedYear
      .map(
        (r) => `<tr>
          <td>${esc(fmtDate(r.realizedAt))}</td>
          <td>${r.kind === "STOCK" ? "Aktie" : "Option"}</td>
          <td>${esc(r.symbol)}</td>
          <td>${esc(r.accountName)}</td>
          ${cell(r.pnl, r.currency, r.pnl >= 0 ? "pos" : "neg")}
        </tr>`,
      )
      .join("");

    const journalRows = journal
      .map(
        (r) => `<tr>
          <td>${esc(fmtDate(r.date))}</td>
          <td>${esc(r.account)}</td>
          <td>${esc(r.symbol)}</td>
          <td>${esc(r.type)}</td>
          <td class="r">${r.qty == null ? "" : esc(num(r.qty, 4))}</td>
          <td class="r">${r.price == null ? "" : esc(money(r.price, r.currency))}</td>
          <td class="r">${esc(money(r.fees, r.currency))}</td>
          ${cell(r.cashFlow, r.currency, r.cashFlow >= 0 ? "pos" : "neg")}
        </tr>`,
      )
      .join("");

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
      <title>Steuerreport ${year}${account === "ALL" ? "" : " - " + esc(accountLabel)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;}
        h1{font-size:20px;margin:0 0 2px;} h3{font-size:13px;margin:22px 0 0;}
        .meta{color:#666;font-size:12px;margin:0 0 8px;}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;}
        th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;}
        th{background:#f3f3f3;} .r{text-align:right;}
        .pos{color:#15803d;} .neg{color:#b91c1c;} .div{color:#1d4ed8;}
        .tot td{font-weight:bold;border-top:2px solid #999;background:#fafafa;}
        .note{color:#666;font-size:11px;margin-top:18px;line-height:1.4;}
        @media print{ body{margin:12mm;} }
      </style></head><body>
      <h1>Steuerreport ${year}</h1>
      <p class="meta">Depot: ${esc(accountLabel)} · Erstellt am ${esc(new Date().toLocaleDateString("de-DE"))}</p>
      ${summary || "<p>Keine Daten.</p>"}
      <h3>Realisierte Positionen ${year}</h3>
      <table>
        <thead><tr><th>Datum</th><th>Art</th><th>Symbol</th><th>Konto</th><th class="r">Realisierter G&amp;V</th></tr></thead>
        <tbody>${realizedRows || '<tr><td colspan="5">—</td></tr>'}</tbody>
      </table>
      <h3>Alle Trades &amp; Dividenden ${year}</h3>
      <table>
        <thead><tr><th>Datum</th><th>Konto</th><th>Symbol</th><th>Typ</th><th class="r">Menge</th><th class="r">Kurs</th><th class="r">Gebühren</th><th class="r">Cashflow</th></tr></thead>
        <tbody>${journalRows || '<tr><td colspan="8">—</td></tr>'}</tbody>
      </table>
      <p class="note">Beträge in der jeweiligen Erfassungswährung (keine FX-Umrechnung). Zuordnung zum Jahr nach
        Schließdatum bzw. letztem schließenden Trade (Realisierte Positionen) bzw. Ausführungsdatum (Alle Trades).
        Aktien und Optionen/Termingeschäfte getrennt ausgewiesen. Keine Steuerberatung — bitte mit den
        Erträgnisaufstellungen des Brokers abgleichen.</p>
      <script>window.onload=function(){window.focus();window.print();};</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Bitte Popups für diese Seite erlauben, um das PDF zu erzeugen.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const th = "px-3 py-2 text-left font-medium text-zinc-400";
  const thr = "px-3 py-2 text-right font-medium text-zinc-400";
  const td = "px-3 py-2";
  const tdr = "px-3 py-2 text-right";

  if (years.length === 0) {
    return (
      <Card>
        <p className="text-zinc-300">Noch keine Trades oder Dividenden erfasst.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-36">
            <Label>Steuerjahr</Label>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Label>Depot</Label>
            <Select value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="ALL">Alle Depots</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={journal.length === 0}>
            CSV exportieren
          </Button>
          <Button type="button" variant="secondary" onClick={printPdf} disabled={journal.length === 0}>
            Als PDF exportieren
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card><p className="text-zinc-400">Keine Daten für {year}.</p></Card>
      ) : (
        reports.map((rep) => (
          <Card key={rep.currency} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge color="blue">{rep.currency}</Badge>
              <h2 className="text-sm font-medium text-zinc-300">Zusammenfassung {year}</h2>
            </div>
            <div className="rounded-lg border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                  <tr>
                    <th className={th}>Kategorie</th>
                    <th className={thr}>Gewinne</th>
                    <th className={thr}>Verluste</th>
                    <th className={thr}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <SummaryRow label="Aktien" b={rep.stock} ccy={rep.currency}
                    info="Realisierter G&V aus Aktienverkäufen (inkl. Gebühren). In DE: Topf „Aktien“." />
                  <SummaryRow label="Optionen / Termingeschäfte" b={rep.option} ccy={rep.currency}
                    info="Realisierter G&V aus Optionen inkl. Stillhalterprämien (inkl. Gebühren). In DE: Termingeschäfte." />
                  <tr className="border-t border-white/5">
                    <td className={cn(td, "font-medium")}>
                      Dividenden
                      <InfoTip text="Im Kontostand als „Dividende“ erfasste Eingänge dieses Jahres." />
                    </td>
                    <td className={cn(tdr, "text-blue-400")}>{money(rep.dividends, rep.currency)}</td>
                    <td className={tdr}>—</td>
                    <td className={cn(tdr, "font-medium text-blue-400")}>{money(rep.dividends, rep.currency)}</td>
                  </tr>
                  {(rep.fx.gain !== 0 || rep.fx.loss !== 0) && (
                    <SummaryRow label="Währungsgewinne" b={rep.fx} ccy={rep.currency}
                      info="Realisierter Gewinn/Verlust aus Währungstausch (Ø-Einstand). In DE: private Veräußerungsgeschäfte (§23), 1-Jahres-Frist beachten." />
                  )}
                  {(() => {
                    const t = totalsOf(rep);
                    return (
                      <tr className="border-t-2 border-white/15 bg-zinc-900/40">
                        <td className={cn(td, "font-semibold")}>Gesamt</td>
                        <td className={cn(tdr, "font-semibold text-emerald-400")}>{money(t.gain, rep.currency)}</td>
                        <td className={cn(tdr, "font-semibold text-red-400")}>{money(t.loss, rep.currency)}</td>
                        <td className={cn(tdr, "font-bold", pnlClass(t.saldo))}>{money(t.saldo, rep.currency)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}

      {/* Realisierte Positionen (steuerliche Basis) */}
      {realizedYear.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Realisierte Positionen {year}</h2>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                <tr>
                  <th className={th}>Datum</th>
                  <th className={th}>Art</th>
                  <th className={th}>Symbol</th>
                  <th className={th}>Konto</th>
                  <th className={thr}>Realisierter G&amp;V</th>
                </tr>
              </thead>
              <tbody>
                {realizedYear.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className={cn(td, "text-zinc-400")}>{fmtDate(r.realizedAt)}</td>
                    <td className={td}>{r.kind === "STOCK" ? "Aktie" : "Option"}</td>
                    <td className={cn(td, "font-medium")}>{r.symbol}</td>
                    <td className={cn(td, "text-zinc-400")}>{r.accountName}</td>
                    <td className={cn(tdr, "font-medium", pnlClass(r.pnl))}>{money(r.pnl, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alle Trades & Dividenden (vollständiges Journal) */}
      <Card>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">Alle Trades &amp; Dividenden {year}</h2>
        {journal.length === 0 ? (
          <p className="text-zinc-400">Keine Trades in {year}.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                <tr>
                  <th className={th}>Datum</th>
                  <th className={th}>Konto</th>
                  <th className={th}>Symbol</th>
                  <th className={th}>Typ</th>
                  <th className={thr}>Menge</th>
                  <th className={thr}>Kurs</th>
                  <th className={thr}>Gebühren</th>
                  <th className={thr}>Cashflow</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className={cn(td, "text-zinc-400")}>{fmtDate(r.date)}</td>
                    <td className={cn(td, "text-zinc-400")}>{r.account}</td>
                    <td className={cn(td, "font-medium")}>{r.symbol || "—"}</td>
                    <td className={td}>
                      {r.type === "Dividende" ? <span className="text-blue-400">Dividende</span> : r.type}
                    </td>
                    <td className={tdr}>{r.qty == null ? "—" : num(r.qty, 4)}</td>
                    <td className={tdr}>{r.price == null ? "—" : money(r.price, r.currency)}</td>
                    <td className={tdr}>{r.fees ? money(r.fees, r.currency) : "—"}</td>
                    <td className={cn(tdr, "font-medium", r.type === "Dividende" ? "text-blue-400" : pnlClass(r.cashFlow))}>
                      {money(r.cashFlow, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-zinc-500">
        Beträge in der jeweiligen <b>Erfassungswährung</b> (keine FX-Umrechnung). „Realisierte Positionen"
        nach Schließdatum, „Alle Trades" nach Ausführungsdatum. Aktien und Optionen/Termingeschäfte sind
        getrennt ausgewiesen (unterschiedliche Verlustverrechnung in DE). <b>Keine Steuerberatung</b> —
        bitte mit den Erträgnisaufstellungen des Brokers abgleichen.
      </p>
    </div>
  );
}

function SummaryRow({ label, b, ccy, info }: { label: string; b: Bucket; ccy: string; info: string }) {
  const td = "px-3 py-2";
  const tdr = "px-3 py-2 text-right";
  return (
    <tr className="border-t border-white/5">
      <td className={cn(td, "font-medium")}>
        {label}
        <InfoTip text={info} />
      </td>
      <td className={cn(tdr, "text-emerald-400")}>{money(b.gain, ccy)}</td>
      <td className={cn(tdr, "text-red-400")}>{money(b.loss, ccy)}</td>
      <td className={cn(tdr, "font-medium", pnlClass(net(b)))}>{money(net(b), ccy)}</td>
    </tr>
  );
}
