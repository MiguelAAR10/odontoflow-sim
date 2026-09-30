/**
 * Simulación del comportamiento del paciente.
 *
 * En la clínica real, buena parte de la gente contesta el recordatorio sin que
 * nadie llame — y eso es justamente el valor del producto. Esta simulación
 * reproduce ese comportamiento para que la demo cuente la historia completa.
 *
 * Es una SUPOSICIÓN, no un dato medido, y la interfaz lo dice con esas palabras.
 *
 * Determinista a propósito: la respuesta de cada paciente se deriva de su id, no
 * de un azar. La línea de tiempo se arrastra hacia atrás y el mismo instante
 * tiene que producir siempre el mismo mundo. Nada de Math.random ni fechas del sistema.
 *
 * ENCIMA del comportamiento probabilístico hay un reparto de ROLES fijos para los
 * pacientes-escenario de la demo (ver ESCENARIO_DEMO más abajo). Esos pacientes
 * siempre hacen lo mismo — confirman, reprograman, no responden o cancelan — para
 * que la presentación sea ensayable. El resto sigue el reparto probabilístico.
 */

/** Entero estable (uint32) a partir de un texto, vía FNV-1a. Mismo id → mismo número. */
function semilla(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Valor en [0, 1) derivado de un id y una sal, para desacoplar varias decisiones. */
function unit(id: string, sal: string): number {
  return (semilla(`${id}|${sal}`) % 1000) / 1000;
}

/** Rol fijo que un paciente-escenario representa en la demo. */
export type RolEscenario = "confirma" | "reprograma" | "silencio" | "cancela";

/**
 * Reparto de roles para los pacientes-escenario.
 *
 * Estos pacientes SIEMPRE cumplen su rol al recibir el primer recordatorio, sin
 * importar el hash. Así la historia de la demo es siempre la misma y se puede
 * ensayar. Están elegidos para que tengan citas futuras dentro de la ventana de
 * la demo (miércoles a domingo) y, en lo posible, horarios cómodos de narrar.
 *
 * Pacientes (ver seed.ts · NOMBRES):
 *   p10  Diego Manrique     → confirma       (la historia feliz)
 *   p17  Valeria Ochoa      → reprograma     (pide otro horario)
 *   p23  Raúl Ticona        → silencio       (no responde → 2° intento → tarea)
 *   p24  Mónica Arrieta     → cancela        (el momento principal de la demo)
 *
 * El paciente que ACEPTA el hueco tras una cancelación no vive acá: sale de la
 * lista de espera (w1–w5 en seed.ts) y es determinista por construcción.
 */
export const ESCENARIO_DEMO: Record<string, RolEscenario> = {
  p10: "confirma",
  p17: "reprograma",
  p23: "silencio",
  p24: "cancela",
};

export type RespuestaSimulada =
  | { tipo: "confirma"; trasHoras: number }
  | { tipo: "reprograma"; trasHoras: number }
  | { tipo: "cancela"; trasHoras: number }
  | { tipo: "silencio" };

/**
 * Parámetros del comportamiento simulado (V2.2 — Scenario Configuration).
 *
 * Antes de V2.2 estos números vivían hard-codeados acá mismo (0.62, 0.13, y la
 * fórmula de erosión 0.1/0.25/0.7/0.3). Ahora son un parámetro con default: la
 * forma de la fórmula NO cambió, solo se volvió configurable. Ver
 * `src/domain/scenario.ts` para el contrato completo (`ScenarioBehavior`, que
 * tiene exactamente esta forma con nombres en inglés para la capa de
 * escenarios) y `src/domain/scenario-compiler.ts` para cómo un
 * `ScenarioDefinition` produce uno de estos.
 */
export interface ComportamientoConfig {
  confirmProbability: number;
  rescheduleProbability: number;
  previousNoShowInfluence: {
    weightPerNoShow: number;
    cap: number;
    confirmShare: number;
    rescheduleShare: number;
  };
  /** Prioridad absoluta sobre el reparto probabilístico. Por defecto, ESCENARIO_DEMO. */
  scriptedRoles: Record<string, RolEscenario>;
}

/**
 * El comportamiento de siempre, como default explícito.
 *
 * `scriptedRoles: ESCENARIO_DEMO` por referencia: son el mismo objeto, no una
 * copia que pueda desincronizarse.
 */
export const COMPORTAMIENTO_BASE: ComportamientoConfig = {
  confirmProbability: 0.62,
  rescheduleProbability: 0.13,
  previousNoShowInfluence: { weightPerNoShow: 0.1, cap: 0.25, confirmShare: 0.7, rescheduleShare: 0.3 },
  scriptedRoles: ESCENARIO_DEMO,
};

/**
 * Qué hará este paciente cuando reciba su recordatorio.
 *
 * Si el paciente tiene un rol asignado en `comportamiento.scriptedRoles`, ese
 * rol manda. Si no, cae al reparto probabilístico de `comportamiento`
 * (por defecto: ~62 % confirma, ~13 % pide otro horario, ~25 % no responde).
 * Cada inasistencia previa empuja la balanza hacia el silencio (como en la
 * vida real y como refleja `risk.ts`), así el riesgo que muestra la interfaz
 * se corresponde con lo que luego pasa.
 *
 * `trasHoras` es cuánto tarda en responder desde el primer recordatorio. Para
 * los roles fijos es estable y legible (2 h confirma, 3 h reprograma, 2 h
 * cancela), para que los hitos caigan en horas redondas al avanzar el reloj.
 *
 * `comportamiento` es OPCIONAL y por defecto es `COMPORTAMIENTO_BASE` — el
 * comportamiento de siempre. Todo llamador existente (motor, tests) sigue
 * compilando y observando exactamente el mismo resultado sin cambiar una
 * línea.
 */
export function respuestaDe(
  appointmentId: string,
  pacienteId: string,
  inasistenciasPrevias: number,
  comportamiento: ComportamientoConfig = COMPORTAMIENTO_BASE,
): RespuestaSimulada {
  const rol = comportamiento.scriptedRoles[pacienteId];
  if (rol === "confirma") return { tipo: "confirma", trasHoras: 2 };
  if (rol === "reprograma") return { tipo: "reprograma", trasHoras: 3 };
  if (rol === "cancela") return { tipo: "cancela", trasHoras: 2 };
  // silencio: no hay respuesta simulada; el motor levantará la alerta y la tarea.
  if (rol === "silencio") return { tipo: "silencio" };

  // Más faltas previas → más silencio. Tope para no volverse absurdo.
  const inf = comportamiento.previousNoShowInfluence;
  const silencioExtra = Math.min(inasistenciasPrevias * inf.weightPerNoShow, inf.cap);
  const pConfirma = comportamiento.confirmProbability - silencioExtra * inf.confirmShare;
  const pReprograma = comportamiento.rescheduleProbability - silencioExtra * inf.rescheduleShare;

  const roll = unit(appointmentId, "tipo");
  // Entre 0.5 y 5 h, para que las respuestas lleguen espaciadas y no todas a la vez.
  const trasHoras = 0.5 + unit(appointmentId, "tras") * 4.5;

  if (roll < pConfirma) return { tipo: "confirma", trasHoras };
  if (roll < pConfirma + pReprograma) return { tipo: "reprograma", trasHoras };
  return { tipo: "silencio" };
}
