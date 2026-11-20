// Cartera de clientes: churn, recompra, concentración y días reales de cobro (todo desde las facturas).
// GET ?company=ID&dias=90  (días sin comprar para considerar perdido a un cliente)
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { customerAnalytics } from "@/lib/clientes";
import { todayAR } from "@/lib/deuda";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const dias = Math.min(365, Math.max(30, Number(u.searchParams.get("dias")) || 90));
    const docs = await db.doc.findMany({
      where: { companyId: company.id },
      select: { kind: true, partyId: true, partyName: true, docType: true, date: true, dueDate: true, total: true, pending: true, paidAt: true },
    });
    const data = customerAnalytics(docs.map((d) => ({ ...d, total: Number(d.total), pending: Number(d.pending) })), todayAR(), dias);
    return Response.json({ company: { id: company.id, name: company.name, source: company.source }, ...data });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
