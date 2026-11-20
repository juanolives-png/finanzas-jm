// ─── Empresa demo: los datos ────────────────────────────────────────────────────────────
// Una empresa de ejemplo por rubro (demoRubros.ts) con 13 meses de números
// inventados pero coherentes (ventas, cobros, compras, pagos, sueldos, impuestos, stock).
// Sirve para mostrar Numo en una charla sin exponer datos de nadie, y para que quien se registra
// recorra su sistema antes de conectar Colppy. Todo se arma con fechas relativas a hoy, así que
// "Actualizar" la vuelve a generar al día. No toca Colppy ni manda mails.
import { Prisma } from "@prisma/client";
import { profileFor, type DemoProfile } from "./demoRubros";

export const DEMO_NAME = "Distribuidora del Sol (demo)";
export const demoName = (rubro?: string | null) => `${profileFor(rubro).company} (demo)`;

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

// ── Clientes, proveedores y stock: vienen del perfil de cada rubro (demoRubros.ts) ──
export function accountsFor(p: DemoProfile) {
  return ACCOUNTS.map((a) => ({ ...a, name: p.names[a.code] ?? a.name }));
}

/** Arma todos los datos de la demo (sin tocar la base). Lo usan seedDemo y la vista previa del inicio. */
export function buildDemo(companyId: string, rubro?: string | null) {
  const P = profileFor(rubro);
  const CLIENTS = P.clients, SUPPLIERS = P.suppliers, ACC = accountsFor(P);
  const k = P.scale / 152; // tamaño relativo a la distribuidora (saldos, préstamo, gastos bancarios)
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
  const OPEN_DEUD = 235_000_000 * k, OPEN_PROV = 112_000_000 * k * (P.items.length ? 1 : 0.4), B1 = 58_000_000 * k, B2 = 42_000_000 * k;
  line(first, "111201", "D", B1, "AS", null, null, null);
  line(first, "111202", "D", B2, "AS", null, null, null);
  line(first, "111101", "D", 600_000, "AS", null, null, null);
  line(first, "113100", "D", OPEN_DEUD, "AS", null, null, null);
  line(first, "211100", "C", OPEN_PROV, "AS", null, null, null);
  line(first, "311100", "C", B1 + B2 + 600_000 + OPEN_DEUD - OPEN_PROV, "AS", null, null, null);
  for (const [d, part] of [[8, 0.4], [18, 0.35], [32, 0.25]] as const) { const date = addDays(first, d); line(date, "111201", "D", OPEN_DEUD * part, "COB", null, null, null); line(date, "113100", "C", OPEN_DEUD * part, "COB", null, null, null); }
  for (const [d, part] of [[10, 0.5], [26, 0.5]] as const) { const date = addDays(first, d); line(date, "211100", "D", OPEN_PROV * part, "OP", null, null, null); line(date, "111201", "C", OPEN_PROV * part, "OP", null, null, null); }

  let nroV = 12480, nroC = 0;
  for (let i = 0; i <= 12; i++) {
    const y = first.getUTCFullYear(), mo = first.getUTCMonth() + i;
    const start = utc(y, mo, 1), dim = utc(y, mo + 1, 0).getUTCDate();
    const lastDay = i === 12 ? today.getUTCDate() : dim;
    const month = start.getUTCMonth();
    const season = month === 11 ? 1.28 : month === 0 ? 0.84 : month === 1 ? 0.9 : month === 6 ? 1.08 : 1;
    const infl = Math.pow(1.022, i);
    const S = P.scale * 1_000_000 * infl * season * (1 + (R() - 0.5) * 0.06) * (lastDay / dim); // ventas netas del mes
    const day = (min = 1, max = lastDay) => utc(y, mo, Math.max(1, Math.min(lastDay, Math.round(between(min, max)))));
    const ok = (d: Date) => d.getTime() <= today.getTime();

    // ── Ventas y cobranzas ──
    // Las ventas del mes se reparten entre los clientes que compran ese mes (así entran y salen clientes sin mover el total)
    const buysThisMonth = (c: (typeof CLIENTS)[number]) => !((c.from !== undefined && i < c.from) || (c.until !== undefined && i > c.until) || (c.every && i % c.every));
    const activeW = CLIENTS.filter(buysThisMonth).reduce((x, c) => x + c.w, 0);
    CLIENTS.forEach((c, ci) => {
      const pid = `demo-c${ci + 1}`;
      if (!buysThisMonth(c)) return;
      const share = (S * c.w) / activeW;
      const n = c.n ?? (c.w >= 8 ? 3 : c.w >= 4 ? 2 : 1);
      for (let k = 0; k < n; k++) {
        const neto = r2((share / n) * between(0.8, 1.2));
        const iva = r2(neto * 0.21), total = r2(neto + iva);
        const date = day(1 + (k * lastDay) / n, ((k + 1) * lastDay) / n);
        const due = c.cash ? date : addDays(date, 30);
        const pay = c.cash ? date : addDays(due, Math.max(-5, c.delay + Math.round(between(-4, 8))));
        const colppyId = `demo-fv-${++nroV}`;
        const paid = ok(pay);
        docs.push({ companyId, kind: "venta", colppyId, partyId: pid, partyName: c.name, docType: "FAV", letter: c.letter, cae: "demo",
          number: `0003-${String(nroV).padStart(8, "0")}`, date, dueDate: due, description: P.docDesc, total, applied: paid ? total : 0, pending: paid ? 0 : total, paidAt: paid ? pay : null, payChecked: true });
        line(date, "113100", "D", total, "FV", colppyId, "2", pid);
        line(date, c.acc ?? (c.letter === "A" ? "411100" : "411200"), "C", neto, "FV", colppyId, "2", pid);
        line(date, "213100", "C", iva, "FV", colppyId, "2", pid);
        ivaAdd(date, iva);
        if (paid) {
          const bank = c.cash || c.letter === "B" ? "111301" : "111201";
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
          description: ACC.find((a) => a.code === s.account)!.name, total, applied: paid ? total : 0, pending: paid ? 0 : total });
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
    manual(dim, "521100", P.salaries.op * 1_000_000 * infl * (month === 11 || month === 5 ? 1.5 : 1));
    manual(dim, "531100", P.salaries.adm * 1_000_000 * infl * (month === 11 || month === 5 ? 1.5 : 1));
    manual(10, "511300", S * P.commission);
    manual(15, "541100", S * 0.035);
    manual(Math.min(28, lastDay), "541200", S * 0.011);
    manual(Math.min(28, lastDay), "551100", 340_000 * k * infl, "111202");
    manual(10, "551200", 880_000 * k * Math.pow(0.97, i), "111202");
    manual(10, "212100", 1_500_000 * k, "111202");
    if (i === 7) manual(12, "151100", 18_500_000 * k);
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
    ...P.items.map(([name, unit, cost, margin, rel, cat], i) => {
      const minimum = 20 + (i % 5) * 10;
      return { companyId, colppyId: `demo-i${i + 1}`, code: `A${String(101 + i)}`, name, kind: "P", unit, stock: Math.round(minimum * rel), minimum, cost, lastPurchase: Math.round(cost * 1.04), price: Math.round(cost * (1 + margin)), iva: "21", category: cat ?? (i >= 20 ? "Limpieza" : i >= 6 && i <= 10 ? "Bebidas" : "Almacén"), active: true };
    }),
    ...(P.services ?? []).map(([name, unit, price], i) => ({ companyId, colppyId: `demo-s${i + 1}`, code: `S0${i + 1}`, name, kind: "S", unit, stock: 0, minimum: null, cost: 0, lastPurchase: 0, price, iva: "21", category: "Servicios", active: true })),
  ];

  const accounts = ACC.map((a) => ({ companyId, code: a.code, name: a.name, typeName: a.typeName, category: a.category, debitOnly: false, source: "plantilla", confirmed: true }));
  return { today, accounts, ledger, docs, parties, items, profile: P };
}
