// ─── Reclamos automáticos ────────────────────────────────────────────────────
// Cómo funciona (idea de Juan):
//   1. Cada empresa elige los días del mes en que se reclama (ej. 10 y 25), desde qué atraso y a quién avisar.
//   2. EL DÍA ANTERIOR, a la hora elegida, llega un mail a administración: "mañana se envían N reclamos por $X,
//      dejá cargados los cobros en Colppy". Trae la lista y un botón para PAUSAR ese envío.
//   3. EL DÍA DEL ENVÍO, Numo primero vuelve a traer los datos de Colppy (así no se le reclama a quien pagó anoche)
//      y recién ahí arma y manda los reclamos, con el tono según el atraso y los PDFs de las facturas.
//   4. Al terminar, llega un resumen. Todo queda en el historial y en la ficha de cada cliente.
// Los envíos salen solos salvo que alguien los pause. A un cliente se lo puede excluir desde su ficha.
import { createHmac } from "crypto";
import { db } from "./db";
import { daysLate, isElectronic, todayAR } from "./deuda";
import { deliver, docLabel, mailConfig, renderMail, splitEmails, defaultIntro, defaultSubject, toneFor, type Tone } from "./mail";
import { colppyFor } from "./colppySession";
import { isSyncing, startSync } from "./sync";
import { isDemo } from "./demo";

const DAY = 86_400_000;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dmy = (s: string) => s.split("-").reverse().join("/");
const money = (n: number) => "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WEEK = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const niceDate = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); return `${WEEK[d.getUTCDay()]} ${dmy(iso).slice(0, 5)}`; };

export type Schedule = { enabled: boolean; days: number[]; minLate: number; minAmount: number; cooldown: number; hour: number; notifyTo: string | null; pausedFor: string | null; noticeFor: string | null; sentFor: string | null };
export const DEFAULT_SCHEDULE: Schedule = { enabled: false, days: [10, 25], minLate: 1, minAmount: 0, cooldown: 7, hour: 9, notifyTo: null, pausedFor: null, noticeFor: null, sentFor: null };

export async function getSchedule(companyId: string): Promise<Schedule> {
  const s = await db.claimSchedule.findUnique({ where: { companyId } });
  if (!s) return { ...DEFAULT_SCHEDULE };
  return { enabled: s.enabled, days: (Array.isArray(s.days) ? s.days : []).map(Number).filter((n) => n >= 1 && n <= 31), minLate: s.minLate, minAmount: Number(s.minAmount), cooldown: s.cooldown, hour: s.hour, notifyTo: s.notifyTo, pausedFor: s.pausedFor, noticeFor: s.noticeFor, sentFor: s.sentFor };
}

/** ¿Ese día (YYYY-MM-DD) es día de envío? Un "31" en un mes de 30 días se envía el último día. */
export function isSendDay(iso: string, days: number[]) {
  const d = new Date(`${iso}T12:00:00Z`);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return days.some((x) => Math.min(x, last) === d.getUTCDate());
}
/** Próximo día de envío desde hoy (incluido si todavía no se envió). */
export function nextSendDate(s: Schedule, from = todayAR()) {
  for (let i = 0; i < 70; i++) {
    const iso = ymd(new Date(from.getTime() + i * DAY));
    if (isSendDay(iso, s.days) && s.sentFor !== iso) return iso;
  }
  return null;
}
export const prevDay = (iso: string) => ymd(new Date(new Date(`${iso}T00:00:00Z`).getTime() - DAY));

