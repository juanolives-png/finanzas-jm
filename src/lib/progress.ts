// Cómo se reparte la barra de progreso de la sincronización entre las etapas (según lo que tarda cada una).
export const STAGES = { conexion: [0, 3], cuentas: [3, 6], diario: [6, 55], ventas: [55, 75], compras: [75, 88], contactos: [88, 100] } as const;
export type Progress = (text: string, percent: number) => Promise<unknown>;
export const STAGE_LABELS: [keyof typeof STAGES, string][] = [
  ["cuentas", "Plan de cuentas"], ["diario", "Libro diario"], ["ventas", "Facturas de venta"], ["compras", "Facturas de proveedores"], ["contactos", "Mails de contacto"],
];
