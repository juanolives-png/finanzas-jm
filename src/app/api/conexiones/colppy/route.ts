// Paso 2 de "Conectar Colppy": guarda la empresa elegida con las credenciales encriptadas
// y arranca la primera sincronización. GET: empresas conectadas del cliente.
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { errorResponse, HttpError, requireSession } from "@/lib/auth";
import { startSync } from "@/lib/sync";

export async function GET() {
  try {
    const s = await requireSession();
    const companies = await db.company.findMany({
      where: { tenantId: s.tenantId },
      select: { id: true, name: true, cuit: true, source: true, status: true, lastSyncAt: true, lastError: true, colppyUser: true },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ companies });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const { user, pass, empresaId, nombre, cuit } = (await req.json()) as Record<string, string | undefined>;
    if (!user || !pass || !empresaId || !nombre) throw new HttpError(400, "Faltan datos para conectar la empresa");
    const data = { name: nombre, cuit: cuit ?? null, colppyUser: user.trim(), colppyPassEnc: encrypt(pass), status: "conectada", lastError: null };
    const company = await db.company.upsert({
      where: { tenantId_colppyEmpresaId: { tenantId: s.tenantId, colppyEmpresaId: empresaId } },
      create: { tenantId: s.tenantId, colppyEmpresaId: empresaId, source: "colppy", ...data },
      update: data,
    });
    const run = await startSync(company.id, "conexion");
    return Response.json({ companyId: company.id, runId: run.id });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
