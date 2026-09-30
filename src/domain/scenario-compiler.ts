import type { ComportamientoConfig } from "./paciente-sim";
import type { ScenarioDefinition } from "./scenario";
import type { Catalogo, Cita, CandidatoListaEspera, TrabajoLaboratorio } from "./tipos";

/**
 * El compilador puro: `ScenarioDefinition` → `Catalogo`.
 *
 * Esta es la frontera exacta que pidió el brief: el runtime (`mundo.ts`,
 * `horario.ts`, `snapshot.ts`, `siguiente-evento.ts`) sigue recibiendo la
 * MISMA forma de `Catalogo` que ya conocía antes de V2.2 — cero campos nuevos,
 * cero cambios en esos archivos. Todo lo que cambia es de dónde sale ese
 * `Catalogo`: antes, siempre de `seed.ts::catalogoBase()`; ahora, de cualquier
 * `ScenarioDefinition` válido, incluida la escena `baseline` que reproduce el
 * seed original exactamente (ver `scenarios/baseline.ts` y su test de
 * equivalencia).
 *
 * Pura y determinista: dos llamadas con el mismo escenario devuelven objetos
 * distintos con exactamente los mismos valores — igual que `catalogoBase()`
 * ya lo era.
 */
export function compileScenario(scenario: ScenarioDefinition): Catalogo {
  const tratamientoPorId = new Map(scenario.treatments.map((t) => [t.id, t]));

  const citas: Cita[] = scenario.appointments.map((a) => {
    const tratamiento = tratamientoPorId.get(a.treatmentId);
    if (!tratamiento) {
      throw new Error(
        `compileScenario: la cita "${a.id}" referencia el tratamiento "${a.treatmentId}", que no existe en el escenario.`,
      );
    }
    const endsAt = new Date(a.startsAt.getTime() + tratamiento.durationMin * 60_000);
    return {
      id: a.id,
      pacienteId: a.patientId,
      odontologoId: a.doctorId,
      tratamientoId: a.treatmentId,
      startsAt: a.startsAt,
      endsAt,
      status: a.status,
      remindedAt: null,
    };
  });

  const listaEspera: CandidatoListaEspera[] = scenario.waitlist.map((w) => ({
    id: w.id,
    pacienteId: w.patientId,
    tratamientoId: w.treatmentId,
    odontologoId: w.doctorId,
    desde: w.from,
    hasta: w.until,
    createdAt: w.createdAt,
  }));

  const trabajosLab: TrabajoLaboratorio[] = scenario.labJobs.map((j) => ({
    id: j.id,
    pacienteId: j.patientId,
    tratamientoId: j.treatmentId,
    laboratorioId: j.labId,
    odontologoId: j.doctorId,
    enviadoEn: j.sentAt,
    prometidoEn: j.promisedAt,
    estado: j.status,
    responsable: j.owner,
  }));

  return {
    pacientes: scenario.patients,
    odontologos: scenario.doctors,
    tratamientos: scenario.treatments,
    citas,
    reglas: { ...scenario.rules },
    listaEspera,
    laboratorios: scenario.laboratories,
    trabajosLab,
  };
}

/**
 * El comportamiento simulado que le corresponde a un escenario, en la forma
 * que ya consume `respuestaDe` (ver `paciente-sim.ts`). Sibling deliberado de
 * `compileScenario`: dos funciones puras pequeñas, en vez de una que devuelva
 * una tupla — cada una testeable por separado.
 */
export function compileComportamiento(scenario: ScenarioDefinition): ComportamientoConfig {
  return {
    confirmProbability: scenario.behavior.confirmProbability,
    rescheduleProbability: scenario.behavior.rescheduleProbability,
    previousNoShowInfluence: { ...scenario.behavior.previousNoShowInfluence },
    scriptedRoles: { ...scenario.behavior.scriptedRoles },
  };
}

/**
 * Overrides de edición desde la UI (V2.2 §7): reemplazo TOTAL de una sección,
 * nunca fusión parcial — la semántica más simple y con menor superficie de
 * bugs. Pacientes, citas, lista de espera y calendario NO son editables en
 * V2.2 (alcance explícito del brief), así que no tienen override.
 */
export interface ScenarioOverrides {
  doctors?: ScenarioDefinition["doctors"];
  treatments?: ScenarioDefinition["treatments"];
  rules?: ScenarioDefinition["rules"];
  behavior?: ScenarioDefinition["behavior"];
}

/**
 * El escenario EFECTIVO: la definición base con los overrides ya aplicados.
 * Pura. El resultado se valida con `validateScenario` antes de guardarse —
 * ver `OdontoStore.tsx`.
 */
export function applyScenarioOverrides(
  base: ScenarioDefinition,
  overrides: ScenarioOverrides,
): ScenarioDefinition {
  return {
    ...base,
    doctors: overrides.doctors ?? base.doctors,
    treatments: overrides.treatments ?? base.treatments,
    rules: overrides.rules ?? base.rules,
    behavior: overrides.behavior ?? base.behavior,
  };
}
