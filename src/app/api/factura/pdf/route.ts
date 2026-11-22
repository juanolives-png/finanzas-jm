// PDF de una factura de venta, tal cual lo genera Colppy (sólo comprobantes electrónicos con CAE).
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { colppyFor, resetColppyFor } from "@/lib/colppySession";
import { docLabel } from "@/lib/mailTemplates";
import { isDemo } from "@/lib/demo";
import { isElectronic } from "@/lib/deuda";

/** Página prolija (con la marca) en vez de un JSON crudo cuando no hay PDF. */
function page(title: string, msg: string, status = 200) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Numo</title>
<style>:root{--bg:#f6f7f9;--card:#fff;--ink:#131c4a;--mut:#6b7280;--acc:#1f9d6b}@media(prefers-color-scheme:dark){:root{--bg:#0d1226;--card:#151b36;--ink:#eef0f7;--mut:#9aa1b5}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);font-family:Inter,system-ui,sans-serif;color:var(--ink);padding:16px}
.c{max-width:440px;background:var(--card);border-radius:16px;padding:32px 28px;box-shadow:0 10px 40px rgba(0,0,0,.08);text-align:center}
.i{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:rgba(31,157,107,.12);color:var(--acc);font-size:24px}
h1{font-size:19px;margin:0 0 8px}p{color:var(--mut);line-height:1.5;margin:0 0 20px;font-size:14.5px}
button{border:0;background:var(--ink);color:var(--card);padding:10px 18px;border-radius:10px;font-weight:600;cursor:pointer}</style></head>
<body><div class="c"><div class="i">i</div><h1>${esc(title)}</h1><p>${esc(msg)}</p><button onclick="window.close()">Cerrar</button></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company"), docId = u.searchParams.get("doc");
    if (!id || !docId) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    const doc = await db.doc.findFirst({ where: { id: docId, companyId: company.id, kind: "venta" } });
    if (!doc) return page("No encontramos la factura", "Puede que se haya borrado o anulado en Colppy. Actualizá los datos y probá de nuevo.", 404);
    if (isDemo(company)) return page(`${docLabel(doc)}: factura de ejemplo`, "Esta es la empresa demo, con números inventados. Con tu Colppy conectado, acá se abre el PDF real de la factura.");
    if (!isElectronic(doc)) return page(`${docLabel(doc)}: sin factura en ARCA`, "Es un comprobante no electrónico (X, I u otro interno), así que no tiene CAE y Colppy no genera PDF.");
    let buf: Buffer;
    try { buf = await (await colppyFor(company)).pdf(doc.colppyId); }
    catch (e) {
      resetColppyFor(company.id); // la sesión pudo vencer: se reintenta una vez con una nueva
      try { buf = await (await colppyFor(company)).pdf(doc.colppyId); }
      catch (e2) {
        const m = e2 instanceof Error ? e2.message : String(e);
        return page("No pudimos traer el PDF", /no es electr/i.test(m) ? "Colppy indica que este comprobante no es electrónico, así que no tiene PDF." : `Colppy no respondió bien (${m}). Probá de nuevo en un rato.`, 502);
      }
    }
    const name = docLabel(doc).replace(/\s+/g, "_") + ".pdf";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
