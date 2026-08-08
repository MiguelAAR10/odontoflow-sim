import type { AppointmentStatus } from "./engine";

/**
 * Tipos del dominio de la clínica.
 *
 * La app es full frontend y no persiste nada. El catálogo se reconstruye desde
 * `seed.ts`, que es determinista, y el mundo se reproduce desde cero cada vez
 * que se mueve el reloj.
 *
 * Los días de la semana siguen `Date.getDay()`: 0 = domingo … 6 = sábado.
 */

/** Índice de día de la semana según `Date.getDay()`. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
  /** días de la semana en que atiende. Vacío = todos los días hábiles de la clínica. */
  diasAtiende: DiaSemana[];
}

export interface Tratamiento {
  id: string;
  name: string;
  durationMin: number;
  /** en céntimos de sol, para no arrastrar errores de coma flotante */
  priceCents: number;
}

/**
 * Paciente que pidió turno y está dispuesto a tomar un hueco que se libere.
 *
 * No es una cita: es un candidato. Cuando un espacio se abre, el motor busca
 * aquí al primero compatible (mismo tratamiento u odontólogo, dentro de la
 * ventana horaria que acepta) y le ofrece el lugar.
 */
export interface CandidatoListaEspera {
  id: string;
  pacienteId: string;
  /** tratamiento que busca; si es null, cualquiera sirve */
  tratamientoId: string | null;
  /** odontólogo preferido; si es null, cualquiera sirve */
  odontologoId: string | null;
  /** acepta huecos a partir de este instante */
  desde: Date;
  /** hasta cuándo le sirve un hueco; null = sin tope */
  hasta: Date | null;
  createdAt: Date;
}

/** Laboratorio externo. Catálogo pequeño, solo para seguimiento de trabajos. */
export interface Laboratorio {
  id: string;
  nombre: string;
  contacto: string;
}

/**
 * Trabajo enviado al laboratorio, en seguimiento.
 *
 * Es un módulo operativo sencillo: lo que importa es saber qué falta, con quién
 * está y si se vence. No intenta ser un software de gestión dental completo.
 */
export interface TrabajoLaboratorio {
  id: string;
  pacienteId: string;
  tratamientoId: string;
  laboratorioId: string;
  odontologoId: string;
  /** instante en que se envió el trabajo al laboratorio */
  enviadoEn: Date;
  /** fecha prometida de entrega */
  prometidoEn: Date;
  estado: TrabajoLabEstado;
  responsable: string;
}

export type TrabajoLabEstado =
  | "en_proceso"
  | "recibido"
  | "ajuste"
  | "entregado";

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
  | "patient_cancel"
  | "apply_suggestion"
  | "snooze"
  | "offer_waitlist"
  | "recover_slot";

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

/**
 * Hito del registro de actividad: una línea del feed cronológico que cuenta qué
 * está haciendo el sistema. No es un mensaje al paciente: es lo que ve el equipo
 * para entender que «OdontoFlow está trabajando». Determinista, como todo acá.
 */
export interface EventoActividad {
  id: string;
  /** instante virtual en que ocurre */
  at: Date;
  /** cita relacionada, si aplica (las ofertas y respuestas sí; los de labos no) */
  appointmentId: string | null;
  /** paciente relacionado, si aplica */
  pacienteId: string | null;
  /** texto legible, una línea, en español neutro */
  texto: string;
  /** clase para icono/color en el feed */
  clase:
    | "recordatorio"
    | "respuesta"
    | "alerta"
    | "hueco"
    | "oferta"
    | "aceptacion"
    | "reprograma"
    | "completada"
    | "lab";
  /** si es una acción creada para el humano (tarea de recepción), vale true */
  accionHumana: boolean;
}

/** Catálogo completo de la clínica, como sale del seed. */
export interface Catalogo {
  pacientes: Paciente[];
  odontologos: Odontologo[];
  tratamientos: Tratamiento[];
  citas: Cita[];
  reglas: Reglas;
  /** pacientes esperando un hueco; vacío si la lista no se usa */
  listaEspera: CandidatoListaEspera[];
  laboratorios: Laboratorio[];
  /** trabajos en seguimiento del módulo de laboratorios */
  trabajosLab: TrabajoLaboratorio[];
}
