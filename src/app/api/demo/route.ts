// Empresa demo del cliente: POST la crea (o la vuelve a armar al día), DELETE la saca.
import { db } from "@/lib/db";
import { errorResponse, requireSession } from "@/lib/auth";
import { ensureDemoCompany, seedDemo } from "@/lib/demo";
import { isRubro } from "@/lib/demoRubros";

// POST { rubro? }: crea la demo, la rearma al día o la cambia de rubro
export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { rubro?: string };
    const rubro = isRubro(body.rubro) ? body.rubro : null;
    const existing = await db.company.findFirst({ where: { tenantId: s.tenantId, source: "demo" } });
    if (existing && (!rubro || rubro === (existing.demoRubro ?? "distribucion"))) { await seedDemo(existing.id); return Response.json({ companyId: existing.id }); }
    const c = await ensureDemoCompany(s.tenantId, rubro);
    return Response.json({ companyId: c.id });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE() {
  try {
    const s = await requireSession();
    const demo = await db.company.findFirst({ where: { tenantId: s.tenantId, source: "demo" } });
    if (!demo) return Response.json({ ok: true });
    await db.$transaction([
      db.doc.deleteMany({ where: { companyId: demo.id } }),
      db.party.deleteMany({ where: { companyId: demo.id } }),
      db.item.deleteMany({ where: { companyId: demo.id } }),
      db.mailLog.deleteMany({ where: { companyId: demo.id } }),
      db.company.delete({ where: { id: demo.id } }), // el diario, las cuentas y las corridas se borran en cascada
    ]);
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
