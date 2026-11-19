import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { converter, isCasa, type View } from "@/lib/macro";

// GET ?company=ID&view=nominal|real|usd&casa=oficial|bolsa|mayorista
export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const v = u.searchParams.get("view");
    const view: View = v === "real" || v === "usd" ? v : "nominal";
    const c = u.searchParams.get("casa");
    const conv = await converter(view, isCasa(c) ? c : "oficial");
    return Response.json({
      company: { id: company.id, name: company.name, lastSyncAt: company.lastSyncAt, status: company.status },
      data: await dashboardData(company.id, conv),
      money: { view: conv.view, casa: conv.casa, available: conv.available, note: conv.note, symbol: conv.symbol, today: conv.today },
    });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
