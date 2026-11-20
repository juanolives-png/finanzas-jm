// ─── Empresas de ejemplo por rubro ──────────────────────────────────────────
// Cada rubro tiene sus clientes, proveedores, nombres de cuentas, estructura de costos y (si corresponde) stock.
// La IA del inicio detecta el rubro de quien entra y el recorrido se arma con la empresa que más se le parece;
// al registrarse, esa misma empresa queda como "demo" en su cuenta. Todos los números se generan en demoData.ts.

export type RubroKey = "distribucion" | "comercio" | "servicios" | "coworking";
/** w: peso en las ventas · delay: días que paga después del vencimiento · cash: paga en el momento (mostrador, Mercado Pago)
 *  from / until: mes (0 = hace 12 meses, 12 = este mes) en que empezó o dejó de comprar · every: compra cada N meses
 *  acc: cuenta de ventas (por defecto A → 411100, B → 411200) · n: facturas por mes */
export type DemoClient = { name: string; w: number; letter: "A" | "B"; delay: number; city: string; from?: number; until?: number; every?: number; cash?: boolean; acc?: "411100" | "411200"; n?: number };
export type DemoSupplier = { name: string; account: string; share?: number; fixed?: number; inv: number; term: number; delay: number; city: string };
/** nombre, unidad, costo, margen, stock relativo al mínimo (0 = sin stock, <1 = bajo mínimo), categoría */
export type DemoItem = [string, string, number, number, number, string?];

export type DemoProfile = {
  key: RubroKey; label: string; company: string;
  scale: number;                       // ventas netas de un mes normal, en millones de pesos (sin inflación)
  names: Record<string, string>;       // nombres de cuentas propios del rubro (código → nombre)
  cmvLabel: string;                    // cómo se llama la línea de costo directo en el P&L
  salaries: { op: number; adm: number };
  commission: number;                  // % de las ventas que se paga en comisiones (511300)
  docDesc: string;
  clients: DemoClient[]; suppliers: DemoSupplier[]; items: DemoItem[];
  services?: [string, string, number][];
};

const DISTRIBUCION: DemoProfile = {
  key: "distribucion", label: "Distribuidora mayorista", company: "Distribuidora del Sol", scale: 152,
  names: {}, cmvLabel: "Costo de mercadería", salaries: { op: 12.4, adm: 7.9 }, commission: 0.025, docDesc: "Mercadería según remito",
  clients: [
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
  { name: "Club Barrio Sur", w: 2, letter: "A", delay: 45, city: "Avellaneda", every: 2 },
  // Clientes que se fueron (churn) y que llegaron (nuevos)
  { name: "Rotisería El Buen Gusto", w: 3, letter: "B", delay: 10, city: "Ramos Mejía", until: 5 },
  { name: "Almacén Santa Rita", w: 3, letter: "A", delay: 6, city: "Olivos", until: 9 },
  { name: "Autoservicio Los Robles", w: 4, letter: "A", delay: 12, city: "Martínez", until: 10 },
  { name: "Mercado Saludable", w: 3, letter: "A", delay: 5, city: "Vicente López", from: 8 },
  { name: "Hotel Costa Azul", w: 3, letter: "A", delay: 20, city: "Mar del Plata", from: 10 },
  { name: "Dietética Vida Verde", w: 2, letter: "B", delay: 2, city: "Florida", from: 12 },
],
  suppliers: [
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
],
  items: [
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
],
  services: [["Flete a domicilio", "viaje", 18_000]],
};

