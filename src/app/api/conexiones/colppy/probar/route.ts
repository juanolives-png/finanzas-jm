// Paso 1 de "Conectar Colppy": prueba el usuario y la contraseña y devuelve las empresas que ve.
// No guarda nada.
import { ColppyClient, ColppyError } from "@/lib/colppy";
import { errorResponse, HttpError, requireSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireSession();
    const { user, pass } = (await req.json()) as { user?: string; pass?: string };
    if (!user || !pass) throw new HttpError(400, "Completá usuario y contraseña de Colppy");
    const c = new ColppyClient({ user: user.trim(), pass });
    try {
      await c.login();
      const empresas = await c.empresas();
      return Response.json({ empresas });
    } catch (e) {
      if (e instanceof ColppyError) throw new HttpError(400, e.message);
      throw e;
    } finally {
      await c.logout();
    }
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
