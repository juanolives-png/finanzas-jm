// POST ?company=ID → actualiza ahora. GET ?company=ID → estado de la última corrida.
// Para la actualización diaria automática: POST con header x-cron-secret y sin sesión (actualiza todas).
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { isSyncing, startSync } from "@/lib/sync";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    await getCompany(s, id);
    const run = await db.syncRun.findFirst({ where: { companyId: id }, orderBy: { startedAt: "desc" } });
    return Response.json({ run, running: isSyncing(id) });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    const cron = req.headers.get("x-cron-secret");
    if (cron && process.env.CRON_SECRET && cron === process.env.CRON_SECRET) {
      const companies = await db.company.findMany({ where: { colppyEmpresaId: { not: null } }, select: { id: true } });
      // De a una, para no saturar Colppy
      const started: string[] = [];
      for (const c of companies) {
        if (isSyncing(c.id)) continue;
        await startSync(c.id, "cron");
        started.push(c.id);
        while (isSyncing(c.id)) await new Promise((r) => setTimeout(r, 2000));
      }
      return Response.json({ ok: true, companies: started.length });
    }
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    await getCompany(s, id);
    const run = await startSync(id, "manual").catch((e) => { throw new HttpError((e as any).status ?? 500, e.message); });
    return Response.json({ runId: run.id });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