// ── Link para pausar desde el mail (firmado, sin iniciar sesión) ──
const key = () => process.env.AUTH_SECRET ?? process.env.ENCRYPTION_KEY ?? "dev-secret-cambiar";
export const pauseToken = (companyId: string, date: string) => createHmac("sha256", key()).update(`pausa|${companyId}|${date}`).digest("hex").slice(0, 32);
export const checkPauseToken = (companyId: string, date: string, t: string) => t.length === 32 && pauseToken(companyId, date) === t;
export const appUrl = () => (process.env.APP_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")).replace(/\/$/, "");

// ── A quién se le reclamaría ──
export type Candidate = {
  partyId: string; name: string; email: string | null; excluded: boolean; skipReason: string | null;
  total: number; overdue: number; maxLate: number; tone: Tone; docs: { id: string; label: string; pending: number; late: number; electronic: boolean }[];
  lastClaim: string | null;
};

export async function claimCandidates(companyId: string, s: Schedule): Promise<Candidate[]> {
  const today = todayAR();
  const docs = await db.doc.findMany({ where: { companyId, kind: "venta", OR: [{ pending: { gt: 1 } }, { pending: { lt: -1 } }] }, orderBy: { date: "asc" } });
  const parties = new Map((await db.party.findMany({ where: { companyId, kind: "cliente" } })).map((p) => [p.colppyId, p]));
  const since = new Date(today.getTime() - 120 * DAY);
  const logs = await db.mailLog.findMany({ where: { companyId, kind: "reclamo_cliente", ok: true, sentAt: { gte: since } }, orderBy: { sentAt: "desc" }, select: { partyId: true, sentAt: true } });
  const last = new Map<string, Date>(); for (const l of logs) if (!last.has(l.partyId)) last.set(l.partyId, l.sentAt);

  const by = new Map<string, typeof docs>();
  for (const d of docs) { const a = by.get(d.partyId) ?? []; a.push(d); by.set(d.partyId, a); }
  const out: Candidate[] = [];
  for (const [partyId, list] of by) {
    const p = parties.get(partyId);
    const rows = list.map((d) => ({ id: d.id, label: docLabel(d), pending: Number(d.pending), late: daysLate(d.dueDate, d.date, today), electronic: isElectronic(d) }));
    const total = rows.reduce((a, r) => a + r.pending, 0);
    const overdueRows = rows.filter((r) => r.pending > 0 && r.late >= s.minLate);
    const overdue = overdueRows.reduce((a, r) => a + r.pending, 0);
    if (!overdueRows.length || total <= 1) continue;
    const maxLate = Math.max(...overdueRows.map((r) => r.late));
    const lc = last.get(partyId) ?? null;
    const email = splitEmails(p?.email).join(", ") || null;
    let skipReason: string | null = null;
    if (p && !p.autoClaim) skipReason = "excluido de los reclamos automáticos";
    else if (!email) skipReason = "no tiene mail cargado";
    else if (overdue < s.minAmount) skipReason = `vencido menor a ${money(s.minAmount)}`;
    else if (lc && today.getTime() - lc.getTime() < s.cooldown * DAY) skipReason = `ya se le reclamó el ${dmy(ymd(lc))}`;
    out.push({ partyId, name: p?.name ?? list[0].partyName, email, excluded: !!(p && !p.autoClaim), skipReason, total, overdue, maxLate, tone: toneFor(maxLate), docs: rows.filter((r) => r.pending > 1 || r.pending < -1), lastClaim: lc ? ymd(lc) : null });
  }
  return out.sort((a, b) => b.overdue - a.overdue);
}

// ── Mails a administración ──
function adminMail(title: string, lead: string, rows: string, buttons: string, foot: string, brand: string) {
  return `<!doctype html><html><body style="margin:0;background:#f2f3f7;font-family:Arial,Helvetica,sans-serif;color:#222">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f7;padding:24px 0"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:${brand};padding:18px 24px;color:#fff"><div style="font-size:13px;opacity:.85">Numo · Reclamos automáticos</div><div style="font-size:20px;font-weight:700;margin-top:4px">${title}</div></td></tr>
<tr><td style="padding:22px 24px;font-size:14px;line-height:1.55">${lead}
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:14px 0">${rows}</table>
${buttons}<p style="color:#777;font-size:12px;margin-top:18px">${foot}</p></td></tr></table></td></tr></table></body></html>`;
}
const btn = (href: string, label: string, color: string) => `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:700;margin:4px 8px 4px 0">${label}</a>`;
const TONE_TXT: Record<Tone, string> = { RECORDATORIO: "Recordatorio", D30: "+30 días", D60: "+60 días", D90: "+90 días, aviso de intereses" };

/** Mail del día anterior: qué se va a enviar mañana, con botón para pausar. */
export async function sendNotice(companyId: string, date: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const s = await getSchedule(companyId);
  const to = splitEmails(s.notifyTo);
  const cands = await claimCandidates(companyId, s);
  const go = cands.filter((c) => !c.skipReason), skip = cands.filter((c) => c.skipReason);
  const amount = go.reduce((a, c) => a + c.overdue, 0);
  const cfg = await mailConfig(company.tenantId);
  const base = appUrl();
  const pause = `${base}/api/reclamos/pausa?c=${companyId}&d=${date}&t=${pauseToken(companyId, date)}`;
  const review = `${base}/app/clientes/reclamos?company=${companyId}`;
  const rows = `<tr style="background:#f6f7fb;color:#555;text-align:left"><th style="padding:7px 9px">Cliente</th><th style="padding:7px 9px;text-align:right">Vencido</th><th style="padding:7px 9px">Atraso</th><th style="padding:7px 9px">Tono</th></tr>`
    + go.map((c) => `<tr><td style="padding:7px 9px;border-bottom:1px solid #eee">${c.name}</td><td style="padding:7px 9px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${money(c.overdue)}</td><td style="padding:7px 9px;border-bottom:1px solid #eee">${c.maxLate} días</td><td style="padding:7px 9px;border-bottom:1px solid #eee">${TONE_TXT[c.tone]}</td></tr>`).join("")
    + (skip.length ? `<tr><td colspan="4" style="padding:10px 9px;color:#777;font-size:12px">No se les reclama: ${skip.map((c) => `${c.name} (${c.skipReason})`).join(" · ")}</td></tr>` : "");
  const html = adminMail(
    go.length ? `Mañana se envían ${go.length} reclamos por ${money(amount)}` : "Mañana no hay reclamos para enviar",
    `<p style="margin:0 0 10px">Hola: mañana, <b>${niceDate(date)}</b>, a las ${s.hour} h, Numo envía los reclamos de <b>${company.name}</b>.</p>
     <p style="margin:0 0 10px"><b>Antes de que salgan, dejá cargados en Colppy los cobros que entraron.</b> Mañana, antes de enviar, Numo vuelve a traer los datos y solo le reclama a quien siga debiendo.</p>`,
    go.length ? rows : "", go.length ? btn(pause, "Pausar el envío de mañana", "#B8412C") + btn(review, "Revisar en Numo", cfg?.brandColor ?? "#131c4a") : btn(review, "Ver en Numo", cfg?.brandColor ?? "#131c4a"),
    "Si no hacés nada, los reclamos salen solos. Para excluir a un cliente, entrá a su ficha en Numo y apagá “Reclamos automáticos”.", cfg?.brandColor ?? "#131c4a");
  const text = `Mañana (${niceDate(date)}) Numo envía ${go.length} reclamos por ${money(amount)} de ${company.name}.\nDejá cargados los cobros en Colppy.\n\n${go.map((c) => `${c.name}: ${money(c.overdue)} · ${c.maxLate} días`).join("\n")}\n\nPausar: ${pause}\nRevisar: ${review}`;
  if (!to.length) throw new Error("Falta el mail de aviso en Reclamos automáticos");
  await deliver(company.tenantId, { to, cc: [], subject: go.length ? `Mañana se envían ${go.length} reclamos · ${company.name}` : `Mañana no hay reclamos · ${company.name}`, html, text });
  await db.claimRun.create({ data: { companyId, runDate: date, stage: "aviso", ok: true, sent: go.length, amount, detail: go.map((c) => ({ name: c.name, overdue: c.overdue, late: c.maxLate })) } });
}

async function waitSync(companyId: string, maxMs = 25 * 60_000) {
  const t0 = Date.now();
  while (isSyncing(companyId) && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 5000));
}

