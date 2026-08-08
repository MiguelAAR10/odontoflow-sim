/**
 * Motor de reglas — función pura.
 *
 * Recibe el estado del mundo y devuelve qué acciones hay que ejecutar.
 * No toca la base de datos, no envía mensajes, no lee la hora del sistema.
 * Todo el valor del producto vive acá, y por eso se testea solo.
 */

export type AppointmentStatus =
  | "scheduled"
  | "reminded"
  | "confirmed"
  | "reschedule_requested"
  | "no_response"
  | "completed"
  | "no_show"
  | "cancelled"
  | "recovered";

export type ReminderKind = "reminder_24h" | "reminder_2h";

export interface AppointmentView {
  id: string;
  patientId: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  /** instante del primer recordatorio, null si aún no se envió */
  remindedAt: Date | null;
}

export interface Rules {
  firstReminderHours: number;
  secondReminderHours: number;
  alertAfterHours: number;
}

export interface SentMessage {
  appointmentId: string;
  kind: string;
}

export type Action =
  | { type: "send_reminder"; appointmentId: string; kind: ReminderKind }
  | { type: "raise_alert"; appointmentId: string; kind: "no_response" }
  | { type: "mark_completed"; appointmentId: string }
  | { type: "mark_no_show"; appointmentId: string };

export interface EvaluateInput {
  now: Date;
  appointments: AppointmentView[];
  rules: Rules;
  sentMessages: SentMessage[];
  /** alertas ya levantadas, para no repetirlas */
  raisedAlerts?: { appointmentId: string; kind: string }[];
}

const HOUR = 3_600_000;
const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / HOUR;

/**
 * Decide las acciones pendientes para el instante `now`.
 *
 * Idempotente: llamarla dos veces con el mismo input devuelve lo mismo, y una
 * acción ya ejecutada (presente en `sentMessages` / `raisedAlerts`) nunca se
 * vuelve a emitir. Un recordatorio duplicado al paciente es el peor bug posible
 * de este producto, así que esta propiedad es la más testeada.
 */
export function evaluate(input: EvaluateInput): Action[] {
  const { now, appointments, rules, sentMessages } = input;
  const raisedAlerts = input.raisedAlerts ?? [];
  const actions: Action[] = [];

  const alreadySent = (appointmentId: string, kind: string) =>
    sentMessages.some((m) => m.appointmentId === appointmentId && m.kind === kind);
  const alreadyAlerted = (appointmentId: string, kind: string) =>
    raisedAlerts.some((a) => a.appointmentId === appointmentId && a.kind === kind);

  for (const appt of appointments) {
    // Las citas cerradas o recuperadas no generan ninguna acción.
    if (
      appt.status === "completed" ||
      appt.status === "no_show" ||
      appt.status === "cancelled"
    ) {
      continue;
    }

    const hoursUntilStart = hoursBetween(now, appt.startsAt);
    const isFuture = hoursUntilStart > 0;

    // 1 · primer recordatorio
    if (
      appt.status === "scheduled" &&
      isFuture &&
      hoursUntilStart <= rules.firstReminderHours &&
      !alreadySent(appt.id, "reminder_24h")
    ) {
      actions.push({ type: "send_reminder", appointmentId: appt.id, kind: "reminder_24h" });
    }

    // 2 · segundo recordatorio, solo si el primero ya salió y sigue sin responder
    if (
      appt.status === "reminded" &&
      isFuture &&
      hoursUntilStart <= rules.secondReminderHours &&
      !alreadySent(appt.id, "reminder_2h")
    ) {
      actions.push({ type: "send_reminder", appointmentId: appt.id, kind: "reminder_2h" });
    }

    // 3 · alerta por silencio: venció el plazo de respuesta
    if (
      appt.status === "reminded" &&
      appt.remindedAt !== null &&
      isFuture &&
      hoursBetween(appt.remindedAt, now) >= rules.alertAfterHours &&
      !alreadyAlerted(appt.id, "no_response")
    ) {
      actions.push({ type: "raise_alert", appointmentId: appt.id, kind: "no_response" });
    }

    // 4 · cierre de la cita una vez pasada su hora de fin
    if (appt.endsAt.getTime() <= now.getTime()) {
      if (appt.status === "confirmed" || appt.status === "recovered") {
        actions.push({ type: "mark_completed", appointmentId: appt.id });
      } else {
        // scheduled, reminded, no_response o reschedule_requested que ya pasaron
        actions.push({ type: "mark_no_show", appointmentId: appt.id });
      }
    }
  }

  return actions;
}
