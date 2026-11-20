// Módulos que el cliente puede elegir en el inicio ("¿Qué querés ver de tu empresa?").
// Hoy se detectan por palabras clave; más adelante se puede sumar la IA para entender cualquier forma de pedirlo.

export type ObModule = { id: string; label: string; kw: string[]; nav?: string[]; custom?: boolean };

export const OB_MODULES: ObModule[] = [
  { id: "dash", label: "Dashboard financiero", kw: ["dashboard", "tablero", "resumen", "indicador", "kpi", "panorama", "como esta", "general"], nav: ["tablero"] },
  { id: "pyl", label: "Estado de resultados (P&L)", kw: ["p&l", "pyl", "p y l", "resultado", "ganancia", "rentab", "margen", "ebitda", "gano"], nav: ["resultados"] },
  { id: "caja", label: "Caja y proyección", kw: ["caja", "cashflow", "cash flow", "flujo", "liquidez", "banco", "plata", "efectivo", "fin de mes"], nav: ["cashflow"] },
  { id: "cli", label: "Clientes y cobranzas", kw: ["cobranza", "cobrar", "cliente", "deben", "deuda", "moros", "reclam", "atras"], nav: ["deuda-clientes", "cobranzas"] },
  { id: "ret", label: "Retención y churn de clientes", kw: ["churn", "retencion", "recompra", "clientes perdidos", "perdi clientes", "clientes perdi", "clientes se fueron", "dejo de comprar", "fideliz", "ltv", "dejaron de comprar", "cartera"], nav: ["cartera"] },
  { id: "fac", label: "Facturación", kw: ["factur", "emitir", "comprobante"], nav: ["facturacion"] },
  { id: "prov", label: "Proveedores y pagos", kw: ["proveedor", "pagar", "pagos", "orden de pago", "compras", "vencimiento"], nav: ["deuda-proveedores", "pagos"] },
  { id: "iva", label: "IVA e impuestos", kw: ["iva", "impuesto", "afip", "arca", "iibb", "ingresos brutos"], nav: ["iva"] },
  { id: "soc", label: "Reporte a socios", kw: ["socio", "reporte", "directorio", "informe", "accionista"], nav: ["reporte-socios"] },
  { id: "ppto", label: "Presupuesto y objetivos", kw: ["presupuesto", "objetivo", "meta", "budget"], nav: ["presupuesto"] },
  { id: "ia", label: "Asistente con IA", kw: ["preguntarle", "asistente", " ia ", " ia,", "inteligencia artificial", "chat"], nav: ["asistente"] },
  { id: "stock", label: "Stock e inventario", kw: ["stock", "inventario", "mercaderia", "productos", "reponer", "deposito", "existencia"], nav: ["stock"] },
  { id: "cap", label: "Capital de trabajo", kw: ["capital de trabajo", "working capital", "capital operativo", "activo corriente", "pasivo corriente", "liquidez corriente"], nav: ["tablero"] },
  { id: "ciclo", label: "Ciclo de la plata (días de cobro y pago)", kw: ["dias de cobro", "dias de pago", "ciclo", "rotacion", "cuanto tardo en cobrar", "me pagan", "tardan en pagar"], nav: ["cartera"] },
  { id: "eq", label: "Punto de equilibrio", kw: ["equilibrio", "break even", "cuanto tengo que vender", "cuanto necesito vender"], nav: ["tablero"] },
];
export const OB_DEFAULT = ["dash", "pyl", "caja", "cli", "prov"];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const detectModules = (text: string) => {
  const n = " " + norm(text) + " ";
  return OB_MODULES.filter((m) => m.kw.some((k) => n.includes(norm(k)))).map((m) => m.id);
};

/** Slugs del menú que corresponden a los módulos elegidos (null = mostrar todo). */
export function navSlugsFor(modules: unknown): Set<string> | null {
  if (!Array.isArray(modules) || !modules.length) return null;
  const s = new Set<string>(["tablero"]);
  for (const id of modules) OB_MODULES.find((m) => m.id === id)?.nav?.forEach((x) => s.add(x));
  return s;
}

export const OB_STORAGE = "numo-onboarding";
