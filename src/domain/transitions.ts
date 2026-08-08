import type { AppointmentStatus } from "./engine";

/**
 * Máquina de estados de una cita.
 *
 * Solo estas transiciones son legales. Cualquier otra lanza error en vez de
 * corromper los datos en silencio, que es lo que suele pasar cuando el estado
 * se cambia desde media docena de sitios distintos.
 */
const LEGAL: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["reminded", "confirmed", "no_show", "cancelled"],
  reminded: ["confirmed", "reschedule_requested", "no_response", "no_show", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  reschedule_requested: ["scheduled", "confirmed", "no_show", "cancelled"],
  no_response: ["confirmed", "reschedule_requested", "no_show", "cancelled"],
  // una cita cancelada puede recuperarse: alguien de la lista de espera tomó el hueco
  cancelled: ["recovered"],
  recovered: ["completed", "no_show"],
  completed: [],
  no_show: [],
};

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: AppointmentStatus,
    readonly to: AppointmentStatus,
  ) {
    super(`Transición ilegal: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

/** Valida la transición o lanza. Llamar SIEMPRE antes de escribir el estado. */
export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}
