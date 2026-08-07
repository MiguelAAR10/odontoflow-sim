import { eq } from "drizzle-orm";
import { clock } from "@/db/schema";
import type { Db } from "@/db";

/**
 * Reloj virtual de la clínica.
 *
 * Este es el ÚNICO archivo del proyecto autorizado a construir una fecha a
 * partir de la hora real del sistema, y solo para fijar el instante inicial de
 * la demo. Todo lo demás pregunta acá qué hora es. Un test centinela recorre
 * `src/` y falla si aparece `new Date()` sin argumentos en cualquier otro sitio.
 *
 * Sin esto no hay demo: es lo que permite adelantar el tiempo y ver al sistema
 * reaccionar.
 */

/** Miércoles 12 de agosto de 2026, 09:15. Instante en que arranca la demo. */
export const DEMO_START = new Date(2026, 7, 12, 9, 15, 0, 0);

/** Domingo 16 de agosto, 20:00. Fin del rango que cubre la línea de tiempo. */
export const DEMO_END = new Date(2026, 7, 16, 20, 0, 0, 0);

export async function getNow(db: Db): Promise<Date> {
  const row = await db.select().from(clock).where(eq(clock.id, 1)).get();
  if (!row) {
    await db.insert(clock).values({ id: 1, now: DEMO_START }).run();
    return new Date(DEMO_START);
  }
  return new Date(row.now);
}

/** Fija el reloj en un instante concreto, acotado al rango de la demo. */
export async function setClock(db: Db, at: Date): Promise<Date> {
  const clamped = new Date(
    Math.min(DEMO_END.getTime(), Math.max(DEMO_START.getTime(), at.getTime())),
  );
  await db
    .insert(clock)
    .values({ id: 1, now: clamped })
    .onConflictDoUpdate({ target: clock.id, set: { now: clamped } })
    .run();
  return clamped;
}

export async function resetClock(db: Db): Promise<Date> {
  return setClock(db, DEMO_START);
}
