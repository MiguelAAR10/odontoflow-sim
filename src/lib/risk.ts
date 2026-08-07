import type { AppointmentStatus } from "./engine";

/**
 * Riesgo de que una cita no ocurra: 0 (nulo) a 1 (casi seguro).
 *
 * No es un modelo estadístico y no pretende serlo. Es una heurística explicable
 * en una frase al dueño de la clínica, que es justo lo que necesita para confiar
 * en el orden de la lista. Combina tres señales:
 *
 *   1. el estado de la conversación — la señal más fuerte
 *   2. el historial de inasistencias del paciente
 *   3. la proximidad de la cita, porque a menos horas queda menos margen
 */

const BASE: Partial<Record<AppointmentStatus, number>> = {
  scheduled: 0.18,
  reminded: 0.34,
  reschedule_requested: 0.5,
  no_response: 0.82,
};

export interface RiskInput {
  status: AppointmentStatus;
  startsAt: Date;
  previousNoShows: number;
  now: Date;
}

export function riskOf({ status, startsAt, previousNoShows, now }: RiskInput): number {
  if (status === "confirmed" || status === "completed") return 0;
  if (status === "no_show" || status === "cancelled") return 0;

  let risk = BASE[status] ?? 0.18;
  risk += Math.min(previousNoShows * 0.14, 0.28);

  const hoursUntil = (startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 24) risk += 0.1;

  return Math.min(risk, 0.96);
}

/** Plata en juego: ordena la lista por lo que de verdad duele perder. */
export function exposure(risk: number, priceCents: number): number {
  return risk * priceCents;
}

/** Frase corta que explica de dónde sale el riesgo. Se muestra junto a la cita. */
export function riskReason(input: RiskInput & { remindedAt: Date | null }): string {
  const { status, previousNoShows, remindedAt, now } = input;
  if (status === "no_response" && remindedAt) {
    const h = Math.floor((now.getTime() - remindedAt.getTime()) / 3_600_000);
    return `no responde hace ${h} h`;
  }
  if (status === "reschedule_requested") return "pidió otro horario";
  if (status === "reminded") return "recordatorio enviado, esperando";
  if (previousNoShows > 0)
    return `${previousNoShows} inasistencia${previousNoShows > 1 ? "s" : ""} previa${previousNoShows > 1 ? "s" : ""}`;
  return "aún fuera de la ventana de recordatorio";
}
