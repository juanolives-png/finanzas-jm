// ─── El chat del inicio, con IA de verdad ────────────────────────────────────
// La persona escribe con sus palabras ("tengo una ferretería y nunca sé si gano plata") y Numo:
//   · entiende qué necesita y propone secciones del catálogo, cada una con el motivo
//   · si no sabe el rubro o el tamaño, pregunta UNA cosa corta
//   · lo que no existe en el catálogo lo anota como "pedido especial", sin prometer
// Es público (todavía no tiene cuenta): límite por IP y mensajes cortos. Si no hay clave o falla,
// responde { fallback: true } y la pantalla usa las palabras clave de siempre.
import { z } from "zod";
import { OB_MODULES } from "@/lib/onboarding";
import { OB_INFO } from "@/lib/obInfo";
import { DEMO_PROFILES, RUBRO_KEYS, isRubro, rubroFromText } from "@/lib/demoRubros";

const MODEL = process.env.ONBOARDING_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(800) })).min(1).max(16),
  chosen: z.array(z.string().max(40)).max(30).optional(),
});

// Límite simple en memoria: 80 mensajes por hora por IP (cuida el crédito sin cortar a quien prueba en serio)
const hits = new Map<string, { n: number; reset: number }>();
function allowed(ip: string) {
  const now = Date.now(), h = hits.get(ip);
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + 3_600_000 }); return true; }
  h.n++;
  if (hits.size > 5000) hits.clear();
  return h.n <= 80;
}

const catalog = OB_MODULES.map((m) => `- ${m.id}: ${m.label}${OB_INFO[m.id] ? ` — ${OB_INFO[m.id].lead}${OB_INFO[m.id].soon ? " (llega pronto)" : ""}` : ""}`).join("\n");
const SYSTEM = `Sos Numo: el CFO de bolsillo de los dueños de pymes argentinas. Tenés 20 años sentado al lado de dueños de ferreterías, distribuidoras, estudios, coworkings, comercios, talleres y empresas de servicios, y sabés dónde se les escapa la plata a cada uno. Numo se conecta a Colppy (el sistema contable), solo lee, y arma un tablero con los números del negocio.
Estás en la página de inicio: la persona todavía no tiene cuenta y te cuenta qué quiere ver de su empresa. Tu trabajo: que sienta que la entendiste mejor que nadie y proponerle las secciones de su Numo.

Secciones disponibles (usá SOLO estos ids):
${catalog}

Cómo pensar antes de responder:
- ¿Qué le duele de verdad? Detrás de "no sé si gano plata" suele haber otra cosa: stock parado, fiado o cuenta corriente que no se cobra, precios que quedaron atrás de la inflación, gastos fijos que crecieron sin que nadie mire, plata del IVA que se gasta como si fuera propia.
- ¿Cómo funciona su rubro? Usá lo que sabés del rubro para decir algo concreto y útil. Ejemplos del tono buscado (no los copies):
  · ferretería: "en ferreterías el margen se suele ir en dos lugares: mercadería que no rota y gremios que compran en cuenta corriente y pagan cuando pueden".
  · estudio o consultora: "en servicios el costo es casi todo sueldos, así que la clave es cuánto tardan en pagarte los abonos y qué clientes te dejan margen".
  · distribuidora: "en distribución se gana por volumen con margen finito: dos clientes que pagan a 90 días te pueden comer la ganancia del mes".
  · coworking: "con el alquiler del edificio fijo, cada oficina vacía o cada cliente que paga tarde pega directo en el resultado".
- Nunca inventes números, porcentajes ni datos de su empresa: hablá de cómo suele pasar en su rubro, no de lo que le pasa a él.

Cómo responder:
- Español rioplatense, cálido, directo y con oficio: como un buen CFO que habla simple. Nada de frases de folleto ("¡Perfecto!", "excelente pregunta"), nada de tecnicismos innecesarios.
- "reply": 2 o 3 oraciones, entre 35 y 70 palabras. 1) Mostrá que entendiste su situación con un dato concreto de su rubro. 2) Decí qué le vas a mostrar y por qué le cambia algo. No enumeres todas las secciones: se muestran como tarjetas aparte.
- "modules": la lista COMPLETA de ids que proponés (incluí siempre "dash"). Entre 3 y 7. Elegí las que de verdad le sirven a SU negocio (ej. stock solo si vende productos; retención si tiene clientes que compran seguido). Respetá lo que ya eligió (te paso la lista) salvo que pida sacar algo.
- "why": para cada id propuesto, un motivo de 3 a 8 palabras pensado para su negocio, no genérico (ej. "para ver qué gremio te debe y desde cuándo").
- "custom": cosas que pidió y que NO están en el catálogo, en 2 a 5 palabras cada una (ej. "liquidación de sueldos"). No las prometas: se anotan como pedido especial.
- "question": UNA pregunta corta e inteligente, de las que hace un CFO y cuya respuesta cambia lo que le conviene ver. Mejor que "¿cuántas personas son?". Ejemplos: "¿Vendés más de contado o con cuenta corriente?", "¿Tu Colppy tiene cargado el stock?", "¿Tenés socios a los que les tengas que rendir cuentas?", "¿Qué te preocupa más hoy: vender más o que te alcance la plata?". Si todavía no sabés el rubro, preguntá eso primero. Nunca repitas una pregunta que ya hiciste: si no te la contestó, no insistas. Si ya tenés lo necesario, dejala vacía.
- Si te hace una pregunta a vos (ej. "¿qué me recomendás?"), respondela de verdad en "reply" con criterio de CFO y después proponé las secciones.
- "profile": lo que sepas del negocio: {"rubro": "...", "tamano": "...", "demo": "..."} (vacío si no sabés). En "demo" poné la empresa de ejemplo que más se parece a su negocio, una de: ${RUBRO_KEYS.map((k) => `${k} (${DEMO_PROFILES[k].label})`).join(", ")}. Por ejemplo una ferretería, un quiosco o un local → comercio; un estudio, una agencia o una clínica → servicios.
- Nunca inventes funciones que no estén en el catálogo, ni precios, ni plazos.
- Si escribe algo que no tiene que ver con su empresa, respondé amable en una oración y volvé a preguntarle qué quiere ver de su negocio.

Respondé SOLO con un JSON válido, sin texto antes ni después:
{"reply": "...", "modules": ["dash", ...], "why": {"id": "motivo"}, "custom": ["..."], "question": "...", "profile": {"rubro": "...", "tamano": "...", "demo": "..."}}`;

