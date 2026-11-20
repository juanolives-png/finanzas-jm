// ─── Empresa demo ────────────────────────────────────────────────────────────
// Guarda en la base los datos que arma demoData.ts. "Actualizar" la vuelve a generar al día de hoy.
import { db } from "./db";
import { chunks } from "./batch";
import { buildDemo, DEMO_NAME, demoName } from "./demoData";
import { profileFor } from "./demoRubros";

export { DEMO_NAME };
export const isDemo = (c: { source?: string | null }) => c.source === "demo";

export async function seedDemo(companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { demoRubro: true } });
  const { accounts, ledger, docs, parties, items } = buildDemo(companyId, company?.demoRubro);
  await db.$transaction([
    db.ledgerEntry.deleteMany({ where: { companyId } }),
    db.doc.deleteMany({ where: { companyId } }),
    db.party.deleteMany({ where: { companyId } }),
    db.item.deleteMany({ where: { companyId } }),
    db.ledgerAccount.deleteMany({ where: { companyId } }),
    db.ledgerAccount.createMany({ data: accounts }),
    db.party.createMany({ data: parties }),
    db.item.createMany({ data: items }),
    ...chunks(docs, 2000).map((d) => db.doc.createMany({ data: d })),
    ...chunks(ledger, 4000).map((d) => db.ledgerEntry.createMany({ data: d })),
  ]);
  await db.company.update({ where: { id: companyId }, data: { status: "conectada", lastSyncAt: new Date(), lastError: null } });
  return { asientos: ledger.length, ventas: docs.filter((d) => d.kind === "venta").length, compras: docs.filter((d) => d.kind === "compra").length, items: items.length };
}

/** Crea (o devuelve) la empresa demo del tenant. Si se pide otro rubro, la rearma con la empresa de ese rubro. */
export async function ensureDemoCompany(tenantId: string, rubro?: string | null) {
  const key = rubro ? profileFor(rubro).key : null;
  const found = await db.company.findFirst({ where: { tenantId, source: "demo" } });
  if (found) {
    if (key && (found.demoRubro ?? "distribucion") !== key) {
      const c = await db.company.update({ where: { id: found.id }, data: { demoRubro: key, name: demoName(key) } });
      await seedDemo(c.id);
      return c;
    }
    return found;
  }
  const c = await db.company.create({ data: { tenantId, name: demoName(key), demoRubro: key ?? "distribucion", source: "demo", template: "general", status: "conectada" } });
  await seedDemo(c.id);
  return c;
}
