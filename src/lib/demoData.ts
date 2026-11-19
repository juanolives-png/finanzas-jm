// ─── Empresa demo: los datos ────────────────────────────────────────────────────────────
// "Distribuidora del Sol (demo)": una distribuidora de almacén y bebidas con 13 meses de números
// inventados pero coherentes (ventas, cobros, compras, pagos, sueldos, impuestos, stock).
// Sirve para mostrar Numo en una charla sin exponer datos de nadie, y para que quien se registra
// recorra su sistema antes de conectar Colppy. Todo se arma con fechas relativas a hoy, así que
// "Actualizar" la vuelve a generar al día. No toca Colppy ni manda mails.
import { Prisma } from "@prisma/client";

export const DEMO_NAME = "Distribuidora del Sol (demo)";

// ── Azar con semilla: la demo da siempre los mismos números ──
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const DAY = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

// ── Plan de cuentas ──
export const ACCOUNTS: { code: string; name: string; category: string; typeName: string }[] = [
  { code: "111101", name: "Caja", category: "CAJA_BANCO", typeName: "Activo" },
  { code: "111201", name: "Banco Galicia cuenta corriente", category: "CAJA_BANCO", typeName: "Activo" },
  { code: "111202", name: "Banco Nación cuenta corriente", category: "CAJA_BANCO", typeName: "Activo" },
  { code: "111301", name: "Mercado Pago", category: "CAJA_BANCO", typeName: "Activo" },
  { code: "113100", name: "Deudores por ventas", category: "PATRIMONIAL", typeName: "Activo" },
  { code: "114100", name: "IVA crédito fiscal", category: "PATRIMONIAL", typeName: "Activo" },
  { code: "151100", name: "Rodados", category: "INVERSION", typeName: "Activo" },
  { code: "211100", name: "Proveedores", category: "PATRIMONIAL", typeName: "Pasivo" },
  { code: "212100", name: "Préstamo Banco Nación", category: "PATRIMONIAL", typeName: "Pasivo" },
  { code: "213100", name: "IVA débito fiscal", category: "PATRIMONIAL", typeName: "Pasivo" },
  { code: "311100", name: "Capital social", category: "PATRIMONIAL", typeName: "Patrimonio" },
  { code: "411100", name: "Ventas mayoristas", category: "INGRESO", typeName: "Ingreso" },
  { code: "411200", name: "Ventas minoristas", category: "INGRESO", typeName: "Ingreso" },
  { code: "511100", name: "Costo de mercadería vendida", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "511200", name: "Fletes", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "511300", name: "Comisiones de vendedores", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "521100", name: "Sueldos y cargas depósito", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "521200", name: "Alquiler depósito", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "521300", name: "Servicios (luz, gas, agua)", category: "COSTO_VARIABLE", typeName: "Egreso" },
  { code: "531100", name: "Sueldos administración y dirección", category: "ESTRUCTURA", typeName: "Egreso" },
  { code: "531200", name: "Honorarios contables", category: "ESTRUCTURA", typeName: "Egreso" },
  { code: "531300", name: "Marketing y publicidad", category: "ESTRUCTURA", typeName: "Egreso" },
  { code: "531400", name: "Software y sistemas", category: "ESTRUCTURA", typeName: "Egreso" },
  { code: "541100", name: "Ingresos brutos", category: "IMPUESTO", typeName: "Egreso" },
  { code: "541200", name: "Impuesto débitos y créditos (ley 25413)", category: "IMPUESTO", typeName: "Egreso" },
  { code: "551100", name: "Comisiones bancarias", category: "FINANCIERO", typeName: "Egreso" },
  { code: "551200", name: "Intereses préstamo", category: "FINANCIERO", typeName: "Egreso" },
];

