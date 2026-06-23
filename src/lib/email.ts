import "server-only";

/** HTML-Sonderzeichen escapen — für Nutzerinhalte (Name, Symbol, Depotname …) in Mails. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

type EmailOptions = {
  /** Überschrift in der Karte. */
  heading: string;
  /** Vorab-Text (Preheader), erscheint in der Inbox-Vorschau. */
  preheader?: string;
  /** Hauptinhalt als bereits sicheres HTML (Absätze etc.). */
  bodyHtml: string;
  /** Optionaler Call-to-Action-Button. */
  button?: { label: string; url: string };
  /** Fußnote unter dem Button (z. B. Fallback-Link-Hinweis). */
  footnote?: string;
};

/** Ein „bulletproof" Button (Tabelle + Inline-Styles) für E-Mail-Clients. */
function buttonHtml(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;">
    <tr><td style="border-radius:10px;background:#10b981;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font:600 15px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** Hilfsabsatz im App-Stil (für Aufrufer). */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font:400 15px/1.65 ${FONT};color:#d4d4d8;">${html}</p>`;
}

/**
 * Rahmen-Template im App-Design (dunkel, Emerald-Akzent). bodyHtml muss bereits
 * sicheres HTML sein (Nutzerwerte vorher mit escapeHtml() behandeln).
 */
export function renderEmail(opts: EmailOptions): string {
  const { heading, preheader, bodyHtml, button, footnote } = opts;
  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0c;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0c;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td style="padding:4px 6px 18px;">
          <span style="font:700 19px ${FONT};color:#e4e4e7;letter-spacing:-0.2px;">Trade <span style="color:#10b981;">Tracker</span></span>
        </td></tr>
        <tr><td style="background-color:#18181b;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:30px 28px;">
          <h1 style="margin:0 0 16px;font:600 21px ${FONT};color:#f4f4f5;">${escapeHtml(heading)}</h1>
          ${bodyHtml}
          ${button ? buttonHtml(button.label, button.url) : ""}
          ${footnote ? `<p style="margin:18px 0 0;font:400 13px/1.6 ${FONT};color:#71717a;">${footnote}</p>` : ""}
        </td></tr>
        <tr><td style="padding:18px 6px 4px;font:400 12px/1.6 ${FONT};color:#52525b;">
          Automatische Nachricht vom Trade Tracker. Bitte nicht direkt auf diese E-Mail antworten.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