const COMERCIO: DemoProfile = {
  key: "comercio", label: "Comercio minorista", company: "Ferretería El Tornillo", scale: 54,
  names: { "411100": "Ventas en cuenta corriente (empresas y gremios)", "411200": "Ventas de mostrador", "521100": "Sueldos y cargas vendedores", "521200": "Alquiler del local", "531100": "Sueldos administración" },
  cmvLabel: "Costo de mercadería", salaries: { op: 4.6, adm: 2.3 }, commission: 0.01, docDesc: "Materiales según presupuesto",
  clients: [
    { name: "Mostrador · consumidor final", w: 38, letter: "B", delay: 0, city: "Local", cash: true, n: 4 },
    { name: "Constructora Del Valle SRL", w: 9, letter: "A", delay: 32, city: "Pilar" },
    { name: "Municipalidad de San Andrés (licitación)", w: 5, letter: "A", delay: 96, city: "San Andrés" },
    { name: "Plomería Hnos. Ruiz", w: 4, letter: "A", delay: 9, city: "Escobar" },
    { name: "Electricidad Total", w: 3, letter: "A", delay: 4, city: "Garín" },
    { name: "Consorcio Av. Mitre 1450", w: 3, letter: "A", delay: 58, city: "Vicente López" },
    { name: "Pinturería Arco Iris", w: 3, letter: "A", delay: 2, city: "Pilar" },
    { name: "Estudio de arquitectura Pla", w: 2, letter: "A", delay: 14, city: "CABA" },
    { name: "Gasista matriculado Gómez", w: 2, letter: "B", delay: 3, city: "Del Viso" },
    { name: "Vivero Las Flores", w: 1, letter: "B", delay: 8, city: "Tortuguitas", every: 2 },
    { name: "Herrería El Yunque", w: 2, letter: "B", delay: 18, city: "Pilar", until: 6 },
    { name: "Taller Mecánico Ruta 8", w: 2, letter: "A", delay: 12, city: "Pilar", until: 9 },
    { name: "Cooperativa de Vivienda Sur", w: 3, letter: "A", delay: 10, city: "Moreno", until: 10 },
    { name: "Constructora Horizonte", w: 4, letter: "A", delay: 24, city: "Tigre", from: 8 },
    { name: "Cooperativa Eléctrica Local", w: 2, letter: "A", delay: 38, city: "Pilar", from: 10 },
    { name: "Mantenimiento Edilicio Norte", w: 2, letter: "A", delay: 6, city: "San Isidro", from: 12 },
  ],
  suppliers: [
    { name: "Herramientas del Sur SA", account: "511100", share: 0.19, inv: 2, term: 30, delay: 3, city: "Rosario" },
    { name: "Bulonera Industrial SRL", account: "511100", share: 0.12, inv: 2, term: 30, delay: 6, city: "Avellaneda" },
    { name: "Pinturas Andina SA", account: "511100", share: 0.12, inv: 2, term: 45, delay: 0, city: "Córdoba" },
    { name: "Materiales Eléctricos Norte", account: "511100", share: 0.1, inv: 2, term: 30, delay: 8, city: "San Martín" },
    { name: "Sanitarios del Plata SA", account: "511100", share: 0.08, inv: 1, term: 30, delay: 2, city: "Quilmes" },
    { name: "Expreso Oeste (fletes)", account: "511200", share: 0.015, inv: 1, term: 15, delay: 4, city: "Moreno" },
    { name: "Inmobiliaria Pilar Centro", account: "521200", fixed: 1_850_000, inv: 1, term: 10, delay: 0, city: "Pilar" },
    { name: "Edenor y servicios", account: "521300", fixed: 520_000, inv: 1, term: 15, delay: 0, city: "Pilar" },
    { name: "Estudio Contable Ferreyra y Asoc.", account: "531200", fixed: 620_000, inv: 1, term: 10, delay: 6, city: "CABA" },
    { name: "Agencia Local Redes", account: "531300", fixed: 380_000, inv: 1, term: 30, delay: 5, city: "Pilar" },
    { name: "Gestión Nube SA (sistemas)", account: "531400", fixed: 240_000, inv: 1, term: 5, delay: 0, city: "CABA" },
  ],
  items: [
    ["Taladro percutor 650 W", "unidad", 68_000, 0.38, 1.6, "Herramientas"], ["Amoladora angular 115 mm", "unidad", 54_000, 0.36, 0.5, "Herramientas"],
    ["Juego de llaves combinadas x12", "juego", 39_000, 0.42, 2.1, "Herramientas"], ["Martillo galponero", "unidad", 9_800, 0.45, 3.0, "Herramientas"],
    ["Cinta métrica 5 m", "unidad", 4_200, 0.5, 2.6, "Herramientas"], ["Tornillos autoperforantes x100", "caja", 3_100, 0.55, 4.0, "Bulonería"],
    ["Tarugos 8 mm x100", "bolsa", 1_900, 0.6, 3.2, "Bulonería"], ["Bulones 1/2 x 3\" x50", "caja", 6_400, 0.5, 0, "Bulonería"],
    ["Látex interior 20 L", "balde", 58_000, 0.3, 1.2, "Pinturería"], ["Esmalte sintético 4 L", "lata", 31_000, 0.33, 0.7, "Pinturería"],
    ["Rodillo lana 22 cm", "unidad", 5_600, 0.45, 2.4, "Pinturería"], ["Cable unipolar 2,5 mm x100 m", "rollo", 46_000, 0.28, 1.4, "Electricidad"],
    ["Térmica bipolar 20 A", "unidad", 12_500, 0.35, 0.4, "Electricidad"], ["Lámpara LED 12 W", "unidad", 2_300, 0.6, 3.5, "Electricidad"],
    ["Caño termofusión 20 mm x4 m", "unidad", 3_900, 0.4, 2.0, "Sanitarios"], ["Llave de paso 1/2\"", "unidad", 7_200, 0.42, 0, "Sanitarios"],
    ["Silicona acética 280 ml", "unidad", 3_400, 0.5, 2.8, "Sanitarios"], ["Cemento portland 50 kg", "bolsa", 11_800, 0.18, 1.1, "Construcción"],
  ],
};

