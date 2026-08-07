import { messages } from "@/db/schema";
import type { Db } from "@/db";

/**
 * Canal de mensajería.
 *
 * El resto del sistema habla con esta interfaz y no sabe si detrás hay un
 * simulador o WhatsApp de verdad. Eso es lo que permite que la lógica de
 * negocio sea real aunque el envío no lo sea: el día que la clínica contrate
 * el número de WhatsApp Business, se implementa otro adaptador y no se toca
 * ni el motor ni el ejecutor.
 */
export interface OutboundMessage {
  appointmentId: string;
  patientId: string;
  phone: string;
  body: string;
  kind: string;
  sentAt: Date;
}

export interface MessageChannel {
  send(db: Db, msg: OutboundMessage): Promise<void>;
}

/**
 * Implementación de demo: en vez de salir a la red, deja el mensaje en la tabla
 * `messages`, que es lo que la interfaz muestra como bandeja. Nada se envía a
 * ningún teléfono real.
 */
export class SimulatedChannel implements MessageChannel {
  async send(db: Db, msg: OutboundMessage): Promise<void> {
    await db
      .insert(messages)
      .values({
        id: `m-${msg.appointmentId}-${msg.kind}-${msg.sentAt.getTime()}`,
        appointmentId: msg.appointmentId,
        patientId: msg.patientId,
        direction: "outbound",
        body: msg.body,
        sentAt: msg.sentAt,
        kind: msg.kind,
      })
      .onConflictDoNothing()
      .run();
  }
}

export const channel: MessageChannel = new SimulatedChannel();

/* ------------------------------------------------------------------ */
/* Redacción de los mensajes. Español neutro peruano, nunca rioplatense */
/* ------------------------------------------------------------------ */

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
