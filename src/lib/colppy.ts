// ─── Conexión con la API de Colppy (multi-cliente) ───────────────────────────
// Viene del sistema de Infocampo, con un cambio: las credenciales del usuario de Colppy ya no son fijas,
// cada empresa conectada trae las suyas. Las de DESARROLLADOR son de Numo:
//   COLPPY_DEV_USER / COLPPY_DEV_PASS  (variables de entorno)
// Las contraseñas viajan en MD5 (así lo pide la API); si Colppy rechaza el MD5 se reintenta en texto.
// Ojo (aprendido en Huerta): Colppy distingue mayúsculas en el usuario de plataforma; se manda tal cual lo escribe el cliente.

import { createHash } from "node:crypto";

const URL = process.env.COLPPY_URL ?? "https://login.colppy.com/lib/frontera2/service.php";
const PDF_URL = "https://login.colppy.com/resources/Provisiones/ColppyCommon/GenerarFactura.php";
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export class ColppyError extends Error {
  constructor(message: string, public detail?: unknown) { super(message); }
}

type Auth = { usuario: string; password: string };
export type ColppyCreds = { user: string; pass: string };

async function rawCall(auth: Auth, provision: string, operacion: string, parameters: Record<string, unknown>) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth, service: { provision, operacion }, parameters }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  const text = await res.text();
  let j: any;
  try { j = JSON.parse(text); } catch { throw new ColppyError(`Colppy respondió algo inesperado (HTTP ${res.status})`, text.slice(0, 300)); }
  // result.estado es del transporte; el resultado real está en response.success
  const ok = j?.result?.estado === 0 && j?.response?.success !== false;
  if (!ok) throw new ColppyError(String(j?.response?.message ?? j?.result?.mensaje ?? "Error de Colppy"), j);
  return j.response;
}

export class ColppyClient {
  private auth!: Auth;
  private session!: { usuario: string; claveSesion: string };
  constructor(private creds: ColppyCreds, public empresaId: string | null = null) {}

  async login() {
    const devUser = process.env.COLPPY_DEV_USER, devPass = process.env.COLPPY_DEV_PASS;
    if (!devUser || !devPass) throw new ColppyError("Falta configurar COLPPY_DEV_USER / COLPPY_DEV_PASS en el servidor");
    let lastErr: unknown;
    for (const enc of [md5, (s: string) => s]) {
      this.auth = { usuario: devUser, password: enc(devPass) };
      try {
        const r = await rawCall(this.auth, "Usuario", "iniciar_sesion", { usuario: this.creds.user, password: enc(this.creds.pass) });
        this.session = { usuario: this.creds.user, claveSesion: r.data.claveSesion };
        return;
      } catch (e) { lastErr = e; }
    }
    // Mostramos lo que dijo Colppy: los errores 600/602 son de la cuenta de DESARROLLADOR (la del servidor);
    // el resto suele ser el usuario/contraseña de plataforma que puso el cliente.
    const d: any = lastErr instanceof ColppyError ? lastErr.detail : null;
    const raw = String(d?.response?.message ?? d?.result?.mensaje ?? (lastErr instanceof Error ? lastErr.message : lastErr) ?? "");
    const code = String(d?.result?.codigo ?? d?.response?.code ?? "");
    console.error("[colppy] login falló", { code, raw, result: d?.result });
    if (/60[02]/.test(code) || /desarrollador|developer|api/i.test(raw)) {
      throw new ColppyError(`Colppy rechazó la cuenta de desarrollador del servidor (${raw || code}). Revisá COLPPY_DEV_USER / COLPPY_DEV_PASS.`, lastErr);
    }
    throw new ColppyError(`Colppy no aceptó el usuario o la contraseña. Respuesta de Colppy: "${raw || "sin detalle"}"`, lastErr);
  }

  call(provision: string, operacion: string, parameters: Record<string, unknown> = {}) {
    return rawCall(this.auth, provision, operacion, { sesion: this.session, ...parameters });
  }

  async empresas(): Promise<{ id: string; nombre: string; cuit: string | null }[]> {
    const r = await this.call("Empresa", "listar_empresa", { start: 0, limit: 50, filter: [] });
    return (r.data ?? []).map((e: any) => ({
      id: String(e.IdEmpresa ?? e.idEmpresa),
      nombre: String(e.razonSocial ?? e.Nombre ?? ""),
      cuit: e.CUIT ?? null,
    }));
  }

  requireEmpresa() {
    if (!this.empresaId) throw new ColppyError("Falta elegir la empresa de Colppy");
    return this.empresaId;
  }

  /** Detalle de un comprobante de venta: cabecera (vto, condición, CAE, idCliente) + renglones. */
  async leerFacturaVenta(idFactura: string) {
    const idEmpresa = this.requireEmpresa();
    const r = await this.call("FacturaVenta", "leer_facturaventa", { idEmpresa, idFactura });
    return { info: (r.infofactura ?? {}) as Record<string, any>, items: (r.itemsFactura ?? []) as Record<string, any>[], pdfBase: r.UrlFacturaPdf as string | undefined };
  }

  /** PDF de un comprobante electrónico (con CAE), tal cual lo genera Colppy. (Viene de Infocampo.) */
  async pdf(idFactura: string): Promise<Buffer> {
    const idEmpresa = this.requireEmpresa();
    const { info, pdfBase } = await this.leerFacturaVenta(idFactura);
    const q = new URLSearchParams({ usuario: this.session.usuario, claveSesion: this.session.claveSesion, idEmpresa, idFactura, idCliente: String(info.idCliente ?? "") });
    const res = await fetch(`${String(pdfBase || PDF_URL)}?${q}`, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!type.includes("pdf") || buf.subarray(0, 4).toString() !== "%PDF") {
      const txt = buf.toString("utf8").slice(0, 200);
      throw new ColppyError(/no es electronica/i.test(txt) ? "Esta factura no es electrónica: Colppy no genera el PDF" : `Colppy no devolvió el PDF (${res.status})`, txt);
    }
    return buf;
  }

  /** Ítems de inventario (productos y servicios) con su disponibilidad. */
  /** Cobros aplicados a una factura de venta (fecha, recibo, importe). */
  async cobrosFactura(idFactura: string): Promise<Record<string, any>[]> {
    const idEmpresa = this.requireEmpresa();
    const r = (await this.call("FacturaVenta", "leer_cobros_factura", { idEmpresa, idFactura })) as any;
    return Array.isArray(r?.data) ? r.data : [];
  }

  async itemsInventario(): Promise<Record<string, any>[]> {
    const idEmpresa = this.requireEmpresa();
    const out: Record<string, any>[] = [];
    for (let start = 0; start < 50_000; start += 500) {
      const r = await this.call("Inventario", "listar_itemsinventario", { idEmpresa, start, limit: 500, filter: [] });
      const page = (Array.isArray(r?.data) ? r.data : []) as Record<string, any>[];
      out.push(...page);
      if (page.length < 500) break;
    }
    return out;
  }

  async logout() {
    try { await this.call("Usuario", "cerrar_sesion"); } catch { /* da igual */ }
  }
}
