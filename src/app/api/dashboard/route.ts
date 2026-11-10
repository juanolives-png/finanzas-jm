import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    return Response.json({ company: { id: company.id, name: company.name, lastSyncAt: company.lastSyncAt, status: company.status }, data: await dashboardData(company.id) });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