/** El envío: actualiza desde Colppy, arma cada reclamo y lo manda. Devuelve el resumen. */
export async function runClaims(companyId: string, date: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  if (isDemo(company)) throw new Error("La empresa demo no envía reclamos");
  // 1) Datos al día
  try { if (!isSyncing(companyId)) await startSync(companyId, "reclamos"); } catch { /* si ya estaba corriendo, se espera */ }
  await waitSync(companyId);
  const last = await db.syncRun.findFirst({ where: { companyId }, orderBy: { startedAt: "desc" } });
  if (last && last.ok === false) throw new Error(`No se pudo actualizar desde Colppy (${last.error ?? "error"}): por seguridad no se envió ningún reclamo`);
  // 2) Reclamos
  const s = await getSchedule(companyId);
  const cands = (await claimCandidates(companyId, s)).filter((c) => !c.skipReason);
  const cfg = await mailConfig(company.tenantId);
  const colppy = await colppyFor(company).catch(() => null);
  const docsAll = await db.doc.findMany({ where: { id: { in: cands.flatMap((c) => c.docs.map((d) => d.id)) } } });
  const byId = new Map(docsAll.map((d) => [d.id, d]));
  const today = todayAR();
  const results: { name: string; to: string; amount: number; ok: boolean; error?: string }[] = [];
  for (const c of cands) {
    const docs = c.docs.map((x) => byId.get(x.id)!).filter(Boolean);
    const mailDocs = docs.map((d) => ({ docType: d.docType, letter: d.letter, number: d.number, date: d.date.toISOString(), dueDate: d.dueDate?.toISOString() ?? null, pending: Number(d.pending), late: daysLate(d.dueDate, d.date, today) }));
    const companyName = cfg?.fromName || company.name;
    const { html, text } = renderMail({ kind: "reclamo_cliente", tone: c.tone, company: companyName, brand: cfg?.brandColor ?? "#131c4a", greeting: c.name, intro: defaultIntro("reclamo_cliente", c.tone), docs: mailDocs, bankInfo: cfg?.bankInfo ?? null, signature: cfg?.signature ?? null });
    const subject = defaultSubject("reclamo_cliente", c.tone, companyName, c.name);
    const attachments: { filename: string; content: Buffer }[] = [];
    if (colppy) for (const d of docs) if (Number(d.pending) > 0 && isElectronic(d)) { try { attachments.push({ filename: docLabel(d).replace(/\s+/g, "_") + ".pdf", content: await colppy.pdf(d.colppyId) }); } catch { /* sin PDF, igual sale */ } }
    const to = splitEmails(c.email), cc = splitEmails(cfg?.ccDefault);
    const log = { companyId, kind: "reclamo_cliente", partyId: c.partyId, partyName: c.name, to: to.join(", "), cc: cc.join(", ") || null, subject, tone: c.tone, amount: c.total, docs: docs.map((d) => d.id), sentBy: "Numo · reclamo automático" };
    try {
      await deliver(company.tenantId, { to, cc, subject, html, text, attachments });
      await db.mailLog.create({ data: { ...log, ok: true } });
      results.push({ name: c.name, to: to.join(", "), amount: c.overdue, ok: true });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.mailLog.create({ data: { ...log, ok: false, error } });
      results.push({ name: c.name, to: to.join(", "), amount: c.overdue, ok: false, error });
    }
    await new Promise((r) => setTimeout(r, 1500)); // de a uno, para no saturar la casilla
  }
  const sent = results.filter((r) => r.ok), failed = results.filter((r) => !r.ok);
  const amount = sent.reduce((a, r) => a + r.amount, 0);
  await db.claimRun.create({ data: { companyId, runDate: date, stage: "envio", ok: failed.length === 0, sent: sent.length, failed: failed.length, amount, detail: results } });
  // 3) Resumen a administración
  const notify = splitEmails(s.notifyTo);
  if (notify.length) {
    const rows = results.map((r) => `<tr><td style="padding:7px 9px;border-bottom:1px solid #eee">${r.ok ? "✓" : "✗"} ${r.name}</td><td style="padding:7px 9px;border-bottom:1px solid #eee">${r.to}</td><td style="padding:7px 9px;border-bottom:1px solid #eee;text-align:right">${money(r.amount)}</td></tr>${r.error ? `<tr><td colspan="3" style="padding:0 9px 8px;color:#B8412C;font-size:12px">${r.error}</td></tr>` : ""}`).join("");
    const html = adminMail(`Se enviaron ${sent.length} reclamos por ${money(amount)}`, `<p style="margin:0">Reclamos de <b>${company.name}</b> del ${niceDate(date)}.${failed.length ? ` <b style="color:#B8412C">${failed.length} no se pudieron enviar.</b>` : ""}</p>`, rows, btn(`${appUrl()}/app/clientes/reclamos?company=${companyId}`, "Ver en Numo", cfg?.brandColor ?? "#131c4a"), "Cada reclamo quedó registrado en la ficha del cliente.", cfg?.brandColor ?? "#131c4a");
    await deliver(company.tenantId, { to: notify, cc: [], subject: `Reclamos enviados: ${sent.length} · ${company.name}`, html, text: results.map((r) => `${r.ok ? "OK" : "ERROR"} ${r.name} ${money(r.amount)} ${r.error ?? ""}`).join("\n") }).catch(() => null);
  }
  return { sent: sent.length, failed: failed.length, amount };
}

