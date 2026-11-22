// Arma (preview) y manda los mails de deuda: reclamo a cliente, orden de pago y reclamo a proveedor.
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { daysLate, docKind, partyKind, isElectronic } from "@/lib/deuda";
import { deliver, docLabel, mailConfig, renderMail, splitEmails, type Tone } from "@/lib/mail";
import { colppyFor } from "@/lib/colppySession";

const Body = z.object({
  company: z.string(),
  kind: z.enum(["reclamo_cliente", "orden_pago", "reclamo_proveedor"]),
  party: z.string(),
  docIds: z.array(z.string()).min(1, "Elegí al menos un comprobante"),
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().min(1),
  greeting: z.string().min(1),
  intro: z.string().min(1),
  tone: z.enum(["RECORDATORIO", "D30", "D60", "D90"]).nullable().optional(),
  payDate: z.string().nullable().optional(),
  payAmount: z.number().nullable().optional(),
  preview: z.boolean().optional(),
  attachPdfs: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Datos inválidos");
    const b = p.data;
    const company = await getCompany(s, b.company);
    const debtKind = b.kind === "reclamo_cliente" ? "clientes" : "proveedores";
    const docs = await db.doc.findMany({ where: { companyId: company.id, kind: docKind(debtKind), partyId: b.party, id: { in: b.docIds } }, orderBy: { date: "asc" } });
    if (!docs.length) throw new HttpError(400, "No encontré los comprobantes");
    const cfg = await mailConfig(s.tenantId);
    const mailDocs = docs.map((d) => ({
      docType: d.docType, letter: d.letter, number: d.number, date: d.date.toISOString(), dueDate: d.dueDate?.toISOString() ?? null,
      pending: Number(d.pending), late: daysLate(d.dueDate, d.date),
    }));
    const { html, text } = renderMail({
      kind: b.kind, tone: (b.tone ?? null) as Tone | null, company: cfg?.fromName || company.name, brand: cfg?.brandColor ?? "#131c4a",
      greeting: b.greeting, intro: b.intro, docs: mailDocs, bankInfo: cfg?.bankInfo ?? null, signature: cfg?.signature ?? null,
      payDate: b.payDate, payAmount: b.payAmount,
    });
    if (b.preview) return Response.json({ html, configured: !!(cfg?.smtpUser && cfg.smtpPassEnc) });
    if (isDemo(company)) throw new HttpError(400, "En la empresa demo no se mandan mails: es para mirar cómo quedaría. Con tu Colppy conectado, sale de verdad.");

    const to = splitEmails(b.to);
    const cc = splitEmails([b.cc, cfg?.ccDefault].filter(Boolean).join(","));
    if (!to.length) throw new HttpError(400, "Falta el mail del destinatario");
    const amount = b.payAmount ?? mailDocs.reduce((a, d) => a + d.pending, 0);
    const party = await db.party.findUnique({ where: { companyId_kind_colppyId: { companyId: company.id, kind: partyKind(debtKind), colppyId: b.party } } });
    const log = { companyId: company.id, kind: b.kind, partyId: b.party, partyName: party?.name ?? docs[0].partyName, to: to.join(", "), cc: cc.join(", ") || null, subject: b.subject, tone: b.tone ?? null, amount, docs: docs.map((d) => d.id), sentBy: s.email };
    // PDFs de las facturas (sólo ventas electrónicas; las que Colppy no genera se mandan sin PDF)
    const attachments: { filename: string; content: Buffer }[] = [];
    const sinPdf: string[] = [];
    if (b.attachPdfs && b.kind === "reclamo_cliente") {
      const c = await colppyFor(company).catch(() => null);
      for (const d of docs) {
        if (!c || !isElectronic(d)) { sinPdf.push(docLabel(d)); continue; } // X / I: no es electrónica, Colppy no tiene PDF
        try { attachments.push({ filename: docLabel(d).replace(/\s+/g, "_") + ".pdf", content: await c.pdf(d.colppyId) }); }
        catch { sinPdf.push(docLabel(d)); }
      }
    }
    try {
      await deliver(s.tenantId, { to, cc, subject: b.subject, html, text, attachments });
      await db.mailLog.create({ data: { ...log, ok: true } });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.mailLog.create({ data: { ...log, ok: false, error } });
      throw new HttpError(502, `No se pudo enviar: ${error}`);
    }
    // Si no tenía mail guardado, queda el que se usó
    if (party && !party.email) await db.party.update({ where: { id: party.id }, data: { email: to.join(", "), emailManual: true } });
    return Response.json({ ok: true, adjuntos: attachments.length, sinPdf });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
