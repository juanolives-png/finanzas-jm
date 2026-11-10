// Sesión: JWT firmado en una cookie httpOnly. Lleva el usuario y su tenant.
// Regla de oro del multi-cliente: el tenantId SIEMPRE sale de la sesión, nunca de lo que manda el navegador.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "fjm_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-cambiar");

export type Session = { userId: string; tenantId: string; name: string; email: string };

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch { return null; }
}

export async function getSession() {
  return verifyToken(cookies().get(COOKIE)?.value);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Tenés que iniciar sesión");
  return s;
}

/** Trae una empresa SOLO si es del tenant de la sesión. Toda consulta de datos pasa por acá. */
export async function getCompany(session: Session, companyId: string) {
  const c = await db.company.findFirst({ where: { id: companyId, tenantId: session.tenantId } });
  if (!c) throw new HttpError(404, "Empresa no encontrada");
  return c;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Error inesperado";
  if (status === 500) console.error(e);
  return Response.json({ error: message }, { status });
}

export const SESSION_COOKIE = COOKIE;
