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
 * Qué hará este paciente cuando reciba su recordatorio.
 *
 * Si el paciente tiene un rol asignado en ESCENARIO_DEMO, ese rol manda. Si no,
 * cae al reparto probabilístico: ~62 % confirma, ~13 % pide otro horario,
 * ~25 % no responde. Cada inasistencia previa empuja la balanza hacia el silencio
 * (como en la vida real y como refleja `risk.ts`), así el riesgo que muestra la
 * interfaz se corresponde con lo que luego pasa.
 *
 * `trasHoras` es cuánto tarda en responder desde el primer recordatorio. Para los
 * roles fijos es estable y legible (2 h confirma, 3 h reprograma, 2 h cancela),
 * para que los hitos caigan en horas redondas al avanzar el reloj.
 */
export function respuestaDe(
  appointmentId: string,
  pacienteId: string,
  inasistenciasPrevias: number,
): RespuestaSimulada {
  const rol = ESCENARIO_DEMO[pacienteId];
  if (rol === "confirma") return { tipo: "confirma", trasHoras: 2 };
  if (rol === "reprograma") return { tipo: "reprograma", trasHoras: 3 };
  if (rol === "cancela") return { tipo: "cancela", trasHoras: 2 };
  // silencio: no hay respuesta simulada; el motor levantará la alerta y la tarea.
  if (rol === "silencio") return { tipo: "silencio" };

  // Más faltas previas → más silencio. Tope para no volverse absurdo.
  const silencioExtra = Math.min(inasistenciasPrevias * 0.1, 0.25);
  const pConfirma = 0.62 - silencioExtra * 0.7;
  const pReprograma = 0.13 - silencioExtra * 0.3;

  const roll = unit(appointmentId, "tipo");
  // Entre 0.5 y 5 h, para que las respuestas lleguen espaciadas y no todas a la vez.
  const trasHoras = 0.5 + unit(appointmentId, "tras") * 4.5;

  if (roll < pConfirma) return { tipo: "confirma", trasHoras };
  if (roll < pConfirma + pReprograma) return { tipo: "reprograma", trasHoras };
  return { tipo: "silencio" };
}
