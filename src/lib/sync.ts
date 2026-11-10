// ─── Sincronización con Colppy (solo lectura) ────────────────────────────────
// Viene de finance.sync.ts de Infocampo, ahora por empresa conectada:
//   · plan de cuentas (Contabilidad.listar_cuentasdiario) + categoría propuesta para cada cuenta
//   · libro diario (Contabilidad.listar_movimientosdiario), mes por mes
// Colppy corta la respuesta del diario sin avisar: se compara el período contra sus dos mitades y,
// si las mitades traen más, se sigue partiendo (hasta un día). Así no se pierde ningún renglón.
// No escribe nada en Colppy.
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ColppyClient } from "./colppy";
import { decrypt } from "./crypto";
import { propose, type TemplateKey } from "./categories";
import { syncDocs } from "./syncDocs";
import { chunks, inChunks, pool } from "./batch";
import { STAGES, type Progress } from "./progress";

type Movement = Record<string, any>;
const num = (v: unknown) => { const n = Number(String(v ?? "0").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: unknown) => {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
};

/** Meses de historia que se traen la primera vez. */
const FIRST_SYNC_MONTHS = 18;

async function fetchRange(c: ColppyClient, idEmpresa: string, from: Date, to: Date): Promise<Movement[]> {
  const out = new Map<string, Movement>();
  const LIMIT = 1000;
  for (let page = 0; page < 50; page++) {
    const r = (await c.call("Contabilidad", "listar_movimientosdiario", { idEmpresa, fromDate: iso(from), toDate: iso(to), start: page * LIMIT, limit: LIMIT })) as any;
    const rows: Movement[] = Array.isArray(r?.movimientos) ? r.movimientos : Array.isArray(r?.data) ? r.data : [];
    let nuevos = 0;
    for (const m of rows) { const k = String(m.idDiario ?? ""); if (k && !out.has(k)) { out.set(k, m); nuevos++; } }
    if (rows.length < LIMIT || !nuevos) break;
  }
  const f = iso(from), t = iso(to);
  return [...out.values()].filter((m) => { const d = String(m.fechaContable ?? "").slice(0, 10); return d >= f && d <= t; });
}

async function movements(c: ColppyClient, idEmpresa: string, from: Date, to: Date, whole?: Movement[]): Promise<Movement[]> {
  const full = whole ?? (await fetchRange(c, idEmpresa, from, to));
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days < 1) return full;
  const mid = new Date(from.getTime() + Math.floor(days / 2) * 86_400_000);
  const next = new Date(mid.getTime() + 86_400_000);
  const a = await fetchRange(c, idEmpresa, from, mid);
  const b = await fetchRange(c, idEmpresa, next, to);
  const ids = new Set(full.map((m) => String(m.idDiario)));
  if (![...a, ...b].some((m) => !ids.has(String(m.idDiario)))) return full;
  const [ra, rb] = [await movements(c, idEmpresa, from, mid, a), await movements(c, idEmpresa, next, to, b)];
  const out = new Map<string, Movement>();
  for (const m of [...full, ...ra, ...rb]) out.set(String(m.idDiario), m);
  return [...out.values()];
}

async function syncAccounts(companyId: string, c: ColppyClient, idEmpresa: string, template: TemplateKey) {
  const r = (await c.call("Contabilidad", "listar_cuentasdiario", { idEmpresa })) as any;
  const rows: Record<string, any>[] = Array.isArray(r?.cuentas) ? r.cuentas : Array.isArray(r?.data) ? r.data : [];
  const existing = new Map((await db.ledgerAccount.findMany({ where: { companyId } })).map((a) => [a.code, a]));
  const creates: Prisma.LedgerAccountCreateManyInput[] = [];
  const updates: ReturnType<typeof db.ledgerAccount.update>[] = [];
  for (const a of rows) {
    const code = String(a.idPlanCuenta ?? "").trim();
    if (!code) continue;
    const name = String(a.Descripcion ?? code).replace(new RegExp(`^${code}\\s*-\\s*`), "").trim();
    const typeName = a.tipoCuenta ?? null;
    const prev = existing.get(code);
    if (!prev) {
      const p = propose(template, code, name);
      creates.push({ companyId, code, name, typeName, category: p.category, debitOnly: p.debitOnly ?? false, source: p.source });
      continue;
    }
    // Lo confirmado por el cliente o propuesto por la IA no se toca: solo el nombre si cambió.
    if (prev.confirmed || prev.source === "ia") {
      if (prev.name !== name || prev.typeName !== typeName) updates.push(db.ledgerAccount.update({ where: { id: prev.id }, data: { name, typeName } }));
      continue;
    }
    const p = propose(template, code, name);
    if (prev.name !== name || prev.category !== p.category || prev.debitOnly !== (p.debitOnly ?? false) || prev.source !== p.source)
      updates.push(db.ledgerAccount.update({ where: { id: prev.id }, data: { name, typeName, category: p.category, debitOnly: p.debitOnly ?? false, source: p.source } }));
  }
  if (creates.length) await db.ledgerAccount.createMany({ data: creates, skipDuplicates: true });
  await inChunks(updates);
  return rows.length;
}

