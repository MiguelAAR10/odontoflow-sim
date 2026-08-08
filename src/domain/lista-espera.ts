import type { CandidatoListaEspera, Cita } from "./tipos";

/**
 * Selección de candidatos de la lista de espera para un hueco que se libera.
 *
 * Un hueco se libera cuando un paciente cancela. El sistema busca entre los
 * candidatos a quién le sirve ese espacio: mismo tratamiento (o sin
 * preferencia), mismo odontólogo (o sin preferencia) y dentro de la ventana
 * horaria que el candidato declaró. No inventa pacientes ni reasigna sin
 * aceptación: solo propone quién debería recibir la oferta.
 *
 * Devuelve los candidatos compatibles ordenados por antigüedad de la solicitud
 * (el que más tiempo lleva esperando se ofrece primero).
 */
export function candidatosParaHueco(
  cita: { odontologoId: string; tratamientoId: string; startsAt: Date },
  lista: CandidatoListaEspera[],
  ahora: Date,
): CandidatoListaEspera[] {
  const t = cita.startsAt.getTime();
  return lista
    .filter((c) => {
      // la ventana horaria del candidato debe contener el hueco
      if (c.desde.getTime() > t) return false;
      if (c.hasta && c.hasta.getTime() < t) return false;
      // preferencias: null = le sirve cualquiera
      if (c.tratamientoId && c.tratamientoId !== cita.tratamientoId) return false;
      if (c.odontologoId && c.odontologoId !== cita.odontologoId) return false;
      // un candidato que ya caducó respecto del reloj no se ofrece
      if (c.hasta && c.hasta.getTime() < ahora.getTime()) return false;
      return true;
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** ¿Cuántos candidatos compatibles hay para este hueco? Para etiquetas y alertas. */
export function cuentaCandidatos(
  cita: { odontologoId: string; tratamientoId: string; startsAt: Date },
  lista: CandidatoListaEspera[],
  ahora: Date,
): number {
  return candidatosParaHueco(cita, lista, ahora).length;
}

/**
 * El primero de la fila que aceptaría el hueco.
 *
 * Determinista por construcción: el orden de la lista viene de `createdAt` fijo
 * del seed, así que el mismo instante del reloj siempre ofrece al mismo
 * paciente. Si nadie es compatible, devuelve null.
 */
export function primerCandidato(
  cita: Cita,
  lista: CandidatoListaEspera[],
  ahora: Date,
): CandidatoListaEspera | null {
  return candidatosParaHueco(cita, lista, ahora)[0] ?? null;
}
