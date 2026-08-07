import { DEMO_END, DEMO_START } from "@/domain/seed";

/**
 * Utilidades de tiempo del reloj virtual.
 *
 * El reloj es un número en el estado de React, no la hora del sistema. Acá viven
 * las dos reglas que lo gobiernan: nunca salir del rango de la demo y, cuando se
 * avanza con los botones, nunca caer fuera del horario de atención.
 */

/** Acota un instante al rango [DEMO_START, DEMO_END]. */
export function clampReloj(t: Date): Date {
  return new Date(Math.min(DEMO_END.getTime(), Math.max(DEMO_START.getTime(), t.getTime())));
}

/**
 * Acerca un instante al horario de atención.
 *
 * Una estación de recepción a las 23:32 no tiene sentido: nadie está ahí. Si el
 * instante cae fuera del horario, lo mueve a la próxima apertura (la de hoy si
 * todavía no llegó, o la de mañana si ya pasó).
 */
export function dentroDeHorario(t: Date, abre: number, cierra: number): Date {
  const d = new Date(t);
  const horaMin = d.getHours() + d.getMinutes() / 60;
  if (horaMin >= abre && horaMin < cierra) return d;

  d.setHours(abre, 0, 0, 0);
  // Si la apertura de hoy ya pasó (veníamos de después del cierre o de la
  // madrugada anterior), saltamos a la apertura de mañana.
  if (d.getTime() <= t.getTime()) d.setDate(d.getDate() + 1);
  return d;
}
