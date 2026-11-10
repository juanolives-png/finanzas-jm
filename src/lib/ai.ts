// ─── La IA propone categorías para las cuentas que la plantilla no resolvió ──
// Usa la API de Anthropic (ANTHROPIC_API_KEY). No confirma nada: propone con un motivo corto,
// y el cliente decide. Se le pasan también las cuentas YA confirmadas como ejemplo del criterio de la empresa.
import { CATEGORIES, CATEGORY_KEYS, type Category } from "./categories";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export type AiInput = { code: string; name: string; amount12m: number };
export type AiOutput = { code: string; category: Category; reason: string };

export async function suggestCategories(accounts: AiInput[], examples: { code: string; name: string; category: string }[]): Promise<AiOutput[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY en el servidor para usar la IA");
  if (!accounts.length) return [];

  const cats = CATEGORY_KEYS.map((k) => `- ${k}: ${CATEGORIES[k].label}. ${CATEGORIES[k].help}`).join("\n");
  const prompt = `Sos el CFO de una pyme argentina. Clasificá cada cuenta contable de su plan de cuentas (Colppy) en UNA categoría de gestión.

Categorías posibles:
${cats}

Pistas: el código empieza con 1 (activo), 2 (pasivo), 3 (patrimonio neto), 4 (ingresos), 5 o 6 (egresos).
"Costos operativos" es lo directamente ligado a vender o prestar el servicio; "Estructura" es lo fijo de la empresa.

Criterio que esta empresa ya confirmó (respetalo y mantené coherencia):
${examples.slice(0, 60).map((e) => `${e.code} ${e.name} → ${e.category}`).join("\n") || "(todavía ninguno)"}

Cuentas a clasificar (código, nombre, movimiento de los últimos 12 meses en pesos):
${accounts.map((a) => `${a.code} | ${a.name} | ${Math.round(a.amount12m)}`).join("\n")}

Respondé SOLO un JSON: un array de objetos {"code": "...", "category": "UNA_DE_LAS_CLAVES", "reason": "motivo en 10 palabras o menos"}.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`La IA respondió con error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text: string = (j.content ?? []).map((c: any) => c.text ?? "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("La IA no devolvió una lista válida");
  const parsed = JSON.parse(match[0]) as { code: string; category: string; reason?: string }[];
  const valid = new Set(accounts.map((a) => a.code));
  return parsed
    .filter((p) => valid.has(String(p.code)) && (CATEGORY_KEYS as string[]).includes(p.category))
    .map((p) => ({ code: String(p.code), category: p.category as Category, reason: String(p.reason ?? "").slice(0, 120) }));
}
