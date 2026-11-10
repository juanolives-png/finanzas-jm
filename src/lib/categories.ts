// ─── Categorías de cuentas: el criterio de CFO de cada empresa ───────────────
// Colppy trae bien los asientos, pero no sabe qué es costo variable, qué es estructura, qué es financiero
// o qué es el circuito de IVA. Eso es criterio de CFO y cambia en cada empresa. Por eso:
//   1. Una PLANTILLA propone la categoría de cada cuenta (por nombre y por código).
//   2. Lo que la plantilla no resuelve, lo propone la IA.
//   3. El cliente revisa y confirma. Lo confirmado no se vuelve a tocar.
// Ninguna cuenta con movimientos se pierde: lo que no tiene categoría se avisa en el tablero.

export const CATEGORIES = {
  INGRESO: { label: "Ingresos", help: "Ventas y otros ingresos del negocio", result: true },
  COSTO_VARIABLE: { label: "Costos operativos", help: "Lo que cuesta producir o prestar el servicio: alquileres, sueldos operativos, servicios, insumos", result: true },
  ESTRUCTURA: { label: "Estructura", help: "Costos fijos de la empresa: dirección, marketing, contable y legal", result: true },
  IMPUESTO: { label: "Impuestos", help: "IIBB, débitos y créditos, tasas, planes de pago", result: true },
  FINANCIERO: { label: "Financieros", help: "Comisiones bancarias, intereses, préstamos, diferencia de cambio", result: true },
  INVERSION: { label: "Inversiones", help: "Obras, mobiliario, equipos: no es gasto del mes, se muestra aparte", result: false },
  CIRCUITO_IVA: { label: "Circuito financiero (IVA)", help: "Ventas financieras y pagos a terceros: plata que entra y sale, no es del negocio", result: false },
  CAJA_BANCO: { label: "Caja y bancos", help: "Caja, bancos, Mercado Pago, FCI: se usa para el cashflow", result: false },
  PATRIMONIAL: { label: "No entra al resultado", help: "Clientes, proveedores, deudas, IVA crédito/débito, capital", result: false },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export type Proposal = { category: Category | null; debitOnly?: boolean; source: "plantilla" | "regla" };

/** Mayúsculas, sin acentos, sin espacios repetidos (igual que en Huerta). */
export function normalize(name: unknown) {
  return String(name ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

// ── Plantilla "Coworking — criterio Juan Olives" ─────────────────────────────
// Copiada tal cual de huerta-dashboard2/src/lib/cuentasColppy.ts y cuentasPatrimoniales.ts.
// Con esta plantilla, Huerta tiene que dar igual que su dashboard.
const COWORKING_BY_NAME: Record<string, Category> = {
  // Ingresos
  "OFICINAS": "INGRESO", "FLEX EMPRESAS": "INGRESO", "FLEX": "INGRESO", "DESK": "INGRESO", "SALAS": "INGRESO",
  "EVENTOS": "INGRESO", "INGRESOS COMUNIDAD": "INGRESO", "OTROS INGRESOS": "INGRESO", "SPONSORS": "INGRESO",
  "REDONDEO POR VENTAS": "INGRESO",
  // Circuito de IVA (financiero)
  "VENTAS FINANCIERAS": "CIRCUITO_IVA", "PAGOS A TERCEROS": "CIRCUITO_IVA",
  // Costos variables por sede
  "CARGAS SOCIALES": "COSTO_VARIABLE", "BENEFICIOS CORPORATIVOS": "COSTO_VARIABLE", "INSUMOS": "COSTO_VARIABLE",
  "VIATICOS Y MOVILIDAD": "COSTO_VARIABLE", "SEGUROS": "COSTO_VARIABLE", "SERVICIOS": "COSTO_VARIABLE",
  "ALQUILERES": "COSTO_VARIABLE", "EXPENSAS": "COSTO_VARIABLE", "CMV EVENTOS": "COSTO_VARIABLE",
  "MANTENIMIENTO GENERAL": "COSTO_VARIABLE", "LIMPIEZA": "COSTO_VARIABLE", "INTERNET": "COSTO_VARIABLE",
  "COSTO DE MERCADERIA VENDIDA": "COSTO_VARIABLE", "COMUNIDAD": "COSTO_VARIABLE", "PROVEEDORES VARIOS": "COSTO_VARIABLE",
  "SEGURIDAD": "COSTO_VARIABLE", "SERVICIOS PRESTADOS": "COSTO_VARIABLE", "SUELDOS": "COSTO_VARIABLE",
  "SUELDOS EXTERNOS": "COSTO_VARIABLE", "AGUINALDOS": "COSTO_VARIABLE", "DEPOSITOS DEVOLUCION": "COSTO_VARIABLE",
  "MANTENIMIENTO AIRES ACONDICINADO": "COSTO_VARIABLE", "INCENTIVOS COMERCIALES": "COSTO_VARIABLE",
  "PLANTAS Y SUSTENTABILIDAD": "COSTO_VARIABLE", "GASTOS VARIOS DE ADMINISTRACION": "COSTO_VARIABLE",
  "PAPELERIA Y UTILES DE OFICINA": "COSTO_VARIABLE", "INSUMOS ELECTRONICOS HUERTA": "COSTO_VARIABLE",
  "TECNOLOGIA DE PRODUCTO": "COSTO_VARIABLE", "COMISIONES COMERCIALES": "COSTO_VARIABLE",
  // Costos de la marca (estructura)
  "SUELDOS DIRECTIVOS Y EMPLEADOS": "ESTRUCTURA", "MARKETING": "ESTRUCTURA", "CONTABLE, LEGAL Y OTROS": "ESTRUCTURA",
  // Impuestos
  "INGRESOS BRUTOS": "IMPUESTO", "IMPUESTO LEY 25413": "IMPUESTO", "IMPUESTO PAIS": "IMPUESTO",
  "INTERESES AFIP/AGIP": "IMPUESTO", "INTERESES PLAN DE PAGOS AFIP": "IMPUESTO", "INTERESES PLAN DE PAGO AGIP": "IMPUESTO",
  "IMPUESTOS Y TASAS": "IMPUESTO", "IMPUESTO SOBRE LOS BIENES PERSONALES": "IMPUESTO",
  // Financieros (en el criterio de Huerta, inversiones y mobiliario van acá)
  "GASTOS DE COMISION BANCARIA": "FINANCIERO", "COMISIONES TARJETA": "FINANCIERO", "DIFERENCIA DE CAMBIO": "FINANCIERO",
  "INTERESES BANCARIOS": "FINANCIERO", "PRESTAMOS BANCARIOS": "FINANCIERO", "INVERSIONES EN INFRAESTRUCTURA": "FINANCIERO",
  "MOBILIARIO DE OFICINA": "FINANCIERO", "INTERESES": "FINANCIERO", "INCOBRABLES": "FINANCIERO", "PRESTAMOS PERSONALES": "FINANCIERO",
};
/** Cuentas patrimoniales que entran al resultado, y SOLO por el debe (pagar una cuota baja un pasivo, pero la plata sale). */
const COWORKING_DEBIT_ONLY: Record<string, Category> = {
  "214701": "IMPUESTO",   // aportes de obra social (criterio Juan: impuestos, no costo de sede)
  "212100": "FINANCIERO", // préstamo BBVA — capital
  "212200": "FINANCIERO", // préstamo BNA — capital
};

export const TEMPLATES = {
  general: { label: "General (cualquier pyme)", help: "Clasifica por código y nombre de cuenta. Lo dudoso lo propone la IA." },
  coworking: { label: "Coworking — criterio Juan Olives", help: "El criterio del P&L de Huerta Coworking: costos por sede, marca, circuito de IVA y préstamos por el debe." },
} as const;
export type TemplateKey = keyof typeof TEMPLATES;

/** Regla general: código del plan (1 activo, 2 pasivo, 3 patrimonio, 4 ingresos, 5/6 egresos) + palabras del nombre. */
function generalRule(code: string, name: string): Category | null {
  const n = normalize(name);
  const first = code.trim()[0];
  if (first === "1") {
    if (/^111/.test(code) || /\b(CAJA|BANCO|BANCOS|MERCADO ?PAGO|FCI|VALORES A DEPOSITAR|MERCURY|PAYPAL)\b/.test(n)) return "CAJA_BANCO";
    if (/INVERSION|MOBILIARIO|RODADO|EQUIPO|MAQUINARIA|INSTALACION|OBRA/.test(n)) return "INVERSION";
    return "PATRIMONIAL";
  }
  if (first === "2" || first === "3") return "PATRIMONIAL";
  if (first === "4") {
    if (/VENTAS? FINANCIERA/.test(n)) return "CIRCUITO_IVA";
    if (/INTERES|DIFERENCIA DE CAMBIO|FINANCIER|RESULTADO POR TENENCIA/.test(n)) return "FINANCIERO";
    return "INGRESO";
  }
  if (first === "5" || first === "6") {
    if (/PAGOS? A TERCEROS/.test(n)) return "CIRCUITO_IVA";
    if (/INVERSION|MOBILIARIO|OBRA|EQUIPAMIENTO|RODADO/.test(n)) return "INVERSION";
    if (/IMPUESTO|INGRESOS BRUTOS|IIBB|TASA|ABL|SELLOS|LEY 25413|DEBITOS Y CREDITOS|AFIP|ARCA|AGIP|ARBA|BIENES PERSONALES/.test(n)) return "IMPUESTO";
    if (/INTERES|COMISION(ES)? BANCARIA|GASTOS BANCARIOS|COMISIONES TARJETA|FINANCIER|DIFERENCIA DE CAMBIO|PRESTAMO|INCOBRABLE/.test(n)) return "FINANCIERO";
    if (/DIRECTIVO|DIRECTORIO|HONORARIOS|CONTABLE|LEGAL|MARKETING|PUBLICIDAD|SISTEMAS|SOFTWARE/.test(n)) return "ESTRUCTURA";
    if (/COSTO|MERCADER|CMV|SUELDO|CARGAS SOCIALES|ALQUILER|EXPENSA|SERVICIO|INSUMO|LIMPIEZA|FLETE|COMISION/.test(n)) return "COSTO_VARIABLE";
    return null; // egreso que no sabemos ubicar: que lo proponga la IA
  }
  return "PATRIMONIAL";
}

export function propose(template: TemplateKey, code: string, name: string): Proposal {
  if (template === "coworking") {
    const debit = COWORKING_DEBIT_ONLY[code];
    if (debit) return { category: debit, debitOnly: true, source: "plantilla" };
    const byName = COWORKING_BY_NAME[normalize(name)];
    if (byName) return { category: byName, source: "plantilla" };
  }
  return { category: generalRule(code, name), source: "regla" };
}
