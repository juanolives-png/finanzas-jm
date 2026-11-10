import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, errorResponse, HttpError } from "@/lib/auth";

const Body = z.object({
  empresa: z.string().trim().min(2, "Poné el nombre de tu empresa"),
  nombre: z.string().trim().min(2, "Poné tu nombre"),
  email: z.string().trim().toLowerCase().email("Mail inválido"),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres"),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
    const { empresa, nombre, email, password } = parsed.data;
    if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "Ya existe una cuenta con ese mail");
    const user = await db.user.create({
      data: { email, name: nombre, passwordHash: await bcrypt.hash(password, 10), role: "OWNER", tenant: { create: { name: empresa } } },
    });
    await createSession({ userId: user.id, tenantId: user.tenantId, name: user.name, email: user.email });
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