// ── El reloj: cada 10 minutos revisa si hay avisos o envíos pendientes ──
let ticking = false;
export async function claimsTick(now = new Date()) {
  if (ticking) return;
  ticking = true;
  try {
    const ar = new Date(now.getTime() - 3 * 3_600_000);
    const today = ymd(ar), hour = ar.getUTCHours(), tomorrow = ymd(new Date(ar.getTime() + DAY));
    const schedules = await db.claimSchedule.findMany({ where: { enabled: true } });
    for (const sc of schedules) {
      const s = await getSchedule(sc.companyId);
      if (hour < s.hour) continue;
      try {
        // Aviso del día anterior
        if (isSendDay(tomorrow, s.days) && s.noticeFor !== tomorrow) {
          await db.claimSchedule.update({ where: { companyId: sc.companyId }, data: { noticeFor: tomorrow } });
          await sendNotice(sc.companyId, tomorrow).catch((e) => db.claimRun.create({ data: { companyId: sc.companyId, runDate: tomorrow, stage: "aviso", ok: false, error: e instanceof Error ? e.message : String(e) } }));
        }
        // Envío
        if (isSendDay(today, s.days) && s.sentFor !== today) {
          await db.claimSchedule.update({ where: { companyId: sc.companyId }, data: { sentFor: today } });
          if (s.pausedFor === today) { await db.claimRun.create({ data: { companyId: sc.companyId, runDate: today, stage: "pausa", ok: true, error: "Envío pausado: no se mandó ningún reclamo" } }); continue; }
          await runClaims(sc.companyId, today).catch((e) => db.claimRun.create({ data: { companyId: sc.companyId, runDate: today, stage: "envio", ok: false, error: e instanceof Error ? e.message : String(e) } }));
        }
      } catch (e) { console.error("[reclamos]", sc.companyId, e); }
    }
  } finally { ticking = false; }
}