const SERVICIOS: DemoProfile = {
  key: "servicios", label: "Servicios profesionales", company: "Estudio Norte Consultores", scale: 38,
  names: { "411100": "Honorarios por abonos mensuales", "411200": "Proyectos y horas adicionales", "511100": "Subcontratos y freelancers", "511200": "Viáticos de proyectos", "511300": "Comisiones comerciales", "521100": "Sueldos y cargas del equipo profesional", "521200": "Alquiler de oficina", "531100": "Sueldos dirección y administración", "531400": "Licencias de software y nube" },
  cmvLabel: "Subcontratos y freelancers", salaries: { op: 15.5, adm: 4.2 }, commission: 0.02, docDesc: "Honorarios profesionales del mes",
  clients: [
    { name: "Grupo Agroindustrial Pampa", w: 6, letter: "A", delay: 18, city: "Pergamino", n: 1 },
    { name: "Clínica San Lucas", w: 5, letter: "A", delay: 44, city: "CABA", n: 1 },
    { name: "Bodega Altos del Valle", w: 4, letter: "A", delay: 9, city: "Mendoza", n: 1 },
    { name: "Cadena Farmacias Vital", w: 4, letter: "A", delay: 4, city: "La Plata", n: 1 },
    { name: "Concesionaria Ruta 9", w: 3, letter: "A", delay: 7, city: "Campana", n: 1 },
    { name: "Hotel Boutique Palermo", w: 2, letter: "A", delay: 28, city: "CABA", n: 1 },
    { name: "Estudio Jurídico Ibáñez", w: 2, letter: "A", delay: 0, city: "CABA", n: 1 },
    { name: "Colegio San Martín", w: 3, letter: "A", delay: 88, city: "San Isidro", n: 1 },
    { name: "Fundación Crecer", w: 2, letter: "A", delay: 118, city: "CABA", n: 1 },
    { name: "Constructora Del Valle SRL", w: 3, letter: "A", delay: 57, city: "Pilar", acc: "411200", every: 2, n: 1 },
    { name: "Logística Express SA", w: 3, letter: "A", delay: 14, city: "Avellaneda", until: 7, n: 1 },
    { name: "Software Andes SRL", w: 2, letter: "A", delay: 6, city: "Córdoba", until: 10, n: 1 },
    { name: "Fintech Ruta SA", w: 2, letter: "A", delay: 3, city: "CABA", from: 7, n: 1 },
    { name: "Frigorífico del Sur", w: 4, letter: "A", delay: 25, city: "Bahía Blanca", from: 10, n: 1 },
    { name: "Mutual Ferroviaria", w: 2, letter: "A", delay: 12, city: "Rosario", from: 12, acc: "411200", n: 1 },
  ],
  suppliers: [
    { name: "Freelancers y subcontratos varios", account: "511100", share: 0.11, inv: 2, term: 15, delay: 2, city: "CABA" },
    { name: "Viajes Corporativos SA", account: "511200", share: 0.02, inv: 1, term: 15, delay: 3, city: "CABA" },
    { name: "Centro Empresarial Libertador (oficina)", account: "521200", fixed: 1_350_000, inv: 1, term: 10, delay: 0, city: "CABA" },
    { name: "Servicios del edificio", account: "521300", fixed: 260_000, inv: 1, term: 15, delay: 0, city: "CABA" },
    { name: "Estudio Contable Ferreyra y Asoc.", account: "531200", fixed: 540_000, inv: 1, term: 10, delay: 6, city: "CABA" },
    { name: "Agencia Creativa Lumen", account: "531300", fixed: 520_000, inv: 1, term: 30, delay: 10, city: "CABA" },
    { name: "Licencias y nube (Microsoft, Google, AWS)", account: "531400", fixed: 980_000, inv: 1, term: 5, delay: 0, city: "Exterior" },
  ],
  items: [],
};

