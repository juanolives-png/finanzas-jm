// ─── Comprobantes de venta y compra con saldo (para deuda de clientes y proveedores) ──
// Viene de colppy.sync.ts / finance.sync.ts de Infocampo, con lo aprendido en Huerta:
//   · los borradores (estado 1, punto de venta 9876) y los anulados (estado 4) NO son deuda ni venta
//   · para unir siempre idFactura, nunca nroFactura (se repiten entre talonarios)
//   · NC resta (saldo negativo = crédito a favor del cliente / nuestro con el proveedor)
// Solo lectura en Colppy.
import { db } from "./db";
import type { ColppyClient } from "./colppy";
import type { Prisma } from "@prisma/client";
import { chunks, inChunks, pool } from "./batch";
import { STAGES, type Progress } from "./progress";

type Row = Record<string, any>;
const num = (v: unknown) => { const n = Number(String(v ?? "0").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const parseDate = (s: unknown) => {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
};
const SALE_TYPE: Record<string, string> = { "4": "FAV", "5": "NCV", "6": "NDV", FAV: "FAV", NCV: "NCV", NDV: "NDV" };
const PURCHASE_TYPE: Record<string, string> = { "1": "FAC", "2": "NDC", "3": "NCC", FAC: "FAC", NDC: "NDC", NCC: "NCC" };
const LETTER: Record<string, string> = { "0": "A", "1": "B", "2": "C", "3": "E", "4": "M", A: "A", B: "B", C: "C", E: "E", M: "M", X: "X" };
const isJunk = (f: Row) => /^9876-/.test(String(f.nroFactura ?? "").trim());
/** Borrador (1) o anulada (4): no cuenta. Acepta el número o el texto. */
const notIssued = (f: Row) => { const e = String(f.idEstadoFactura ?? "").trim(); return e === "1" || e === "4" || /anul|borr|rechaz/i.test(e); };

/** Meses hacia atrás que se traen. Lo más viejo con saldo queda igual: sólo se actualiza si entra en el rango. */
const MONTHS_BACK = 24;

async function pageAll(c: ColppyClient, provision: string, operacion: string, idEmpresa: string, fromIso: string, onPage: (n: number) => Promise<unknown>) {
  const out: Row[] = [];
  for (let start = 0; start < 50_000; start += 100) {
    const r = (await c.call(provision, operacion, {
      idEmpresa, start, limit: 100, filter: [{ field: "fechaFactura", op: ">=", value: fromIso }], order: { field: ["idFactura"], order: "desc" },
    })) as any;
    const rows: Row[] = r?.data ?? [];
    out.push(...rows);
    await onPage(out.length);
    if (rows.length < 100) break;
  }
  return out;
}

type PartyInfo = { name: string; alias: string | null; cuit: string | null };

/** Guarda los comprobantes de a tandas: crea los nuevos de una, y actualiza sólo los que cambiaron. */
async function upsertDocs(companyId: string, kind: "venta" | "compra", rows: Row[], from: Date) {
  const types = kind === "venta" ? SALE_TYPE : PURCHASE_TYPE;
  const existing = new Map((await db.doc.findMany({
    where: { companyId, kind, date: { gte: from } },
    select: { id: true, colppyId: true, total: true, applied: true, dueDate: true, partyName: true, number: true, cae: true },
  })).map((d) => [d.colppyId, d]));
  const seen = new Set<string>();
  const parties = new Map<string, PartyInfo>();
  const creates: Prisma.DocCreateManyInput[] = [];
  const updates: ReturnType<typeof db.doc.update>[] = [];
  for (const f of rows) {
    const colppyId = String(f.idFactura ?? "");
    const docType = types[String(f.idTipoComprobante)];
    const date = parseDate(f.fechaFactura);
    if (!colppyId || !docType || !date || isJunk(f) || notIssued(f) || seen.has(colppyId)) continue;
    const partyId = String((kind === "venta" ? f.idCliente : f.idProveedor) ?? "");
    const partyName = String(f.RazonSocial || f.NombreFantasia || partyId).trim();
    const sign = docType.startsWith("NC") ? -1 : 1;
    const total = r2(sign * Math.abs(num(f.totalFactura)));
    const applied = r2(sign * Math.abs(num(f.totalaplicado)));
    const dueDate = parseDate(f.fechaPago) ?? parseDate(f.fechaVencimiento);
    const data = {
      partyId, partyName, docType, letter: LETTER[String(f.idTipoFactura ?? "").toUpperCase()] ?? null,
      cae: String(f.cae ?? f.CAE ?? "").replace(/\D/g, "") || null,
      number: String(f.nroFactura ?? ""), date, dueDate,
      description: f.descripcion ? String(f.descripcion).slice(0, 500) : null, total, applied, pending: r2(total - applied),
    };
    seen.add(colppyId);
    if (partyId) parties.set(partyId, { name: partyName, alias: f.NombreFantasia ? String(f.NombreFantasia) : null, cuit: f.CUIT ? String(f.CUIT) : null });
    const prev = existing.get(colppyId);
    if (!prev) { creates.push({ companyId, kind, colppyId, ...data }); continue; }
    const changed = Number(prev.total) !== total || Number(prev.applied) !== applied || (prev.dueDate?.getTime() ?? 0) !== (dueDate?.getTime() ?? 0)
      || prev.partyName !== partyName || prev.number !== data.number || (prev.cae ?? null) !== data.cae;
    // si cambió lo cobrado, la fecha de cobro se vuelve a leer
    if (changed) updates.push(db.doc.update({ where: { id: prev.id }, data: Number(prev.applied) !== applied ? { ...data, payChecked: false, paidAt: null } : data }));
  }
  for (const part of chunks(creates, 2000)) await db.doc.createMany({ data: part, skipDuplicates: true });
  await inChunks(updates);
  // Lo que estaba guardado dentro del rango y Colppy ya no devuelve (anulado / borrado) se elimina
  const gone = [...existing.keys()].filter((id) => !seen.has(id));
  if (gone.length) await db.doc.deleteMany({ where: { companyId, kind, colppyId: { in: gone } } });
  return { count: seen.size, parties };
}

/** Clientes / proveedores: alta de los nuevos de una, y mail y teléfono de los que tienen saldo (de a 5 en paralelo). */
async function fillContacts(c: ColppyClient, idEmpresa: string, companyId: string, kind: "cliente" | "proveedor", parties: Map<string, PartyInfo>, onStep: (done: number, total: number) => Promise<unknown>) {
  const existing = new Map((await db.party.findMany({ where: { companyId, kind } })).map((p) => [p.colppyId, p]));
  const creates: Prisma.PartyCreateManyInput[] = [];
  const updates: ReturnType<typeof db.party.update>[] = [];
  for (const [colppyId, p] of parties) {
    const prev = existing.get(colppyId);
    if (!prev) creates.push({ companyId, kind, colppyId, name: p.name, alias: p.alias, cuit: p.cuit });
    else if (prev.name !== p.name || prev.alias !== p.alias || (p.cuit && prev.cuit !== p.cuit)) updates.push(db.party.update({ where: { id: prev.id }, data: { name: p.name, alias: p.alias, ...(p.cuit ? { cuit: p.cuit } : {}) } }));
  }
  if (creates.length) await db.party.createMany({ data: creates, skipDuplicates: true });
  await inChunks(updates);

  const docKind = kind === "cliente" ? "venta" : "compra";
  const withDebt = await db.doc.groupBy({ by: ["partyId"], where: { companyId, kind: docKind }, _sum: { pending: true } });
  const owing = withDebt.filter((x) => Math.abs(Number(x._sum.pending ?? 0)) > 1).map((x) => x.partyId);
  // Ficha completa (mail, teléfono, dirección, condición de IVA) de los que tienen saldo:
  // las nuevas o las que no se leyeron en los últimos 30 días. Lo que el usuario corrigió a mano (mail) no se pisa.
  const stale = new Date(Date.now() - 30 * 86_400_000);
  const toRead = await db.party.findMany({ where: { companyId, kind, colppyId: { in: owing }, OR: [{ contactAt: null }, { contactAt: { lt: stale } }] }, take: 250 });
  const IVA: Record<string, string> = { "1": "Responsable inscripto", "2": "Exento", "3": "Consumidor final", "4": "Monotributo" };
  const str = (v: unknown) => { const t = String(v ?? "").trim(); return t && t !== "null" ? t : null; };
  let done = 0;
  await pool(toRead, 5, async (p) => {
    try {
      const r = (await c.call(kind === "cliente" ? "Cliente" : "Proveedor", kind === "cliente" ? "leer_cliente" : "leer_proveedor",
        kind === "cliente" ? { idEmpresa, idCliente: p.colppyId } : { idEmpresa, idProveedor: p.colppyId })) as any;
      const d = Array.isArray(r?.data) ? r.data[0] : r?.data;
      if (d) {
        const email = str(d.Email ?? d.email);
        await db.party.update({ where: { id: p.id }, data: {
          ...(p.emailManual ? {} : { email }),
          phone: str(d.Telefono ?? d.telefono) ?? p.phone,
          cuit: str(d.CUIT) ?? p.cuit,
          address: str(d.DirPostal ?? d.DirFiscal),
          city: str(d.DirPostalCiudad ?? d.DirFiscalCiudad),
          province: str(d.DirPostalProvincia ?? d.DirFiscalProvincia),
          ivaCondition: IVA[String(d.idCondicionIva ?? "")] ?? str(d.idCondicionIva),
          contactAt: new Date(),
        } });
      }
    } catch { /* si Colppy no tiene la operación o falla, el mail se carga a mano */ }
    await onStep(++done, toRead.length);
  });
}

/** Stock: ítems de inventario con su disponibilidad (si la empresa usa inventario en Colppy). */
async function syncItems(c: ColppyClient, companyId: string) {
  let rows: Row[] = [];
  try { rows = await c.itemsInventario(); } catch { return 0; } // empresas sin inventario: no pasa nada
  const existing = new Map((await db.item.findMany({ where: { companyId }, select: { id: true, colppyId: true } })).map((x) => [x.colppyId, x.id]));
  const creates: Prisma.ItemCreateManyInput[] = [];
  const updates: ReturnType<typeof db.item.update>[] = [];
  for (const it of rows) {
    const colppyId = String(it.idItem ?? it.id ?? "");
    if (!colppyId) continue;
    const data = {
      code: String(it.codigo ?? ""), name: String(it.descripcion ?? it.comentarioFactura ?? colppyId).trim(),
      kind: String(it.tipoItem ?? "P").toUpperCase() === "S" ? "S" : "P", unit: it.unidadMedida ? String(it.unidadMedida) : null,
      stock: num(it.disponibilidad), minimum: it.minimo != null && it.minimo !== "" ? num(it.minimo) : null,
      cost: num(it.costoCalculado), lastPurchase: num(it.ultimoPrecioCompra), price: num(it.precioVenta),
      iva: it.iva != null ? String(it.iva) : null, category: it.descCtaInventario ? String(it.descCtaInventario) : null, active: !it.fechaBaja,
    };
    const id = existing.get(colppyId);
    if (id) updates.push(db.item.update({ where: { id }, data }));
    else creates.push({ companyId, colppyId, ...data });
  }
  for (const part of chunks(creates, 2000)) await db.item.createMany({ data: part, skipDuplicates: true });
  await inChunks(updates);
  return rows.length;
}

/**
 * Fecha real de cobro de las facturas de venta ya canceladas: una consulta por factura (leer_cobros_factura),
 * de a 5 en paralelo y hasta 600 por actualización, las más nuevas primero. Así la historia se completa en
 * pocas actualizaciones y después solo se leen las que se van cobrando.
 */
async function fillPaidDates(c: ColppyClient, companyId: string, onStep: (done: number, total: number) => Promise<unknown>) {
  const docs = await db.doc.findMany({
    where: { companyId, kind: "venta", docType: { in: ["FAV", "NDV"] }, payChecked: false, applied: { gt: 0 }, pending: { lte: 1, gte: -1 } },
    orderBy: { date: "desc" }, take: 600, select: { id: true, colppyId: true },
  });
  let done = 0;
  await pool(docs, 5, async (d) => {
    try {
      const cobros = await c.cobrosFactura(d.colppyId);
      const dates = cobros.map((x) => parseDate(x.fechaCobro ?? x.fecha)).filter((x): x is Date => !!x);
      const paidAt = dates.length ? new Date(Math.max(...dates.map((x) => x.getTime()))) : null;
      await db.doc.update({ where: { id: d.id }, data: { paidAt, payChecked: true } });
    } catch { /* si falla, se reintenta en la próxima actualización */ }
    await onStep(++done, docs.length);
  });
  return done;
}

/** Avance dentro de una etapa cuando no se sabe el total: se acerca al final sin llegar nunca. */
const approach = ([a, b]: readonly [number, number], n: number, k: number) => a + (b - a) * (1 - 1 / (1 + n / k));

export async function syncDocs(c: ColppyClient, idEmpresa: string, companyId: string, progress: Progress) {
  const now = new Date(Date.now() - 3 * 3_600_000);
  const fromIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK, 1)).toISOString().slice(0, 10);
  const from = new Date(`${fromIso}T00:00:00Z`);

  const ventas = await pageAll(c, "FacturaVenta", "listar_facturasventa", idEmpresa, fromIso, (n) => progress(`Facturas de venta: ${n.toLocaleString("es-AR")}`, approach(STAGES.ventas, n, 1500)));
  const v = await upsertDocs(companyId, "venta", ventas, from);
  const compras = await pageAll(c, "FacturaCompra", "listar_facturasCompra", idEmpresa, fromIso, (n) => progress(`Facturas de proveedores: ${n.toLocaleString("es-AR")}`, approach(STAGES.compras, n, 1000)));
  const k = await upsertDocs(companyId, "compra", compras, from);

  const [c0, c1] = STAGES.contactos, mid = (c0 + c1) / 2;
  const cobros = await fillPaidDates(c, companyId, (d, t) => progress(`Fechas de cobro: ${d} de ${t}`, c0));
  await fillContacts(c, idEmpresa, companyId, "cliente", v.parties, (d, t) => progress(`Datos de clientes: ${d} de ${t}`, c0 + (mid - c0) * (d / Math.max(t, 1))));
  await fillContacts(c, idEmpresa, companyId, "proveedor", k.parties, (d, t) => progress(`Datos de proveedores: ${d} de ${t}`, mid + (c1 - mid) * (d / Math.max(t, 1))));
  await progress("Trayendo el stock…", c1 - 1);
  const items = await syncItems(c, companyId);
  return { ventas: v.count, compras: k.count, items, cobros };
}
