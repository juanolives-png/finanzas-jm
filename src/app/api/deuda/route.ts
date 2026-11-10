import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { debtSummary, type Kind } from "@/lib/deuda";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company"), kind = u.searchParams.get("kind") as Kind;
    if (!id || (kind !== "clientes" && kind !== "proveedores")) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    return Response.json({ company: { id: company.id, name: company.name, lastSyncAt: company.lastSyncAt }, ...(await debtSummary(company.id, kind)) });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
