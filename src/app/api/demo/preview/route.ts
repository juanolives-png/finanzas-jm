// Vista previa de la empresa de ejemplo de un rubro (pública: la usa el inicio antes de crear la cuenta).
import { demoPreview } from "@/lib/demoPreview";

export async function GET(req: Request) {
  const rubro = new URL(req.url).searchParams.get("rubro");
  return Response.json(demoPreview(rubro), { headers: { "Cache-Control": "public, max-age=600" } });
}

export const dynamic = "force-dynamic";