// ── Clientes: peso en las ventas, letra de factura y cuántos días tarda en pagar después del vencimiento ──
export const CLIENTS: { name: string; w: number; letter: "A" | "B"; delay: number; city: string }[] = [
  { name: "Supermercado La Esquina", w: 14, letter: "A", delay: 9, city: "San Isidro" },
  { name: "Autoservicio El Trébol", w: 11, letter: "A", delay: 3, city: "Pilar" },
  { name: "Súper Familia", w: 10, letter: "A", delay: 2, city: "Luján" },
  { name: "Almacén Don Tito", w: 3, letter: "A", delay: 124, city: "Merlo" },
  { name: "Proveeduría San José", w: 7, letter: "A", delay: 0, city: "Mercedes" },
  { name: "Mini Market Belgrano", w: 6, letter: "A", delay: 6, city: "CABA" },
  { name: "Market Plaza", w: 6, letter: "A", delay: 1, city: "Escobar" },
  { name: "Restaurante La Parrilla de Pepe", w: 4, letter: "A", delay: 28, city: "Tigre" },
  { name: "Hotel Los Pinos", w: 5, letter: "A", delay: 4, city: "Pinamar" },
  { name: "Autoservicio Norte", w: 5, letter: "A", delay: 2, city: "Zárate" },
  { name: "Despensa Mariló", w: 3, letter: "B", delay: 64, city: "Moreno" },
  { name: "Almacén Rivadavia", w: 4, letter: "B", delay: 5, city: "Haedo" },
  { name: "Cafetería Central", w: 3, letter: "A", delay: 7, city: "CABA" },
  { name: "Bar El Encuentro", w: 2, letter: "B", delay: 95, city: "Morón" },
  { name: "Kiosco Los Andes", w: 3, letter: "B", delay: 4, city: "Ituzaingó" },
  { name: "Maxikiosco 24", w: 2, letter: "B", delay: 8, city: "Castelar" },
  { name: "Almacén La Abuela", w: 2, letter: "B", delay: 21, city: "Lomas de Zamora" },
  { name: "Despensa Las Lilas", w: 2, letter: "B", delay: 1, city: "Banfield" },
  { name: "Kiosco El Faro", w: 2, letter: "B", delay: 3, city: "Quilmes" },
  { name: "Club Barrio Sur", w: 2, letter: "A", delay: 45, city: "Avellaneda" },
];

// ── Proveedores: qué cuenta pagan, cuánto (fijo mensual o % de las ventas) y cómo se les paga ──
type Sup = { name: string; account: string; share?: number; fixed?: number; inv: number; term: number; delay: number; city: string };
export const SUPPLIERS: Sup[] = [
  { name: "Alimentos Pampa Sur SA", account: "511100", share: 0.21, inv: 3, term: 30, delay: 2, city: "Rosario" },
  { name: "Bebidas del Litoral SRL", account: "511100", share: 0.16, inv: 3, term: 30, delay: 5, city: "Paraná" },
  { name: "Distribuidora Cuyo Norte SA", account: "511100", share: 0.11, inv: 2, term: 45, delay: 0, city: "Mendoza" },
  { name: "Golosinas Aurora SA", account: "511100", share: 0.08, inv: 2, term: 30, delay: 9, city: "Córdoba" },
  { name: "Limpieza Total SRL", account: "511100", share: 0.06, inv: 2, term: 15, delay: 3, city: "La Plata" },
  { name: "Transportes Ruta 8 SRL", account: "511200", share: 0.04, inv: 2, term: 15, delay: 4, city: "Pilar" },
  { name: "Inmobiliaria Centro Norte", account: "521200", fixed: 4_200_000, inv: 1, term: 10, delay: 0, city: "Pilar" },
  { name: "Servicios Energéticos Pilar", account: "521300", fixed: 1_600_000, inv: 1, term: 15, delay: 0, city: "Pilar" },
  { name: "Estudio Contable Ferreyra y Asoc.", account: "531200", fixed: 1_300_000, inv: 1, term: 10, delay: 6, city: "CABA" },
  { name: "Agencia Creativa Lumen", account: "531300", fixed: 2_100_000, inv: 1, term: 30, delay: 12, city: "CABA" },
  { name: "Gestión Nube SA (sistemas)", account: "531400", fixed: 650_000, inv: 1, term: 5, delay: 0, city: "CABA" },
];

