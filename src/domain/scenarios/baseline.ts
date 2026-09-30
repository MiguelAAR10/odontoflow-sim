import { COMPORTAMIENTO_BASE } from "@/domain/paciente-sim";
import {
  catalogoBase,
  DEMO_END,
  DEMO_START,
  DENTISTS,
  LABORATORIOS,
  REGLAS_BASE,
  TREATMENTS,
} from "@/domain/seed";
import type { ScenarioAppointment, ScenarioDefinition, ScenarioWaitlistCandidate, ScenarioLabJob } from "@/domain/scenario";

/**
 * El escenario `baseline`: el simulador de siempre, ahora expresado como
 * Scenario Configuration en vez de como el único mundo posible.
 *
 * DELIBERADAMENTE derivado de `catalogoBase()`, no transcrito a mano. 60 citas
 * con su doctor ya reasignado (la reasignación de `catalogoBase()` es un
 * algoritmo, no un dato — ver el comentario en `seed.ts`) son demasiado riesgo
 * de error de transcripción si se copian línea por línea. En vez de eso, esta
 * escena llama a `catalogoBase()` UNA vez y mapea su salida de vuelta a la
 * forma de `ScenarioDefinition`, descartando solo lo que el compilador va a
 * recalcular (`endsAt`, `remindedAt`).
 *
 * Esto convierte el test de equivalencia
 * (`compileScenario(baselineScenario)` debe ser profundamente igual a
 * `catalogoBase()`) en una prueba REAL del compilador: `endsAt` se recalcula
 * de forma independiente a partir de la duración del tratamiento, con la
 * misma fórmula pero ejercitada de nuevo, no simplemente copiada de vuelta.
 */
const cat = catalogoBase();

const appointments: ScenarioAppointment[] = cat.citas.map((c) => ({
  id: c.id,
  patientId: c.pacienteId,
  doctorId: c.odontologoId,
  treatmentId: c.tratamientoId,
  startsAt: c.startsAt,
  status: c.status,
}));

const waitlist: ScenarioWaitlistCandidate[] = cat.listaEspera.map((w) => ({
  id: w.id,
  patientId: w.pacienteId,
  treatmentId: w.tratamientoId,
  doctorId: w.odontologoId,
  from: w.desde,
  until: w.hasta,
  createdAt: w.createdAt,
}));

const labJobs: ScenarioLabJob[] = cat.trabajosLab.map((j) => ({
  id: j.id,
  patientId: j.pacienteId,
  treatmentId: j.tratamientoId,
  labId: j.laboratorioId,
  doctorId: j.odontologoId,
  sentAt: j.enviadoEn,
  promisedAt: j.prometidoEn,
  status: j.estado,
  owner: j.responsable,
}));

export const baselineScenario: ScenarioDefinition = {
  metadata: {
    id: "baseline",
    name: "Clínica San Borja (línea base)",
    description:
      "El escenario original del simulador: 28 pacientes, 4 doctores, 10 tratamientos, 60 citas y comportamiento estándar. Sin cambios respecto al simulador antes de V2.2.",
  },
  calendar: { start: DEMO_START, end: DEMO_END },
  rules: { ...REGLAS_BASE },
  doctors: DENTISTS,
  treatments: TREATMENTS,
  patients: cat.pacientes,
  appointments,
  waitlist,
  laboratories: LABORATORIOS,
  labJobs,
  behavior: {
    confirmProbability: COMPORTAMIENTO_BASE.confirmProbability,
    rescheduleProbability: COMPORTAMIENTO_BASE.rescheduleProbability,
    previousNoShowInfluence: { ...COMPORTAMIENTO_BASE.previousNoShowInfluence },
    scriptedRoles: { ...COMPORTAMIENTO_BASE.scriptedRoles },
  },
};
