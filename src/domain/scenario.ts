import type { AppointmentStatus } from "./engine";
import type { RolEscenario } from "./paciente-sim";
import type {
  Laboratorio,
  Odontologo,
  Paciente,
  Reglas,
  TrabajoLabEstado,
  Tratamiento,
} from "./tipos";

/**
 * Contrato de Scenario Configuration (V2.2).
 *
 * Esta es una capa NUEVA sobre el dominio del contribuidor, no un reemplazo.
 * Los tipos que ya existían en `tipos.ts` (`Odontologo`, `Tratamiento`,
 * `Paciente`, `Laboratorio`, `Reglas`) se reutilizan tal cual — un doctor es el
 * mismo doctor venga de un escenario o del seed viejo. Solo las citas y la
 * lista de espera reciben una forma propia (`ScenarioAppointment`,
 * `ScenarioWaitlistCandidate`): el runtime deriva `endsAt` a partir de la
 * duración del tratamiento, así que un escenario declara la intención (qué
 * hora, qué tratamiento) y deja que `compileScenario` calcule lo derivado —
 * nunca al revés.
 *
 * Nombrado en inglés a propósito: es una capa mía, distinta del vocabulario en
 * español del contribuidor que compila hacia abajo. No es un renombre de nada
 * existente.
 */

export interface ScenarioMetadata {
  id: string;
  name: string;
  description: string;
}

/** Ventana de la línea de tiempo. Validada (`start < end`); ver CANONICAL.md
 * sobre por qué las tres escenas de V2.2 comparten la misma ventana. */
export interface ScenarioCalendar {
  start: Date;
  end: Date;
}

/**
 * Cómo la inasistencia previa erosiona confirmación/reprogramación a favor del
 * silencio. Reproduce exactamente la fórmula original de `paciente-sim.ts`:
 *
 *   silencioExtra = min(previousNoShows * weightPerNoShow, cap)
 *   pConfirma    -= silencioExtra * confirmShare
 *   pReprograma  -= silencioExtra * rescheduleShare
 */
export interface ScenarioBehaviorInfluence {
  weightPerNoShow: number;
  cap: number;
  confirmShare: number;
  rescheduleShare: number;
}

/**
 * Probabilidades del comportamiento simulado del paciente.
 *
 * `silenceProbability` NO es un campo: es el resto explícito,
 * `1 - confirmProbability - rescheduleProbability`, exactamente como el código
 * original de `respuestaDe` ya lo calculaba de forma implícita (todo lo que no
 * cae en `roll < pConfirma` ni en `roll < pConfirma + pReprograma` es
 * silencio). Ver `silenceProbabilityOf()` más abajo.
 *
 * `scriptedRoles` tiene prioridad absoluta sobre las probabilidades — igual
 * que en el código original: un paciente con rol fijo SIEMPRE cumple su rol,
 * el reparto probabilístico solo aplica al resto.
 */
export interface ScenarioBehavior {
  confirmProbability: number;
  rescheduleProbability: number;
  previousNoShowInfluence: ScenarioBehaviorInfluence;
  scriptedRoles: Record<string, RolEscenario>;
}

/** El resto explícito de silencio, nunca un campo separado que pueda desincronizarse. */
export function silenceProbabilityOf(behavior: ScenarioBehavior): number {
  return 1 - behavior.confirmProbability - behavior.rescheduleProbability;
}

/**
 * Una cita tal como la declara el escenario: intención, no derivación.
 * `compileScenario` calcula `endsAt` desde `treatmentId` y arranca
 * `remindedAt` en null, exactamente como hacía `catalogoBase()`.
 */
export interface ScenarioAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  treatmentId: string;
  startsAt: Date;
  status: AppointmentStatus;
}

export interface ScenarioWaitlistCandidate {
  id: string;
  patientId: string;
  /** tratamiento que busca; null = cualquiera sirve */
  treatmentId: string | null;
  /** odontólogo preferido; null = cualquiera sirve */
  doctorId: string | null;
  from: Date;
  /** hasta cuándo le sirve un hueco; null = sin tope */
  until: Date | null;
  createdAt: Date;
}

export interface ScenarioLabJob {
  id: string;
  patientId: string;
  treatmentId: string;
  labId: string;
  doctorId: string;
  sentAt: Date;
  promisedAt: Date;
  status: TrabajoLabEstado;
  owner: string;
}

/**
 * El contrato completo. Todo lo que hoy vive implícito, repartido entre
 * `seed.ts` y `paciente-sim.ts`, declarado en un solo lugar con nombre.
 */
export interface ScenarioDefinition {
  metadata: ScenarioMetadata;
  calendar: ScenarioCalendar;
  rules: Reglas;
  doctors: Odontologo[];
  treatments: Tratamiento[];
  patients: Paciente[];
  appointments: ScenarioAppointment[];
  waitlist: ScenarioWaitlistCandidate[];
  /** representable, sin expandir el dominio de laboratorios (fuera de alcance de V2.2) */
  laboratories: Laboratorio[];
  labJobs: ScenarioLabJob[];
  behavior: ScenarioBehavior;
}

// --------------------------------------------------------------- validación

/**
 * Validación pura del escenario efectivo (base + overrides, ya fusionados).
 *
 * Devuelve la lista de errores; vacía = escenario válido. Nunca lanza: el
 * llamador decide qué hacer con una lista no vacía (típicamente, no guardar el
 * cambio y mostrar los mensajes, igual que ya hace `VistaReglas`).
 */
