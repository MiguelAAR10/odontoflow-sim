import type { ScenarioDefinition } from "@/domain/scenario";
import { baselineScenario } from "./baseline";

/**
 * `cancellation-recovery` — más cancelaciones que terminan recuperadas desde
 * la lista de espera.
 *
 * SINTÉTICO Y DECLARADO COMO TAL: se guionan 4 pacientes ADICIONALES (encima
 * de p24, que ya cancela en `baseline`) para que cancelen su cita al recibir
 * el recordatorio. Cada uno fue elegido porque su cita coincide en tratamiento
 * y doctor con un candidato YA EXISTENTE de la lista de espera del seed
 * (`baseline.waitlist`, sin cambios acá), así que el ciclo
 * cancelar → ofertar → aceptar → recuperada tiene más ocasiones reales de
 * completarse, con los mismos datos de siempre:
 *
 *   p19 (mié 14:30, Resina/Dr. Quispe)      → coincide con w1 (t1, d1)
 *   p18 (mié 13:00, Resina/Dr. Quispe)       → coincide con w2 (t4, cualquiera)
 *   p27 (jue, Endodoncia/Dr. Salazar)        → coincide con w3 (t2, d2)
 *   p12 (sáb, Implante/Dr. Mendoza)          → coincide con w4 (t6, d4)
 *
 * Ninguno de los cuatro es un paciente-escenario existente (p10/p17/p23/p24),
 * así que no hay conflicto de roles. Pacientes, doctores, tratamientos, citas,
 * lista de espera, laboratorios, calendario y reglas son IDÉNTICOS a
 * `baseline` — nada de esto inventa datos nuevos, solo guiona un
 * comportamiento distinto sobre datos que ya eran válidos.
 */
export const cancellationRecoveryScenario: ScenarioDefinition = {
  ...baselineScenario,
  metadata: {
    id: "cancellation-recovery",
    name: "Recuperación de cancelaciones (sintético)",
    description:
      "Mismos datos que baseline; 4 pacientes adicionales guionados para cancelar (p12, p18, p19, p27), cada uno coincidente con un candidato ya existente en la lista de espera, para ejercitar cancelar → ofertar → recuperar con más frecuencia.",
  },
  behavior: {
    ...baselineScenario.behavior,
    scriptedRoles: {
      ...baselineScenario.behavior.scriptedRoles,
      p12: "cancela",
      p18: "cancela",
      p19: "cancela",
      p27: "cancela",
    },
  },
};
