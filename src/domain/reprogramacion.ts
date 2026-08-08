import type { Cita } from "./tipos";

/**
 * Propuesta automática de horarios cuando un paciente pide reprogramar.
 *
 * Busca huecos libres en la agenda del odontólogo de la cita (y de la clínica)
 * dentro de los próximos días hábiles, sin pisar otras citas. Determinista: las
 * opciones se generan a partir del catálogo y del instante `desde`, en orden fijo,
 * así la reprogramación simulada siempre elige la misma opción para la misma cita.
 *
 * Es una propuesta de DEMO: las reglas son simples y los horarios son los del
 * propio catálogo de la demo, no un motor de agenda real.
 */

const DAY = 86_400_000;

export interface OpcionHorario {
  startsAt: Date;
  endsAt: Date;
  etiqueta: string;
}

/**
 * Genera hasta `max` opciones de horario para reagendar `cita`, empezando desde
 * `desde`. Solo devuelve huecos dentro del horario de atención y que no solapen
 * con citas vivas del mismo odontólogo.
 */
export function opcionesParaReprogramar(
  cita: Cita,
  citas: { odontologoId: string; startsAt: Date; endsAt: Date; status: string; id: string }[],
  reglas: { clinicOpenHour: number; clinicCloseHour: number },
  tratamientoDurMin: number,
  desde: Date,
  max = 3,
): OpcionHorario[] {
  const durMs = tratamientoDurMin * 60_000;
  const abre = reglas.clinicOpenHour;
  const cierra = reglas.clinicCloseHour;

  // citas vivas del mismo odontólogo (no canceladas/no_show/completadas pasadas)
  const ocupadas = citas
    .filter(
      (c) =>
        c.odontologoId === cita.odontologoId &&
        c.id !== cita.id &&
        c.status !== "cancelled" &&
        c.status !== "no_show",
    )
    .map((c) => ({ ini: c.startsAt.getTime(), fin: c.endsAt.getTime() }));

  const solapa = (ini: number, fin: number) =>
    ocupadas.some((o) => ini < o.fin && fin > o.ini);

  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const out: OpcionHorario[] = [];
  // Arranca al día siguiente del `desde`, para no proponer "hoy mismo".
  const base = new Date(desde);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + 1);

  for (let d = 0; d < 10 && out.length < max; d++) {
    const dia = new Date(base.getTime() + d * DAY);
    // saltar domingos salvo que la clínica abra (en la demo abre domingo de guardia)
    for (let h = abre; h < cierra && out.length < max; h += 0.5) {
      const ini = new Date(dia);
      ini.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
      const fin = new Date(ini.getTime() + durMs);
      if (fin.getHours() + fin.getMinutes() / 60 > cierra) continue;
      if (solapa(ini.getTime(), fin.getTime())) continue;
      out.push({
        startsAt: ini,
        endsAt: fin,
        etiqueta: `${DIAS[ini.getDay()]} ${hhmm(ini)}`,
      });
    }
  }
  return out;
}

/** Índice determinista (0..n-1) de la opción que "elige" el paciente, por id de cita. */
export function opcionElegida(citaId: string, total: number): number {
  if (total <= 0) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < citaId.length; i++) {
    h ^= citaId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % total;
}