const ITEMS: [string, string, number, number, number][] = [
  // nombre, unidad, costo, margen, stock relativo al mínimo (0 = sin stock, <1 = bajo mínimo)
  ["Aceite de girasol 1,5 L", "caja x12", 28_400, 0.24, 2.4], ["Yerba mate 1 kg", "bulto x10", 41_800, 0.22, 1.8],
  ["Fideos secos 500 g", "caja x20", 19_600, 0.27, 3.1], ["Arroz largo fino 1 kg", "bulto x10", 15_900, 0.25, 0.6],
  ["Azúcar 1 kg", "bulto x10", 11_200, 0.2, 2.2], ["Harina 000 1 kg", "bulto x10", 8_900, 0.21, 1.4],
  ["Gaseosa cola 2,25 L", "pack x8", 17_300, 0.26, 2.9], ["Agua mineral 2 L", "pack x6", 6_400, 0.33, 4.0],
  ["Cerveza lata 473 ml", "pack x24", 31_500, 0.24, 0.4], ["Vino tinto 750 ml", "caja x6", 22_800, 0.3, 1.7],
  ["Leche larga vida 1 L", "caja x12", 13_900, 0.18, 0], ["Café molido 500 g", "caja x10", 54_000, 0.29, 1.3],
  ["Puré de tomate 520 g", "caja x24", 16_700, 0.26, 2.6], ["Atún en lata 170 g", "caja x24", 47_200, 0.28, 0.8],
  ["Galletitas surtidas 400 g", "caja x20", 23_600, 0.3, 3.4], ["Dulce de leche 400 g", "caja x12", 19_100, 0.27, 1.1],
  ["Mermelada 454 g", "caja x12", 15_400, 0.29, 2.0], ["Alfajor triple", "caja x24", 18_900, 0.35, 0.5],
  ["Caramelos surtidos 1 kg", "bolsa", 6_900, 0.4, 3.0], ["Jugo en polvo", "caja x20", 5_300, 0.38, 2.7],
  ["Lavandina 1 L", "caja x12", 7_800, 0.31, 1.9], ["Detergente 750 ml", "caja x12", 14_600, 0.29, 0],
  ["Papel higiénico x4", "bulto x12", 21_300, 0.25, 2.3], ["Jabón en polvo 800 g", "caja x10", 26_900, 0.27, 1.5],
];