const COWORKING: DemoProfile = {
  key: "coworking", label: "Coworking y oficinas", company: "Espacio Raíz Coworking", scale: 46,
  names: { "411100": "Oficinas privadas", "411200": "Puestos flex y salas", "511100": "Café, insumos y comunidad", "511200": "Limpieza y mantenimiento", "511300": "Comisiones comerciales", "521100": "Sueldos community y recepción", "521200": "Alquiler del edificio", "521300": "Expensas y servicios", "531100": "Sueldos dirección y administración" },
  cmvLabel: "Insumos y comunidad", salaries: { op: 6.4, adm: 3.6 }, commission: 0.015, docDesc: "Membresía mensual",
  clients: [
    { name: "Agencia Digital Bit", w: 6, letter: "A", delay: 4, city: "Oficina 301", n: 1 },
    { name: "Startup Agrotech Semilla", w: 5, letter: "A", delay: 34, city: "Oficina 204", n: 1 },
    { name: "Consultora RH Talento", w: 4, letter: "A", delay: 2, city: "Oficina 105", n: 1 },
    { name: "Estudio Contable Ríos", w: 4, letter: "A", delay: 9, city: "Oficina 202", n: 1 },
    { name: "Arquitectos Asociados", w: 3, letter: "A", delay: 61, city: "Oficina 110", n: 1 },
    { name: "ONG Puentes", w: 2, letter: "A", delay: 92, city: "Oficina 012", n: 1 },
    { name: "Productora Audiovisual Faro", w: 2, letter: "A", delay: 24, city: "Sala Estudio", every: 2, n: 1 },
    { name: "Puestos flex · freelancers", w: 9, letter: "B", delay: 0, city: "Planta abierta", cash: true, n: 3 },
    { name: "Salas por hora · varios", w: 3, letter: "B", delay: 0, city: "Salas", cash: true, n: 2 },
    { name: "Software Factory Delta", w: 5, letter: "A", delay: 7, city: "Oficina 305", until: 8, n: 1 },
    { name: "Editorial Pampa", w: 3, letter: "A", delay: 18, city: "Oficina 108", until: 10, n: 1 },
    { name: "Fintech Pago Fácil", w: 7, letter: "A", delay: 14, city: "Oficina 401", from: 6, n: 1 },
    { name: "Legal Tech Andes", w: 3, letter: "A", delay: 3, city: "Oficina 207", from: 10, n: 1 },
    { name: "Estudio de Diseño Trama", w: 2, letter: "A", delay: 5, city: "Oficina 109", from: 12, n: 1 },
  ],
  suppliers: [
    { name: "Café de Especialidad Origen", account: "511100", share: 0.035, inv: 2, term: 15, delay: 2, city: "CABA" },
    { name: "Limpieza Integral Brillo", account: "511200", share: 0.05, inv: 1, term: 15, delay: 4, city: "CABA" },
    { name: "Fideicomiso Edificio Libertad (alquiler)", account: "521200", fixed: 12_800_000, inv: 1, term: 10, delay: 0, city: "CABA" },
    { name: "Administración del consorcio", account: "521300", fixed: 3_300_000, inv: 1, term: 10, delay: 0, city: "CABA" },
    { name: "Estudio Contable Ferreyra y Asoc.", account: "531200", fixed: 620_000, inv: 1, term: 10, delay: 6, city: "CABA" },
    { name: "Agencia Creativa Lumen", account: "531300", fixed: 850_000, inv: 1, term: 30, delay: 10, city: "CABA" },
    { name: "Software de reservas y accesos", account: "531400", fixed: 420_000, inv: 1, term: 5, delay: 0, city: "CABA" },
  ],
  items: [],
};

export const DEMO_PROFILES: Record<RubroKey, DemoProfile> = { distribucion: DISTRIBUCION, comercio: COMERCIO, servicios: SERVICIOS, coworking: COWORKING };
export const RUBRO_KEYS = Object.keys(DEMO_PROFILES) as RubroKey[];
export const isRubro = (x: unknown): x is RubroKey => typeof x === "string" && x in DEMO_PROFILES;
export const profileFor = (k?: string | null) => (isRubro(k) ? DEMO_PROFILES[k] : DISTRIBUCION);

/** Del rubro con las palabras de la persona ("tengo una ferretería") a la empresa de ejemplo más parecida. */
export function rubroFromText(text?: string | null): RubroKey {
  return detectRubro(text) ?? "distribucion";
}
/** Igual, pero null si el texto no dice nada del rubro. */
export function detectRubro(text?: string | null): RubroKey | null {
  const n = String(text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/cowork|oficinas? (compartid|privad)|espacio de trabajo|centro de negocios/.test(n)) return "coworking";
  if (/estudio|consultor|agencia|servicio|software|abogad|contador|contab|arquitect|clinica|consultorio|escuela|colegio|capacitacion|marketing|diseno|desarroll|profesional|honorario/.test(n)) return "servicios";
  if (/distribui|mayorist|fabrica|import|industria|logistica|frigorific|molino|bodega/.test(n)) return "distribucion";
  if (/ferret|comercio|local|tienda|kiosco|almacen|farmacia|libreri|ropa|indumentaria|pinturer|corralon|supermerc|minorist|panader|carniceri|verduler|optica|jugueteri|bazar|veterinari|estacion de servicio/.test(n)) return "comercio";
  return null;
}
