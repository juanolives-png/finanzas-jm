// Reclamos automáticos de una empresa: configuración, próximo envío, a quién se le reclamaría hoy e historial.
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { claimCandidates, getSchedule, nextSendDate, prevDay, sendNotice } from "@/lib/claims";
import { mailConfig, splitEmails } from "@/lib/mail";
import { isDemo } from "@/lib/demo";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const sc = await getSchedule(company.id);
    const next = nextSendDate(sc);
    const cfg = await mailConfig(s.tenantId);
    const runs = await db.claimRun.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 15 });
    return Response.json({
      company: { id: company.id, name: company.name, demo: isDemo(company) },
      schedule: sc, next, noticeDate: next ? prevDay(next) : null, paused: !!next && sc.pausedFor === next,
      mailReady: !!(cfg?.smtpUser && cfg.smtpPassEnc), defaultNotify: cfg?.replyTo || cfg?.smtpUser || s.email,
      candidates: await claimCandidates(company.id, sc),
      runs: runs.map((r) => ({ at: r.createdAt.toISOString(), runDate: r.runDate, stage: r.stage, ok: r.ok, sent: r.sent, failed: r.failed, amount: Number(r.amount), error: r.error })),
    });
  } catch (e) { return errorResponse(e); }
}

const Body = z.object({
  company: z.string(),
  action: z.enum(["save", "pause", "resume", "test"]),
  enabled: z.boolean().optional(),
  days: z.array(z.number().int().min(1).max(31)).max(8).optional(),
  minLate: z.number().int().min(0).max(365).optional(),
  minAmount: z.number().min(0).optional(),
  cooldown: z.number().int().min(0).max(60).optional(),
  hour: z.number().int().min(6).max(20).optional(),
  notifyTo: z.string().max(400).optional(),
  party: z.string().optional(), autoClaim: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Datos inválidos");
    const b = p.data;
    const company = await getCompany(s, b.company);
    const sc = await getSchedule(company.id);
    if (b.action === "save") {
      if (b.party !== undefined && b.autoClaim !== undefined) {
        await db.party.updateMany({ where: { companyId: company.id, kind: "cliente", colppyId: b.party }, data: { autoClaim: b.autoClaim } });
        return Response.json({ ok: true });
      }
      const notify = b.notifyTo !== undefined ? splitEmails(b.notifyTo).join(", ") : sc.notifyTo;
      if (b.enabled && !notify) throw new HttpError(400, "Poné al menos un mail para el aviso del día anterior");
      if (b.enabled && isDemo(company)) throw new HttpError(400, "En la empresa demo no se envían reclamos de verdad");
      const days = b.days ? [...new Set(b.days)].sort((x, y) => x - y) : sc.days;
      if (b.enabled && !days.length) throw new HttpError(400, "Elegí al menos un día del mes");
      const data = { enabled: b.enabled ?? sc.enabled, days, minLate: b.minLate ?? sc.minLate, minAmount: b.minAmount ?? sc.minAmount, cooldown: b.cooldown ?? sc.cooldown, hour: b.hour ?? sc.hour, notifyTo: notify };
      await db.claimSchedule.upsert({ where: { companyId: company.id }, create: { companyId: company.id, ...data }, update: data });
    }
    const next = nextSendDate(sc);
    if (b.action === "pause" && next) {
      await db.claimSchedule.update({ where: { companyId: company.id }, data: { pausedFor: next } });
      await db.claimRun.create({ data: { companyId: company.id, runDate: next, stage: "pausa", ok: true, error: `Pausado por ${s.name}` } });
    }
    if (b.action === "resume") await db.claimSchedule.update({ where: { companyId: company.id }, data: { pausedFor: null } });
    if (b.action === "test") {
      if (!next) throw new HttpError(400, "No hay un próximo envío programado");
      await sendNotice(company.id, next); // manda ahora el aviso del próximo envío (sirve para probar)
    }
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
