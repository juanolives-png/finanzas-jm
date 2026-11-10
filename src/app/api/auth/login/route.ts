import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, errorResponse, HttpError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    const user = email ? await db.user.findUnique({ where: { email: email.trim().toLowerCase() } }) : null;
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "Mail o contraseña incorrectos");
    await createSession({ userId: user.id, tenantId: user.tenantId, name: user.name, email: user.email });
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
