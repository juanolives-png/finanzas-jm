// Stock: ítems de inventario de Colppy con su disponibilidad y valorización.
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const items = await db.item.findMany({ where: { companyId: company.id, active: true }, orderBy: { name: "asc" } });
    return Response.json({
      company: { id: company.id, name: company.name, lastSyncAt: company.lastSyncAt },
      items: items.map((i) => ({
        id: i.id, code: i.code, name: i.name, kind: i.kind, unit: i.unit, category: i.category,
        stock: Number(i.stock), minimum: i.minimum === null ? null : Number(i.minimum),
        // costo: el calculado por Colppy; si no hay, el último precio de compra
        cost: Number(i.cost) || Number(i.lastPurchase), price: Number(i.price),
      })),
    });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
