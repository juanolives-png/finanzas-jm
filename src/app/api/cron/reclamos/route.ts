// Disparo externo del reloj de reclamos (por si se usa un cron de Railway): POST con header x-cron-secret.
import { claimsTick } from "@/lib/claims";

export async function POST(req: Request) {
  const s = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || s !== process.env.CRON_SECRET) return Response.json({ error: "No autorizado" }, { status: 401 });
  await claimsTick();
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
