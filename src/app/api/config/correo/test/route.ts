// Manda un mail de prueba a la propia casilla (o al mail del usuario) para verificar la configuración.
import { errorResponse, HttpError, requireSession } from "@/lib/auth";
import { deliver } from "@/lib/mail";

export async function POST() {
  try {
    const s = await requireSession();
    try {
      await deliver(s.tenantId, { to: [s.email], cc: [], subject: "Finanzas JM — mail de prueba", text: "¡Funciona! Los reclamos y órdenes de pago van a salir desde esta casilla.", html: "<p>¡Funciona! Los reclamos y órdenes de pago van a salir desde esta casilla.</p>" });
    } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : String(e)); }
    return Response.json({ ok: true, to: s.email });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
