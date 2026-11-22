// Link del mail del día anterior: pausa ese envío sin tener que iniciar sesión (va firmado).
import { db } from "@/lib/db";
import { checkPauseToken, niceDate, appUrl } from "@/lib/claims";

function page(title: string, msg: string, ok: boolean) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Numo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0F1714;font-family:Inter,system-ui,sans-serif;color:#E5EEE9;padding:16px}.c{max-width:440px;background:#16211C;border:1px solid #283830;border-radius:18px;padding:30px 26px;text-align:center}.i{width:54px;height:54px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;font-size:24px;background:${ok ? "rgba(79,179,131,.15);color:#4FB383" : "rgba(184,65,44,.15);color:#E2735C"}}h1{font-size:20px;margin:0 0 8px}p{color:#A9B9B1;line-height:1.55;margin:0 0 18px}a{display:inline-block;background:#4FB383;color:#0F1714;font-weight:700;padding:11px 18px;border-radius:10px;text-decoration:none}</style></head>
<body><div class="c"><div class="i">${ok ? "⏸" : "!"}</div><h1>${title}</h1><p>${msg}</p><a href="${appUrl()}/app/clientes/reclamos">Ir a Numo</a></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get("c") ?? "", d = u.searchParams.get("d") ?? "", t = u.searchParams.get("t") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !checkPauseToken(c, d, t)) return page("El link no es válido", "Puede que esté incompleto. Entrá a Numo para pausar el envío desde Reclamos automáticos.", false);
  const sc = await db.claimSchedule.findUnique({ where: { companyId: c } });
  if (!sc) return page("No encontramos la configuración", "Entrá a Numo para revisar los reclamos automáticos.", false);
  if (sc.sentFor === d) return page("Ese envío ya salió", "Los reclamos de ese día ya se enviaron. En Numo ves el detalle de cada uno.", false);
  await db.claimSchedule.update({ where: { companyId: c }, data: { pausedFor: d } });
  await db.claimRun.create({ data: { companyId: c, runDate: d, stage: "pausa", ok: true, error: "Pausado desde el mail de aviso" } });
  return page("Listo, el envío quedó pausado", `Los reclamos del ${niceDate(d)} no se van a enviar. El calendario sigue igual para las próximas fechas; podés reanudarlo desde Numo.`, true);
}

export const dynamic = "force-dynamic";
