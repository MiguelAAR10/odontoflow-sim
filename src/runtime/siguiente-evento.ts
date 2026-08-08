import type { Catalogo, Reglas, UserEvent } from "@/domain/tipos";
import { DEMO_END } from "@/domain/seed";
import { reproducir } from "./mundo";
import { buildSnapshot, type Snapshot } from "./snapshot";

/**
 * Calcula el próximo instante en que el mundo de la clínica cambia de forma
 * visible (un recordatorio, una respuesta, una alerta, una recuperación, una
 * reprogramación, una cita que se completa). Devuelve null si no hay más eventos
 * hasta el fin de la demo.
 *
 * Es lo que alimenta el botón «Siguiente evento»: permite presentar la demo con
 * un solo clic por hito, sin calcular tiempos a mano.
 *
 * Determinista por construcción: compara huellas compactas del snapshot en cada
 * paso de media hora hasta encontrar la primera diferencia.
 */

const STEP_MS = 30 * 60_000;

/** Huella compacta del mundo: si cambia, algo importante pasó. */
function huella(s: Snapshot): string {
  const porStatus: Record<string, number> = {};
  for (const c of s.citas) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
  return [
    s.totales.recordatoriosEnviados,
    s.totales.confirmadasSinLlamar,
    s.totales.recuperado,
    s.totales.cancelado,
    s.totales.completadas,
    s.operaciones.length,
    s.actividad.length,
    s.mensajes.length,
    JSON.stringify(porStatus),
  ].join("|");
}

export function siguienteEvento(
  cat: Catalogo,
  eventos: UserEvent[],
  reglas: Reglas,
  ahoraMs: number,
): number | null {
  const base = huella(buildSnapshot(reproducir(cat, eventos, reglas, new Date(ahoraMs)), cat, reglas));
  for (let t = ahoraMs + STEP_MS; t <= DEMO_END.getTime(); t += STEP_MS) {
    const snap = buildSnapshot(reproducir(cat, eventos, reglas, new Date(t)), cat, reglas);
    if (huella(snap) !== base) return t;
  }
  return null;
}
