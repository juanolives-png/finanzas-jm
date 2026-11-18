// Sesión de Colppy por empresa, reutilizada para pedidos sueltos (PDF de facturas).
// La sesión de Colppy dura 12 horas; se renueva cada 2 por las dudas.
import { ColppyClient } from "./colppy";
import { decrypt } from "./crypto";

type Co = { id: string; colppyUser: string | null; colppyPassEnc: string | null; colppyEmpresaId: string | null };
const cache = new Map<string, { c: ColppyClient; at: number }>();

export async function colppyFor(company: Co): Promise<ColppyClient> {
  if (!company.colppyUser || !company.colppyPassEnc || !company.colppyEmpresaId) throw new Error("La empresa no tiene Colppy conectado");
  const hit = cache.get(company.id);
  if (hit && Date.now() - hit.at < 2 * 3_600_000) return hit.c;
  const c = new ColppyClient({ user: company.colppyUser, pass: decrypt(company.colppyPassEnc) }, company.colppyEmpresaId);
  await c.login();
  cache.set(company.id, { c, at: Date.now() });
  return c;
}
export const resetColppyFor = (companyId: string) => cache.delete(companyId);
