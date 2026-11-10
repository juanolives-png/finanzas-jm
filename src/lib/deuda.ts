// ─── Deuda de clientes y con proveedores ─────────────────────────────────────
// Como el panel de deuda de Infocampo: antigüedad por tramos + mes de factura + lista por cliente,
// con "celdas" [mes, tramo, importe] para que la pantalla cruce filtros sin volver a pedir datos.
import { db } from "./db";

export type Kind = "clientes" | "proveedores";
export const docKind = (k: Kind) => (k === "clientes" ? "venta" : "compra");
export const partyKind = (k: Kind) => (k === "clientes" ? "cliente" : "proveedor");

export const BUCKETS: Record<Kind, string[]> = {
  // días desde el vencimiento
  clientes: ["Por vencer", "1–30 días", "31–60 días", "61–90 días", "91–120 días", "+120 días"],
  // proveedores: lo que importa es cuándo hay que pagar
  proveedores: ["Vencido", "Vence en 7 días", "8–30 días", "Más de 30 días"],
};

const DAY = 86_400_000;
export const todayAR = () => { const t = new Date(Date.now() - 3 * 3_600_000); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); };
/** Días de atraso: positivo = vencido hace N días; negativo = vence en N días. */
export const daysLate = (due: Date | null, date: Date, today = todayAR()) => Math.round((today.getTime() - (due ?? date).getTime()) / DAY);

export function bucketOf(kind: Kind, late: number) {
  if (kind === "clientes") return late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : late <= 120 ? 4 : 5;
  return late > 0 ? 0 : late >= -7 ? 1 : late >= -30 ? 2 : 3;
}

export type Cell = [string, number, number]; // [mes de factura, tramo, saldo]
export type PartyRow = {
  id: string; name: string; alias: string | null; email: string | null;
  total: number; overdue: number; credit: number; maxLate: number; docs: number; cells: Cell[];
  lastMail: { at: string; kind: string; tone: string | null } | null;
};

export async function debtSummary(companyId: string, kind: Kind) {
  const today = todayAR();
  const docs = await db.doc.findMany({
    where: { companyId, kind: docKind(kind), OR: [{ pending: { gt: 1 } }, { pending: { lt: -1 } }] },
    select: { partyId: true, partyName: true, date: true, dueDate: true, pending: true },
  });
  const parties = new Map((await db.party.findMany({ where: { companyId, kind: partyKind(kind) } })).map((p) => [p.colppyId, p]));
  const logs = await db.mailLog.findMany({ where: { companyId, ok: true, kind: kind === "clientes" ? "reclamo_cliente" : { in: ["orden_pago", "reclamo_proveedor"] } }, orderBy: { sentAt: "desc" }, select: { partyId: true, sentAt: true, kind: true, tone: true } });
  const lastMail = new Map<string, PartyRow["lastMail"]>();
  for (const l of logs) if (!lastMail.has(l.partyId)) lastMail.set(l.partyId, { at: l.sentAt.toISOString(), kind: l.kind, tone: l.tone });

  const rows = new Map<string, PartyRow>();
  const months = new Set<string>();
  for (const d of docs) {
    const p = parties.get(d.partyId);
    const r = rows.get(d.partyId) ?? { id: d.partyId, name: p?.name ?? d.partyName, alias: p?.alias ?? null, email: p?.email ?? null, total: 0, overdue: 0, credit: 0, maxLate: -9999, docs: 0, cells: [], lastMail: lastMail.get(d.partyId) ?? null };
    const pending = Number(d.pending);
    const late = daysLate(d.dueDate, d.date, today);
    const m = d.date.toISOString().slice(0, 7);
    months.add(m);
    r.total += pending; r.docs++;
    if (pending < 0) r.credit += pending;
    else {
      if (late > 0) r.overdue += pending;
      r.maxLate = Math.max(r.maxLate, late);
      const b = bucketOf(kind, late);
      const cell = r.cells.find((c) => c[0] === m && c[1] === b);
      if (cell) cell[2] += pending; else r.cells.push([m, b, pending]);
    }
    rows.set(d.partyId, r);
  }
  const list = [...rows.values()].filter((r) => Math.abs(r.total) > 1).sort((a, b) => b.total - a.total);
  const positive = list.flatMap((r) => r.cells);
  const total = list.reduce((s, r) => s + Math.max(r.total, 0), 0);
  const overdue = list.reduce((s, r) => s + r.overdue, 0);
  // Atraso promedio ponderado por saldo (sólo lo vencido)
  let wsum = 0, w = 0;
  for (const d of docs) { const p = Number(d.pending); const late = daysLate(d.dueDate, d.date, today); if (p > 0 && late > 0) { wsum += p * late; w += p; } }
  return {
    asOf: today.toISOString().slice(0, 10),
    buckets: BUCKETS[kind],
    months: [...months].sort(),
    totals: {
      total, overdue, credit: list.reduce((s, r) => s + r.credit, 0),
      avgLate: w ? Math.round(wsum / w) : 0,
      parties: list.length,
      noEmail: list.filter((r) => !r.email && r.total > 1).length,
      byBucket: BUCKETS[kind].map((_, i) => positive.filter((c) => c[1] === i).reduce((s, c) => s + c[2], 0)),
    },
    parties: list,
  };
}

export async function partyDetail(companyId: string, kind: Kind, partyId: string) {
  const today = todayAR();
  const party = await db.party.findUnique({ where: { companyId_kind_colppyId: { companyId, kind: partyKind(kind), colppyId: partyId } } });
  const docs = await db.doc.findMany({
    where: { companyId, kind: docKind(kind), partyId, OR: [{ pending: { gt: 1 } }, { pending: { lt: -1 } }] },
    orderBy: { date: "asc" },
  });
  const mails = await db.mailLog.findMany({ where: { companyId, partyId, kind: kind === "clientes" ? "reclamo_cliente" : { in: ["orden_pago", "reclamo_proveedor"] } }, orderBy: { sentAt: "desc" }, take: 10 });
  return {
    party: party ? { id: party.colppyId, name: party.name, alias: party.alias, cuit: party.cuit, email: party.email, phone: party.phone } : { id: partyId, name: docs[0]?.partyName ?? partyId, alias: null, cuit: null, email: null, phone: null },
    docs: docs.map((d) => ({
      id: d.id, docType: d.docType, letter: d.letter, number: d.number, date: d.date.toISOString().slice(0, 10),
      dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null, total: Number(d.total), pending: Number(d.pending),
      late: daysLate(d.dueDate, d.date, today), description: d.description,
    })),
    mails: mails.map((m) => ({ at: m.sentAt.toISOString(), kind: m.kind, tone: m.tone, to: m.to, subject: m.subject, amount: Number(m.amount), ok: m.ok, error: m.error })),
  };
}
