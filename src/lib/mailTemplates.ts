// ─── Mails: reclamo a clientes, orden de pago y reclamo a proveedores ────────
// El diseño y los tonos vienen del reclamo de deuda de Infocampo (siempre amable; más directo cuanto más atraso).
// Tablas y estilos en línea para que se vea bien en Gmail y Outlook.
// Este archivo no toca el servidor: lo usa también la pantalla para la vista previa de asunto y texto.

export type MailKind = "reclamo_cliente" | "orden_pago" | "reclamo_proveedor";
export type Tone = "RECORDATORIO" | "D30" | "D60" | "D90";
export const TONE_LABEL: Record<Tone, string> = {
  RECORDATORIO: "Recordatorio amable", D30: "Atrasada (+30 días)", D60: "Más firme (+60 días)", D90: "Aviso de intereses (+90 días)",
};
export const toneFor = (maxLate: number): Tone => (maxLate > 90 ? "D90" : maxLate > 60 ? "D60" : maxLate > 30 ? "D30" : "RECORDATORIO");

export type MailDoc = { docType: string; letter: string | null; number: string; date: string; dueDate: string | null; pending: number; late: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) => "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const docLabel = (d: { docType: string; letter: string | null; number: string }) =>
  `${d.docType.replace(/^FA[VC]/, "FC").replace(/^ND[VC]/, "ND").replace(/^NC[VC]/, "NC")}${d.letter ? `-${d.letter}` : ""} ${d.number}`;
const endOfMonth = () => { const t = new Date(Date.now() - 3 * 3_600_000); return dmy(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).toISOString()); };

export function defaultIntro(kind: MailKind, tone: Tone | null, payDate?: string | null) {
  if (kind === "orden_pago") {
    return `Les informamos que el ${dmy(payDate ?? null)} les transferimos el pago de los comprobantes detallados abajo.\nCualquier diferencia o comprobante faltante, por favor respondan este correo.`;
  }
  if (kind === "reclamo_proveedor") {
    return "Les escribimos por los comprobantes detallados abajo.\nLes pedimos por favor revisarlos y enviarnos la nota de crédito / factura corregida que corresponda.\n¡Muchas gracias!";
  }
  switch (tone) {
    case "D30": return "Le escribimos para recordarle que los siguientes comprobantes se encuentran vencidos. Le agradeceremos regularizar el saldo en los próximos días o, si hubiera algún inconveniente, avisarnos respondiendo este correo.\nSi ya realizó el pago recientemente, por favor ignore este mensaje.";
    case "D60": return "Nos comunicamos nuevamente porque los siguientes comprobantes registran más de 60 días de atraso. Le pedimos que nos indique a la brevedad la fecha prevista de pago, así podemos mantener la cuenta al día.\nQuedamos a disposición para cualquier consulta.";
    case "D90": return `Nos comunicamos porque los siguientes comprobantes registran más de 90 días de atraso y, pese a nuestros recordatorios anteriores, el saldo continúa pendiente.\nLe informamos que, de no estar cancelada la deuda antes del ${endOfMonth()}, nos veremos obligados a aplicar intereses por falta de pago sobre los importes vencidos.\nValoramos mucho la relación: si necesitan acordar un plan de pago, respondan este correo y lo coordinamos.`;
    default: return "Le informamos que registra los siguientes comprobantes con saldo pendiente de pago.\nSi ya realizó el pago recientemente, por favor ignore este mensaje.";
  }
}

export function defaultSubject(kind: MailKind, tone: Tone | null, company: string, party: string) {
  if (kind === "orden_pago") return `${company} — Aviso de pago · ${party}`;
  if (kind === "reclamo_proveedor") return `${company} — Consulta por comprobantes · ${party}`;
  return {
    RECORDATORIO: `${company} — Resumen de cuenta · ${party}`, D30: `${company} — Recordatorio de pago · ${party}`,
    D60: `${company} — Saldo vencido · ${party}`, D90: `${company} — Aviso de deuda vencida · ${party}`,
  }[tone ?? "RECORDATORIO"];
}

const HEAD_SUB: Record<string, string> = {
  reclamo_cliente: "Gestión de cuentas corrientes", orden_pago: "Aviso de pago", reclamo_proveedor: "Consulta por comprobantes",
};
const STRIP: Partial<Record<Tone, string>> = { D60: "#d9a21e", D90: "#d9541e" };

