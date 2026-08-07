"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rules } from "@/db/schema";
import { getNow } from "@/lib/clock";
import { recordEvent, resetDemo, seekTo, type UserEventKind } from "@/lib/executor";

/**
 * Acciones de servidor.
 *
 * Toda mutación pasa por acá y termina en `revalidatePath`, que en Next 16
 * re-renderiza la ruta y devuelve la vista actualizada en la misma respuesta.
 * El cliente no tiene copia del estado: lo recibe ya calculado.
 *
 * Cada acción valida su entrada con Zod. Una Server Action es un endpoint POST
 * público, así que se trata como entrada no confiable aunque solo la invoque
 * nuestra propia interfaz.
 */

const instante = z.number().int().finite();
const tipoEvento = z.enum([
  "patient_confirm",
  "patient_reschedule",
  "apply_suggestion",
  "snooze",
]);

/** Mueve el reloj de la clínica a un instante concreto (hacia adelante o atrás). */
export async function moverReloj(hastaMs: number) {
  const destino = instante.parse(hastaMs);
  const db = await getDb();
  await seekTo(db, new Date(destino));
  revalidatePath("/");
}

/** Avanza un número de horas desde el instante actual. */
export async function avanzarHoras(horas: number) {
  const h = z.number().finite().parse(horas);
  const db = await getDb();
  const ahora = await getNow(db);
  await seekTo(db, new Date(ahora.getTime() + h * 3_600_000));
  revalidatePath("/");
}

/** Registra una respuesta del paciente o una decisión de recepción. */
export async function registrarEvento(citaId: string, tipo: UserEventKind) {
  const id = z.string().min(1).parse(citaId);
  const kind = tipoEvento.parse(tipo);
  const db = await getDb();
  const ahora = await getNow(db);
  await recordEvent(db, id, kind, ahora);
  revalidatePath("/");
}

/** Vuelve al inicio y borra toda la historia de la demo. */
export async function reiniciar() {
  const db = await getDb();
  await resetDemo(db);
  revalidatePath("/");
}

const esquemaReglas = z.object({
  firstReminderHours: z.number().int().min(1).max(168),
  secondReminderHours: z.number().int().min(0).max(48),
  alertAfterHours: z.number().int().min(1).max(72),
  clinicOpenHour: z.number().int().min(0).max(23),
  clinicCloseHour: z.number().int().min(1).max(24),
});

/**
 * Cambia los parámetros del motor. Al recalcular la línea de tiempo desde el
 * inicio, las nuevas reglas se aplican a toda la historia: es lo que permite
 * mostrar en la demo que subir el recordatorio de 24 a 48 h cambia el resultado.
 */
export async function guardarReglas(entrada: z.input<typeof esquemaReglas>) {
  const datos = esquemaReglas.parse(entrada);
  if (datos.clinicCloseHour <= datos.clinicOpenHour) {
    throw new Error("La hora de cierre debe ser posterior a la de apertura");
  }
  const db = await getDb();
  await db.update(rules).set(datos).where(eq(rules.id, 1)).run();

  const ahora = await getNow(db);
  await seekTo(db, ahora);
  revalidatePath("/");
}