export function validateScenario(scenario: ScenarioDefinition): string[] {
  const errores: string[] = [];
  const agregar = (cond: boolean, msg: string) => {
    if (cond) errores.push(msg);
  };

  // --- calendario ---
  agregar(
    !(scenario.calendar.start.getTime() < scenario.calendar.end.getTime()),
    "El inicio del calendario debe ser anterior al fin.",
  );

  // --- reglas (mismas invariantes que ya vigilaba VistaReglas) ---
  agregar(
    !(scenario.rules.clinicCloseHour > scenario.rules.clinicOpenHour),
    "La hora de cierre debe ser posterior a la de apertura.",
  );
  agregar(
    !(scenario.rules.secondReminderHours < scenario.rules.firstReminderHours),
    "El segundo recordatorio debe ir más cerca de la cita que el primero.",
  );

  // --- ids únicos por colección ---
  const idsUnicos = (items: { id: string }[], etiqueta: string) => {
    const vistos = new Set<string>();
    for (const it of items) {
      if (vistos.has(it.id)) errores.push(`Id duplicado en ${etiqueta}: "${it.id}".`);
      vistos.add(it.id);
    }
    return vistos;
  };
  const idsPacientes = idsUnicos(scenario.patients, "pacientes");
  idsUnicos(scenario.doctors, "doctores");
  const idsTratamientos = idsUnicos(scenario.treatments, "tratamientos");
  idsUnicos(scenario.appointments, "citas");
  idsUnicos(scenario.waitlist, "lista de espera");
  const idsLabs = idsUnicos(scenario.laboratories, "laboratorios");
  idsUnicos(scenario.labJobs, "trabajos de laboratorio");

  // --- doctores ---
  const doctorPorId = new Map(scenario.doctors.map((d) => [d.id, d]));
  for (const d of scenario.doctors) {
    for (const dia of d.diasAtiende) {
      agregar(dia < 0 || dia > 6, `Doctor "${d.id}": día de atención inválido (${dia}).`);
    }
  }

  // --- tratamientos ---
  for (const t of scenario.treatments) {
    agregar(!(t.durationMin > 0), `Tratamiento "${t.id}": la duración debe ser positiva.`);
    agregar(t.priceCents < 0, `Tratamiento "${t.id}": el precio sintético no puede ser negativo.`);
  }

  // --- citas: referencias + doctor atiende ese día ---
  for (const a of scenario.appointments) {
    agregar(!idsPacientes.has(a.patientId), `Cita "${a.id}": paciente "${a.patientId}" no existe.`);
    agregar(!idsTratamientos.has(a.treatmentId), `Cita "${a.id}": tratamiento "${a.treatmentId}" no existe.`);
    const doctor = doctorPorId.get(a.doctorId);
    agregar(!doctor, `Cita "${a.id}": doctor "${a.doctorId}" no existe.`);
    if (doctor) {
      // Vacío = atiende todos los días hábiles (tipos.ts). No vacío = solo esos días.
      const atiende = doctor.diasAtiende.length === 0 || doctor.diasAtiende.includes(a.startsAt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      agregar(!atiende, `Cita "${a.id}": el doctor "${a.doctorId}" no atiende ese día.`);
    }
  }

  // --- lista de espera: referencias ---
  for (const w of scenario.waitlist) {
    agregar(!idsPacientes.has(w.patientId), `Lista de espera "${w.id}": paciente "${w.patientId}" no existe.`);
    agregar(
      w.treatmentId !== null && !idsTratamientos.has(w.treatmentId),
      `Lista de espera "${w.id}": tratamiento "${w.treatmentId}" no existe.`,
    );
    agregar(
      w.doctorId !== null && !doctorPorId.has(w.doctorId),
      `Lista de espera "${w.id}": doctor "${w.doctorId}" no existe.`,
    );
  }

  // --- trabajos de laboratorio: referencias ---
  for (const j of scenario.labJobs) {
    agregar(!idsPacientes.has(j.patientId), `Trabajo de lab "${j.id}": paciente "${j.patientId}" no existe.`);
    agregar(!idsTratamientos.has(j.treatmentId), `Trabajo de lab "${j.id}": tratamiento "${j.treatmentId}" no existe.`);
    agregar(!idsLabs.has(j.labId), `Trabajo de lab "${j.id}": laboratorio "${j.labId}" no existe.`);
    agregar(!doctorPorId.has(j.doctorId), `Trabajo de lab "${j.id}": doctor "${j.doctorId}" no existe.`);
  }

  // --- comportamiento ---
  const b = scenario.behavior;
  agregar(b.confirmProbability < 0, "confirmProbability no puede ser negativo.");
  agregar(b.rescheduleProbability < 0, "rescheduleProbability no puede ser negativo.");
  agregar(
    b.confirmProbability + b.rescheduleProbability > 1,
    "confirmProbability + rescheduleProbability no puede superar 1 (el resto es silencio).",
  );
  agregar(b.previousNoShowInfluence.weightPerNoShow < 0, "weightPerNoShow no puede ser negativo.");
  agregar(
    b.previousNoShowInfluence.cap < 0 || b.previousNoShowInfluence.cap > 1,
    "cap debe estar entre 0 y 1.",
  );
  agregar(
    b.previousNoShowInfluence.confirmShare < 0 || b.previousNoShowInfluence.confirmShare > 1,
    "confirmShare debe estar entre 0 y 1.",
  );
  agregar(
    b.previousNoShowInfluence.rescheduleShare < 0 || b.previousNoShowInfluence.rescheduleShare > 1,
    "rescheduleShare debe estar entre 0 y 1.",
  );
  for (const pacienteId of Object.keys(b.scriptedRoles)) {
    agregar(!idsPacientes.has(pacienteId), `Rol fijo: paciente "${pacienteId}" no existe.`);
  }

  return errores;
}