/** Diagnóstico: abrir /api/onboarding/chat en el navegador dice si la clave está, qué modelo usa y si Anthropic responde. */
export async function GET(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  const out: Record<string, unknown> = { clave: key ? `cargada (${key.slice(0, 7)}…, ${key.length} caracteres)` : "FALTA: cargá ANTHROPIC_API_KEY en las variables", modelo: MODEL };
  if (key) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (!allowed(ip)) return Response.json({ ...out, prueba: "límite de pruebas alcanzado, esperá una hora" });
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 5, messages: [{ role: "user", content: "Decí hola" }] }), signal: AbortSignal.timeout(20_000),
      });
      out.prueba = r.ok ? "OK: Claude responde" : `ERROR ${r.status}: ${(await r.text()).slice(0, 300)}`;
    } catch (e) { out.prueba = `ERROR de conexión: ${e instanceof Error ? e.message : String(e)}`; }
  }
  return Response.json(out);
}

export async function POST(req: Request) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return Response.json({ fallback: true });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (!allowed(ip)) { console.warn("[onboarding/chat] límite por IP", ip); return Response.json({ fallback: true, reason: "limite" }); }
    const p = Body.safeParse(await req.json());
    if (!p.success) return Response.json({ fallback: true });
    const { messages, chosen = [] } = p.data;

    const convo = messages.map((m) => ({ role: m.role, content: m.text }));
    convo[convo.length - 1] = { role: "user", content: `${convo[convo.length - 1].content}\n\n(Secciones elegidas hasta ahora: ${chosen.length ? chosen.join(", ") : "ninguna"})` };
    // Hasta 2 intentos: si la IA tarda o no devuelve un JSON válido, se reintenta una vez antes de caer a las palabras clave
    let o: Record<string, unknown> | null = null, fail = "";
    for (let attempt = 0; attempt < 2 && !o; attempt++) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: SYSTEM, messages: convo }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) { fail = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; continue; }
        const j = await res.json();
        const text: string = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) { fail = "sin JSON"; continue; }
        o = JSON.parse(match[0]) as Record<string, unknown>;
      } catch (e) { fail = e instanceof Error ? e.message : String(e); }
    }
    if (!o) { console.error("[onboarding/chat] respaldo:", fail); return Response.json({ fallback: true, reason: fail.slice(0, 120) }); }
    const ids = new Set(OB_MODULES.map((m) => m.id));
    const modules = Array.from(new Set(["dash", ...(Array.isArray(o.modules) ? o.modules.map(String) : [])])).filter((x) => ids.has(x));
    const whyIn = (o.why && typeof o.why === "object" ? o.why : {}) as Record<string, unknown>;
    const why = Object.fromEntries(modules.filter((m) => whyIn[m]).map((m) => [m, String(whyIn[m]).slice(0, 70)]));
    const custom = (Array.isArray(o.custom) ? o.custom.map(String) : []).map((x) => x.trim().slice(0, 42)).filter(Boolean).slice(0, 4);
    const prof = (o.profile && typeof o.profile === "object" ? o.profile : {}) as Record<string, unknown>;
    return Response.json({
      reply: String(o.reply ?? "").slice(0, 700), modules, why, custom,
      question: String(o.question ?? "").slice(0, 200),
      profile: {
        rubro: prof.rubro ? String(prof.rubro).slice(0, 60) : null, tamano: prof.tamano ? String(prof.tamano).slice(0, 60) : null,
        demo: isRubro(prof.demo) ? prof.demo : prof.rubro ? rubroFromText(String(prof.rubro)) : null,
      },
    });
  } catch (e) {
    console.error("[onboarding/chat]", e);
    return Response.json({ fallback: true });
  }
}

export const dynamic = "force-dynamic";