export type RenderInput = {
  kind: MailKind; tone: Tone | null; company: string; brand: string; greeting: string; intro: string;
  docs: MailDoc[]; bankInfo: string | null; signature: string | null; payDate?: string | null; payAmount?: number | null;
};

export function renderMail(m: RenderInput) {
  const total = m.docs.reduce((a, d) => a + d.pending, 0);
  const isClaim = m.kind === "reclamo_cliente";
  const strip = isClaim && m.tone ? STRIP[m.tone] : undefined;
  const p = (t: string) => t.split(/\n+/).filter(Boolean).map((x) => `<p style="margin:0 0 12px">${esc(x)}</p>`).join("");
  const rows = m.docs.map((d) => {
    const venc = isClaim && d.late > 0 && d.pending > 0;
    const state = m.kind === "orden_pago" ? "A pagar" : d.pending < 0 ? "A favor" : venc ? "VENCIDA" : "Pendiente";
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eceef3">${esc(docLabel(d))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eceef3">${dmy(d.date)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eceef3">${dmy(d.dueDate)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eceef3;text-align:right;white-space:nowrap">${money(d.pending)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eceef3;color:${venc ? "#c0392b" : "#555"};font-weight:${venc ? 700 : 400}">${state}</td>
    </tr>`;
  }).join("");
  const totalLabel = m.kind === "orden_pago" ? "Total del pago" : "Saldo total";
  const shownTotal = m.kind === "orden_pago" && m.payAmount ? m.payAmount : total;
  const bank = isClaim && m.bankInfo ? `
    <div style="margin-top:18px;padding:14px 16px;background:#f6f7fb;border-radius:8px">
      <div style="font-weight:700;margin-bottom:6px">Datos para transferir</div>
      ${m.bankInfo.split(/\n/).map((l) => `<div>${esc(l)}</div>`).join("")}
    </div>` : "";
  const paid = isClaim ? `<p style="margin:18px 0 0;color:#666;font-size:13px">Si ya realizó el pago, le pedimos que nos envíe el comprobante respondiendo este correo para imputarlo.</p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f2f3f7;font-family:Arial,Helvetica,sans-serif;color:#222">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f7;padding:24px 0"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:10px;overflow:hidden">
  <tr><td style="background:${esc(m.brand)};padding:20px 24px;color:#fff">
    <div style="font-size:20px;font-weight:700">${esc(m.company)}</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px">${HEAD_SUB[m.kind]}</div>
  </td></tr>
  ${strip ? `<tr><td style="background:${strip};height:4px"></td></tr>` : ""}
  <tr><td style="padding:24px;font-size:14px;line-height:1.55">
    <p style="margin:0 0 12px">Hola ${esc(m.greeting)}:</p>
    ${p(m.intro)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-top:8px">
      <tr style="background:#f6f7fb;color:#555;text-align:left">
        <th style="padding:8px 10px">Comprobante</th><th style="padding:8px 10px">Fecha</th><th style="padding:8px 10px">Vencimiento</th>
        <th style="padding:8px 10px;text-align:right">${m.kind === "orden_pago" ? "Importe" : "Saldo"}</th><th style="padding:8px 10px">Estado</th>
      </tr>
      ${rows}
      <tr><td colspan="3" style="padding:10px;font-weight:700">${totalLabel}</td><td style="padding:10px;text-align:right;font-weight:700;white-space:nowrap">${money(shownTotal)}</td><td></td></tr>
    </table>
    ${bank}${paid}
    ${m.signature ? `<div style="margin-top:22px;color:#444">${m.signature.split(/\n/).map((l) => esc(l)).join("<br>")}</div>` : ""}
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = `Hola ${m.greeting}:\n\n${m.intro}\n\n${m.docs.map((d) => `${docLabel(d)} · ${dmy(d.date)} · vence ${dmy(d.dueDate)} · ${money(d.pending)}`).join("\n")}\n\n${totalLabel}: ${money(shownTotal)}\n${isClaim && m.bankInfo ? `\nDatos para transferir:\n${m.bankInfo}\n` : ""}${m.signature ? `\n${m.signature}` : ""}`;
  return { html, text };
}


export const splitEmails = (s: string | null | undefined) => String(s ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
