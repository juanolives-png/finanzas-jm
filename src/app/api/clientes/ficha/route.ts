// Ficha completa de un cliente: datos, cómo está hoy, qué compra, cómo paga, reclamos, notas y reclamo automático.
// GET ?company=ID&party=COLPPY_ID · POST { company, party, action: "note" | "delnote" | "auto" | "email", ... }
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { customerAnalytics } from "@/lib/clientes";
import { daysLate, isElectronic, todayAR } from "@/lib/deuda";
import { docLabel, splitEmails } from "@/lib/mail";
import { getSchedule, nextSendDate, claimCandidates } from "@/lib/claims";
import { profileFor } from "@/lib/demoRubros";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company"), party = u.searchParams.get("party");
    if (!id || !party) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    const today = todayAR();
    const p = await db.party.findUnique({ where: { companyId_kind_colppyId: { companyId: company.id, kind: "cliente", colppyId: party } } });
    const docs = await db.doc.findMany({ where: { companyId: company.id, kind: "venta", partyId: party }, orderBy: { date: "desc" } });
    if (!p && !docs.length) throw new HttpError(404, "No encontramos ese cliente");
    const an = customerAnalytics(docs.map((d) => ({ kind: d.kind, partyId: d.partyId, partyName: d.partyName, docType: d.docType, date: d.date, dueDate: d.dueDate, total: Number(d.total), pending: Number(d.pending), paidAt: d.paidAt })), today, 90);
    const row = an.clients[0] ?? null;
    const mails = await db.mailLog.findMany({ where: { companyId: company.id, partyId: party, kind: "reclamo_cliente" }, orderBy: { sentAt: "desc" }, take: 20 });
    const notes = await db.partyNote.findMany({ where: { companyId: company.id, kind: "cliente", partyId: party }, orderBy: { createdAt: "desc" }, take: 50 });
    // Ventas por mes (12 meses)
    const months: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      months.push({ month: m, total: docs.filter((d) => d.date.toISOString().slice(0, 7) === m).reduce((a, d) => a + Number(d.total), 0) });
    }
    const pending = docs.filter((d) => Number(d.pending) > 1 || Number(d.pending) < -1).sort((a, b) => a.date.getTime() - b.date.getTime());
    const status = !row ? "sin compras" : row.daysSince >= 90 ? "perdido" : an.atRisk.length ? "en riesgo" : "activo";
    // Próximo reclamo automático y si este cliente entra
    const sc = await getSchedule(company.id);
    const next = sc.enabled ? nextSendDate(sc) : null;
    const cand = sc.enabled ? (await claimCandidates(company.id, sc)).find((c) => c.partyId === party) ?? null : null;
    return Response.json({
      company: { id: company.id, name: company.name, rubro: company.source === "demo" ? profileFor(company.demoRubro).key : null },
      party: {
        id: party, name: p?.name ?? docs[0]?.partyName ?? party, alias: p?.alias ?? null, cuit: p?.cuit ?? null, email: p?.email ?? null, emailManual: p?.emailManual ?? false,
        phone: p?.phone ?? null, address: [p?.address, p?.city, p?.province].filter(Boolean).join(", ") || null, ivaCondition: p?.ivaCondition ?? null, autoClaim: p?.autoClaim ?? true,
      },
      status,
      kpis: {
        balance: pending.reduce((a, d) => a + Number(d.pending), 0),
        overdue: pending.filter((d) => Number(d.pending) > 0 && daysLate(d.dueDate, d.date, today) > 0).reduce((a, d) => a + Number(d.pending), 0),
        maxLate: Math.max(0, ...pending.filter((d) => Number(d.pending) > 0).map((d) => daysLate(d.dueDate, d.date, today))),
        revenue12: row?.revenue12 ?? 0, invoices12: docs.filter((d) => d.date >= new Date(today.getTime() - 365 * 86_400_000) && d.docType !== "NCV").length,
        first: row?.first ?? null, last: row?.last ?? null, daysSince: row?.daysSince ?? null, interval: row?.interval ?? null,
        realDays: row?.realDays ?? null, agreedDays: row?.agreedDays ?? null, lateDays: row?.lateDays ?? null,
        avgTicket: (() => { const f = docs.filter((d) => d.docType === "FAV" && d.date >= new Date(today.getTime() - 365 * 86_400_000)); return f.length ? f.reduce((a, d) => a + Number(d.total), 0) / f.length : 0; })(),
      },
      months,
      pending: pending.map((d) => ({ id: d.id, label: docLabel(d), date: d.date.toISOString().slice(0, 10), dueDate: d.dueDate?.toISOString().slice(0, 10) ?? null, total: Number(d.total), pending: Number(d.pending), late: daysLate(d.dueDate, d.date, today), electronic: isElectronic(d) })),
      recent: docs.slice(0, 15).map((d) => ({ id: d.id, label: docLabel(d), date: d.date.toISOString().slice(0, 10), total: Number(d.total), pending: Number(d.pending), paidAt: d.paidAt?.toISOString().slice(0, 10) ?? null, description: d.description, electronic: isElectronic(d) })),
      claims: mails.map((m) => ({ at: m.sentAt.toISOString(), tone: m.tone, to: m.to, amount: Number(m.amount), ok: m.ok, error: m.error, auto: m.sentBy.startsWith("Numo") })),
      notes: notes.map((n) => ({ id: n.id, text: n.text, author: n.author, at: n.createdAt.toISOString() })),
      auto: { enabled: sc.enabled, next, willClaim: !!cand && !cand.skipReason, reason: cand?.skipReason ?? (sc.enabled && !cand ? "no tiene facturas vencidas" : null) },
    });
  } catch (e) { return errorResponse(e); }
}

const Body = z.object({
  company: z.string(), party: z.string(),
  action: z.enum(["note", "delnote", "auto", "email"]),
  text: z.string().max(2000).optional(), noteId: z.string().optional(), value: z.boolean().optional(), email: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new HttpError(400, "Datos inválidos");
    const b = p.data;
    const company = await getCompany(s, b.company);
    const where = { companyId_kind_colppyId: { companyId: company.id, kind: "cliente", colppyId: b.party } };
    const name = (await db.doc.findFirst({ where: { companyId: company.id, partyId: b.party }, select: { partyName: true } }))?.partyName ?? b.party;
    if (b.action === "note") {
      const text = (b.text ?? "").trim();
      if (!text) throw new HttpError(400, "Escribí la nota");
      await db.partyNote.create({ data: { companyId: company.id, kind: "cliente", partyId: b.party, text, author: s.name } });
    }
    if (b.action === "delnote" && b.noteId) await db.partyNote.deleteMany({ where: { id: b.noteId, companyId: company.id } });
    if (b.action === "auto") await db.party.upsert({ where, create: { companyId: company.id, kind: "cliente", colppyId: b.party, name, autoClaim: !!b.value }, update: { autoClaim: !!b.value } });
    if (b.action === "email") {
      const clean = splitEmails(b.email).join(", ") || null;
      if (b.email && !clean) throw new HttpError(400, "Ese mail no parece válido");
      await db.party.upsert({ where, create: { companyId: company.id, kind: "cliente", colppyId: b.party, name, email: clean, emailManual: true }, update: { email: clean, emailManual: true } });
    }
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