/** Arma todos los datos de la demo (sin tocar la base). Lo usan seedDemo y la vista previa del inicio. */
export function buildDemo(companyId: string) {
  const R = rng(20261118);
  const between = (a: number, b: number) => a + R() * (b - a);
  const t = new Date(Date.now() - 3 * 3_600_000);
  const today = utc(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const first = utc(today.getUTCFullYear(), today.getUTCMonth() - 12, 1);

  const entries: Prisma.LedgerEntryCreateManyInput[] = [];
  const docs: Prisma.DocCreateManyInput[] = [];
  let seq = 0;
  const line = (date: Date, account: string, dc: "D" | "C", amount: number, src: string, srcId: string | null, contactType: string | null, contactId: string | null) =>
    entries.push({ companyId, colppyId: `demo-${++seq}`, date, account, dc, amount: r2(amount), subdiario: null, contactId, cc1: null, cc2: null, srcTable: src, srcId, contactType });
  const ivaBy = new Map<string, number>(); // mes → IVA débito − crédito
  const ivaAdd = (d: Date, v: number) => { const k = d.toISOString().slice(0, 7); ivaBy.set(k, (ivaBy.get(k) ?? 0) + v); };

  // Saldo inicial: bancos, lo que ya debían los clientes y lo que se debía a proveedores (se cobra y paga el primer mes)
  const OPEN_DEUD = 235_000_000, OPEN_PROV = 112_000_000;
  line(first, "111201", "D", 58_000_000, "AS", null, null, null);
  line(first, "111202", "D", 42_000_000, "AS", null, null, null);
  line(first, "111101", "D", 600_000, "AS", null, null, null);
  line(first, "113100", "D", OPEN_DEUD, "AS", null, null, null);
  line(first, "211100", "C", OPEN_PROV, "AS", null, null, null);
  line(first, "311100", "C", 58_000_000 + 42_000_000 + 600_000 + OPEN_DEUD - OPEN_PROV, "AS", null, null, null);
  for (const [d, part] of [[8, 0.4], [18, 0.35], [32, 0.25]] as const) { const date = addDays(first, d); line(date, "111201", "D", OPEN_DEUD * part, "COB", null, null, null); line(date, "113100", "C", OPEN_DEUD * part, "COB", null, null, null); }
  for (const [d, part] of [[10, 0.5], [26, 0.5]] as const) { const date = addDays(first, d); line(date, "211100", "D", OPEN_PROV * part, "OP", null, null, null); line(date, "111201", "C", OPEN_PROV * part, "OP", null, null, null); }

  const wSum = CLIENTS.reduce((s, c) => s + c.w, 0);
  let nroV = 12480, nroC = 0;
  for (let i = 0; i <= 12; i++) {
    const y = first.getUTCFullYear(), mo = first.getUTCMonth() + i;
    const start = utc(y, mo, 1), dim = utc(y, mo + 1, 0).getUTCDate();
    const lastDay = i === 12 ? today.getUTCDate() : dim;
    const month = start.getUTCMonth();
    const season = month === 11 ? 1.28 : month === 0 ? 0.84 : month === 1 ? 0.9 : month === 6 ? 1.08 : 1;
    const infl = Math.pow(1.022, i);
    const S = 152_000_000 * infl * season * (1 + (R() - 0.5) * 0.06) * (lastDay / dim); // ventas netas del mes
    const day = (min = 1, max = lastDay) => utc(y, mo, Math.max(1, Math.min(lastDay, Math.round(between(min, max)))));
    const ok = (d: Date) => d.getTime() <= today.getTime();

    // ── Ventas y cobranzas ──
    CLIENTS.forEach((c, ci) => {
      const pid = `demo-c${ci + 1}`;
      const share = (S * c.w) / wSum;
      const n = c.w >= 8 ? 3 : c.w >= 4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const neto = r2((share / n) * between(0.8, 1.2));
        const iva = r2(neto * 0.21), total = r2(neto + iva);
        const date = day(1 + (k * lastDay) / n, ((k + 1) * lastDay) / n);
        const due = addDays(date, 30);
        const pay = addDays(due, Math.max(-5, c.delay + Math.round(between(-4, 8))));
        const colppyId = `demo-fv-${++nroV}`;
        const paid = ok(pay);
        docs.push({ companyId, kind: "venta", colppyId, partyId: pid, partyName: c.name, docType: "FAV", letter: c.letter, cae: "demo",
          number: `0003-${String(nroV).padStart(8, "0")}`, date, dueDate: due, description: "Mercadería según remito", total, applied: paid ? total : 0, pending: paid ? 0 : total });
        line(date, "113100", "D", total, "FV", colppyId, "2", pid);
        line(date, c.letter === "A" ? "411100" : "411200", "C", neto, "FV", colppyId, "2", pid);
        line(date, "213100", "C", iva, "FV", colppyId, "2", pid);
        ivaAdd(date, iva);
        if (paid) {
          const bank = c.letter === "B" ? "111301" : "111201";
          line(pay, bank, "D", total, "COB", colppyId, "2", pid);
          line(pay, "113100", "C", total, "COB", colppyId, "2", pid);
        }
      }
    });
    // Mercado Pago → banco, una vez por mes (transferencia entre cuentas propias)
    const mp = entries.filter((e) => e.account === "111301" && e.dc === "D" && (e.date as Date) >= start && (e.date as Date) <= utc(y, mo, lastDay)).reduce((s, e) => s + Number(e.amount), 0);
    if (mp > 0 && lastDay >= 25) { const d = utc(y, mo, 25); line(d, "111201", "D", mp * 0.95, "AS", null, null, null); line(d, "111301", "C", mp * 0.95, "AS", null, null, null); }

    // ── Compras y pagos a proveedores ──
    SUPPLIERS.forEach((s, si) => {
      const pid = `demo-p${si + 1}`;
      const base = s.fixed ? s.fixed * infl : S * (s.share ?? 0) * between(0.92, 1.08);
      if (s.fixed && lastDay < 5) return;
      for (let k = 0; k < s.inv; k++) {
        const neto = r2((base / s.inv) * between(0.85, 1.15));
        const iva = r2(neto * 0.21), total = r2(neto + iva);
        const date = s.fixed ? day(1, Math.min(5, lastDay)) : day(1 + (k * lastDay) / s.inv, ((k + 1) * lastDay) / s.inv);
        const due = addDays(date, s.term);
        const pay = addDays(due, s.delay + Math.round(between(0, 4)));
        const colppyId = `demo-fc-${++nroC}`;
        const paid = ok(pay);
        docs.push({ companyId, kind: "compra", colppyId, partyId: pid, partyName: s.name, docType: "FAC", letter: "A", cae: "demo",
          number: `00${String(2 + (si % 7)).padStart(2, "0")}-${String(4100 + nroC * 7).padStart(8, "0")}`, date, dueDate: due,
          description: ACCOUNTS.find((a) => a.code === s.account)!.name, total, applied: paid ? total : 0, pending: paid ? 0 : total });
        line(date, s.account, "D", neto, "FC", colppyId, "3", pid);
        line(date, "114100", "D", iva, "FC", colppyId, "3", pid);
        line(date, "211100", "C", total, "FC", colppyId, "3", pid);
        ivaAdd(date, -iva);
        if (paid) { line(pay, "211100", "D", total, "OP", colppyId, "3", pid); line(pay, "111201", "C", total, "OP", colppyId, "3", pid); }
      }
    });

    // ── Asientos manuales: sueldos, impuestos, banco, préstamo ──
    const manual = (d: number, account: string, amount: number, bank = "111201") => {
      if (d > lastDay) return;
      const date = utc(y, mo, d);
      line(date, account, "D", amount, "AS", null, null, null); line(date, bank, "C", amount, "AS", null, null, null);
    };
    // Sueldos al cierre de cada mes (con aguinaldo en junio y diciembre)
    manual(dim, "521100", 12_400_000 * infl * (month === 11 || month === 5 ? 1.5 : 1));
    manual(dim, "531100", 7_900_000 * infl * (month === 11 || month === 5 ? 1.5 : 1));
    manual(10, "511300", S * 0.025);
    manual(15, "541100", S * 0.035);
    manual(Math.min(28, lastDay), "541200", S * 0.011);
    manual(Math.min(28, lastDay), "551100", 340_000 * infl, "111202");
    manual(10, "551200", 880_000 * Math.pow(0.97, i), "111202");
    manual(10, "212100", 1_500_000, "111202");
    if (i === 7) manual(12, "151100", 18_500_000);
    // IVA del mes anterior, el 18
    const prevKey = utc(y, mo - 1, 1).toISOString().slice(0, 7);
    const ivaPrev = ivaBy.get(prevKey) ?? 0;
    if (i > 0 && ivaPrev > 0) manual(18, "213100", ivaPrev);
  }
  // Los manuales con importe 0 (comisiones del mes en curso) no se guardan
  const ledger = entries.filter((e) => Number(e.amount) > 0);

  const parties: Prisma.PartyCreateManyInput[] = [
    ...CLIENTS.map((c, i) => ({ companyId, kind: "cliente", colppyId: `demo-c${i + 1}`, name: c.name, cuit: `30-7${String(1_000_000 + i * 37_129).slice(0, 7)}-${i % 10}`,
      email: `administracion@${c.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 18)}.example`, phone: null, address: `Calle ${12 + i} n.º ${300 + i * 17}`, city: c.city, province: c.city === "CABA" ? "CABA" : "Buenos Aires",
      ivaCondition: c.letter === "A" ? "Responsable Inscripto" : "Monotributo", contactAt: new Date() })),
    ...SUPPLIERS.map((s, i) => ({ companyId, kind: "proveedor", colppyId: `demo-p${i + 1}`, name: s.name, cuit: `30-6${String(2_000_000 + i * 51_377).slice(0, 7)}-${(i + 3) % 10}`,
      email: `cobranzas@${s.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 18)}.example`, phone: null, address: `Ruta ${i + 3} km ${40 + i * 5}`, city: s.city, province: "—",
      ivaCondition: "Responsable Inscripto", contactAt: new Date() })),
  ];
  const items: Prisma.ItemCreateManyInput[] = [
    ...ITEMS.map(([name, unit, cost, margin, rel], i) => {
      const minimum = 20 + (i % 5) * 10;
      return { companyId, colppyId: `demo-i${i + 1}`, code: `A${String(101 + i)}`, name, kind: "P", unit, stock: Math.round(minimum * rel), minimum, cost, lastPurchase: Math.round(cost * 1.04), price: Math.round(cost * (1 + margin)), iva: "21", category: i >= 20 ? "Limpieza" : i >= 6 && i <= 10 ? "Bebidas" : "Almacén", active: true };
    }),
    { companyId, colppyId: "demo-s1", code: "S01", name: "Flete a domicilio", kind: "S", unit: "viaje", stock: 0, minimum: null, cost: 0, lastPurchase: 0, price: 18_000, iva: "21", category: "Servicios", active: true },
  ];

  const accounts = ACCOUNTS.map((a) => ({ companyId, code: a.code, name: a.name, typeName: a.typeName, category: a.category, debitOnly: false, source: "plantilla", confirmed: true }));
  return { today, accounts, ledger, docs, parties, items };
}
