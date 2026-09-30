import type { ScenarioDefinition } from "@/domain/scenario";
import { baselineScenario } from "./baseline";

/**
 * `no-show-heavy` — más presión de silencio/inasistencia.
 *
 * SINTÉTICO Y DECLARADO COMO TAL: estos números no salen de ninguna clínica
 * real, son una hipótesis a propósito más pesimista que `baseline` para
 * ejercitar el camino de silencio → alerta → tarea de recepción con más
 * frecuencia. Ver `odontoflow-sim/CANONICAL.md` sobre la frontera de datos
 * sintéticos.
 *
 * Todo lo demás (pacientes, doctores, tratamientos, citas, lista de espera,
 * laboratorios, calendario, reglas) es idéntico a `baseline` — solo cambian
 * las probabilidades de comportamiento. Los 4 pacientes-escenario
 * (`scriptedRoles`) se conservan sin cambios: siguen siendo la historia
 * ensayable de siempre: lo que cambia es el reparto probabilístico del RESTO
 * de los pacientes.
 */
export const noShowHeavyScenario: ScenarioDefinition = {
  ...baselineScenario,
  metadata: {
    id: "no-show-heavy",
    name: "Presión de inasistencias (sintético)",
    description:
      "Hipótesis SINTÉTICA, no medida: confirmación 35%, reprogramación 10%, silencio 55% (vs. 62/13/25 en baseline). Para ejercitar el camino recordatorio → silencio → alerta → tarea de recepción con más frecuencia.",
  },
  behavior: {
    confirmProbability: 0.35,
    rescheduleProbability: 0.1,
    previousNoShowInfluence: {
      weightPerNoShow: 0.15,
      cap: 0.35,
      confirmShare: 0.8,
      rescheduleShare: 0.2,
    },
    scriptedRoles: baselineScenario.behavior.scriptedRoles,
  },
};
