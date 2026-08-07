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

export type RespuestaSimulada =
  | { tipo: "confirma"; trasHoras: number }
  | { tipo: "reprograma"; trasHoras: number }
  | { tipo: "silencio" };

/**
 * Qué hará este paciente cuando reciba su recordatorio.
 *
 * Reparto base sobre quien tiene cero inasistencias previas: ~62 % confirma,
 * ~13 % pide otro horario, ~25 % no responde. Cada inasistencia previa empuja
 * la balanza hacia el silencio (como en la vida real y como refleja `risk.ts`),
 * así el riesgo que muestra la interfaz se corresponde con lo que luego pasa.
 */
export function respuestaDe(
  appointmentId: string,
  inasistenciasPrevias: number,
): RespuestaSimulada {
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
