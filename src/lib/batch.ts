// Utilidades para que la sincronización sea rápida: menos idas y vueltas a la base y a Colppy.
import type { PrismaPromise } from "@prisma/client";
import { db } from "./db";

/** Corre `fn` sobre todos los items con a lo sumo `n` en paralelo (para no saturar Colppy). */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/** Ejecuta muchas escrituras en transacciones de a `size` (una ida a la base por tanda, no por fila). */
export async function inChunks(ops: PrismaPromise<unknown>[], size = 200) {
  for (let i = 0; i < ops.length; i += size) await db.$transaction(ops.slice(i, i + size));
}

/** Parte un array en pedazos (para createMany grandes). */
export const chunks = <T,>(xs: T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size));
