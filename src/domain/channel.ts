/**
 * Redacción de los mensajes que "envía" la clínica.
 *
 * El canal ya no es un adaptador con base de datos: la app es full frontend y
 * los mensajes viven en memoria como parte del mundo reproducido. Lo que sí se
 * mantiene es la voz: español neutro peruano, nunca rioplatense, y los textos
 * breves y con instrucción clara que un paciente lee en WhatsApp.
 */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export interface PlantillaCita {
  paciente: string;
  tratamiento: string;
  odontologo: string;
  startsAt: Date;
}

const nombrePila = (completo: string) => completo.split(" ")[0];

export function textoRecordatorio24h(c: PlantillaCita): string {
  return (
    `Hola ${nombrePila(c.paciente)}, te recordamos tu cita de ${c.tratamiento.toLowerCase()} ` +
    `el ${DIAS[c.startsAt.getDay()]} ${c.startsAt.getDate()} a las ${hhmm(c.startsAt)} ` +
    `con ${c.odontologo}.\n\nResponde 1 para confirmar o 2 si necesitas otro horario.`
  );
}

export function textoRecordatorio2h(c: PlantillaCita): string {
  return (
    `${nombrePila(c.paciente)}, tu cita de ${c.tratamiento.toLowerCase()} es hoy a las ` +
    `${hhmm(c.startsAt)} con ${c.odontologo}. Te esperamos.\n\n` +
    `Responde 1 para confirmar o 2 si necesitas otro horario.`
  );
}

export function textoConfirmacion(c: PlantillaCita): string {
  return (
    `Listo ${nombrePila(c.paciente)}, tu cita quedó confirmada para el ` +
    `${DIAS[c.startsAt.getDay()]} ${c.startsAt.getDate()} a las ${hhmm(c.startsAt)}. Te esperamos.`
  );
}

export function textoReprogramacion(c: PlantillaCita): string {
  return (
    `Con gusto, ${nombrePila(c.paciente)}. Recepción se comunicará contigo para encontrar ` +
    `un horario que te acomode.`
  );
}