/** Vuelve a proponer todas las cuentas NO confirmadas con una plantilla (sin ir a Colppy). */
export async function applyTemplate(companyId: string, template: TemplateKey) {
  const accounts = await db.ledgerAccount.findMany({ where: { companyId, confirmed: false } });
  await inChunks(accounts.map((a) => {
    const p = propose(template, a.code, a.name);
    return db.ledgerAccount.update({ where: { id: a.id }, data: { category: p.category, debitOnly: p.debitOnly ?? false, source: p.source, aiReason: null } });
  }));
  return accounts.length;
}

async function syncMonth(companyId: string, c: ColppyClient, idEmpresa: string, start: Date) {
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const rows = await movements(c, idEmpresa, start, end);
  const seen = new Set<string>();
  const data: Prisma.LedgerEntryCreateManyInput[] = [];
  for (const m of rows) {
    const colppyId = String(m.idDiario ?? "");
    const date = parseDate(m.fechaContable);
    if (!colppyId || !date || seen.has(colppyId)) continue;
    seen.add(colppyId);
    data.push({
      companyId, colppyId, date,
      account: String(m.idPlanCuenta ?? ""),
      dc: String(m.DebitoCredito ?? "D").toUpperCase() === "C" ? "C" : "D",
      amount: r2(Math.abs(num(m.Importe))),
      subdiario: m.idSubdiario != null ? String(m.idSubdiario) : null,
      // aprendido en Huerta: el campo que enlaza con cliente/proveedor es idObjetoContacto, no idTercero
      contactId: m.idObjetoContacto != null ? String(m.idObjetoContacto) : null,
      cc1: m.ccosto1 ? String(m.ccosto1) : null,
      cc2: m.ccosto2 ? String(m.ccosto2) : null,
    });
  }
  // El mes se reemplaza entero: así se reflejan asientos borrados o corregidos en Colppy.
  await db.$transaction([
    db.ledgerEntry.deleteMany({ where: { companyId, date: { gte: start, lte: end } } }),
    ...chunks(data, 5000).map((d) => db.ledgerEntry.createMany({ data: d, skipDuplicates: true })),
  ]);
  return data.length;
}

const running = new Set<string>();
export const isSyncing = (companyId: string) => running.has(companyId);


/**
 * Arranca la sincronización en segundo plano y devuelve el registro de la corrida.
 * Primera vez: los últimos 18 meses. Después: los últimos 3 meses (lo que todavía se puede corregir).
 */
export async function startSync(companyId: string, trigger: string) {
  if (running.has(companyId)) throw Object.assign(new Error("Ya se está actualizando"), { status: 409 });
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.colppyUser || !company.colppyPassEnc || !company.colppyEmpresaId) throw new Error("La empresa no tiene Colppy conectado");
  running.add(companyId);
  const run = await db.syncRun.create({ data: { companyId, trigger, progress: "Conectando con Colppy…", percent: 0 } });
  let lastWrite = 0;
  // Se escribe el avance como mucho cada 700 ms (no hace falta más para la barra)
  const progress: Progress = async (p, percent) => {
    const now = Date.now();
    if (now - lastWrite < 700 && percent < 100) return;
    lastWrite = now;
    await db.syncRun.update({ where: { id: run.id }, data: { progress: p, percent: Math.min(100, Math.round(percent)) } }).catch(() => null);
  };

  (async () => {
    const c = new ColppyClient({ user: company.colppyUser!, pass: decrypt(company.colppyPassEnc!) }, company.colppyEmpresaId);
    try {
      await c.login();
      const idEmpresa = c.requireEmpresa();
      await progress("Leyendo el plan de cuentas…", STAGES.cuentas[0]);
      const cuentas = await syncAccounts(companyId, c, idEmpresa, (company.template as TemplateKey) ?? "general");

      const now = new Date(Date.now() - 3 * 3_600_000); // hora argentina
      const hasData = (await db.ledgerEntry.count({ where: { companyId } })) > 0;
      const back = hasData ? 2 : FIRST_SYNC_MONTHS - 1;
      const monthsToSync = Array.from({ length: back + 1 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back + i, 1)));
      let done = 0, asientos = 0;
      const [d0, d1] = STAGES.diario;
      // De a 3 meses en paralelo: Colppy aguanta y la carga inicial tarda un tercio
      await pool(monthsToSync, 3, async (m) => {
        asientos += await syncMonth(companyId, c, idEmpresa, m);
        done++;
        await progress(`Libro diario: mes ${done} de ${monthsToSync.length}`, d0 + ((d1 - d0) * done) / monthsToSync.length);
      });
      const comprobantes = await syncDocs(c, idEmpresa, companyId, progress);
      await db.syncRun.update({ where: { id: run.id }, data: { ok: true, finishedAt: new Date(), progress: "Listo", percent: 100, summary: { cuentas, meses: monthsToSync.length, asientos, ...comprobantes } } });
      await db.company.update({ where: { id: companyId }, data: { status: "conectada", lastSyncAt: new Date(), lastError: null } });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error("[sync] falló", companyId, e);
      await db.syncRun.update({ where: { id: run.id }, data: { ok: false, finishedAt: new Date(), error } }).catch(() => null);
      await db.company.update({ where: { id: companyId }, data: { status: "error", lastError: error } }).catch(() => null);
    } finally {
      await c.logout().catch(() => null);
      running.delete(companyId);
    }
  })();
  return run;
}
