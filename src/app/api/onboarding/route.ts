// Guarda lo que el cliente eligió en el inicio: módulos y sus pedidos con sus palabras.
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireSession } from "@/lib/auth";
import { ensureDemoCompany } from "@/lib/demo";
import { isRubro } from "@/lib/demoRubros";

const Body = z.object({ modules: z.array(z.string().max(40)).max(40), wishes: z.array(z.string().max(500)).max(40).optional(), company: z.string().max(80).optional(), demo: z.string().max(30).optional() });

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new HttpError(400, "Datos inválidos");
    await db.tenant.update({ where: { id: s.tenantId }, data: { modules: p.data.modules, wishes: p.data.wishes ?? [] } });
    // La empresa de ejemplo pasa a ser la del rubro que vio en el inicio
    if (isRubro(p.data.demo)) await ensureDemoCompany(s.tenantId, p.data.demo).catch((e) => console.error("[onboarding] demo", e));
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
