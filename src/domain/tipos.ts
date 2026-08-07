import type { AppointmentStatus } from "./engine";

/**
 * Tipos del dominio de la clínica.
 *
 * Son los mismos conceptos que vivían en la base de datos, pero ahora como
 * objetos en memoria: la app es full frontend y no persiste nada. El catálogo
 * se reconstruye desde `seed.ts`, que es determinista, y el mundo se reproduce
 * desde cero cada vez que se mueve el reloj.
 */

export interface Paciente {
  id: string;
  fullName: string;
  phone: string;
  /** inasistencias históricas: alimentan el cálculo de riesgo */
  previousNoShows: number;
}

export interface Odontologo {
  id: string;
  fullName: string;
  specialty: string;
  color: string;
}

export interface Tratamiento {
  id: string;
  name: string;
  durationMin: number;
  /** en céntimos de sol, para no arrastrar errores de coma flotante */
  priceCents: number;
}

export interface Reglas {
  firstReminderHours: number;
  secondReminderHours: number;
  alertAfterHours: number;
  clinicOpenHour: number;
  clinicCloseHour: number;
}

/** Estado base de una cita tal como sale del seed, antes de pasar por el motor. */
export interface Cita {
  id: string;
  pacienteId: string;
  odontologoId: string;
  tratamientoId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  /** instante del primer recordatorio; null si todavía no se envió */
  remindedAt: Date | null;
}

export type UserEventKind =
  | "patient_confirm"
  | "patient_reschedule"
  | "apply_suggestion"
  | "snooze";

/** Acción del recepcionista o respuesta del paciente, con su instante virtual. */
export interface UserEvent {
  at: Date;
  appointmentId: string;
  kind: UserEventKind;
  seq: number;
}

export interface Mensaje {
  id: string;
  appointmentId: string;
  patientId: string;
  direction: "outbound" | "inbound";
  body: string;
  sentAt: Date;
  kind: string;
}

export interface Alerta {
  id: string;
  appointmentId: string;
  kind: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
}
