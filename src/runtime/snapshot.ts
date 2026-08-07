import type { AppointmentStatus } from "@/domain/engine";
import { riskOf, riskReason } from "@/domain/risk";
import { DEMO_END, DEMO_START } from "@/domain/seed";
import type { Catalogo, Reglas } from "@/domain/tipos";
import type { Mundo } from "./mundo";

/**
 * Estado completo de la clínica listo para pintar.
 *
 * Se arma en una sola pasada a partir del mundo reproducido: la interfaz no
 * calcula riesgos ni decide nada, solo dibuja. Así la vista nunca se desvía de
 * lo que dice el motor.
 */

export type Carril = "programada" | "recordada" | "confirmada" | "vencida";

export interface CitaVista {
  id: string;
  paciente: string;
  telefono: string;
  tratamiento: string;
  odontologo: string;
  colorOdontologo: string;
  startsAt: number;
  endsAt: number;
  status: AppointmentStatus;
  carril: Carril;
  soles: number;
  riesgo: number;
  motivo: string;
  inasistenciasPrevias: number;
  remindedAt: number | null;
  /** horas que lleva esperando respuesta desde el recordatorio */
  esperandoHoras: number | null;
  horasParaCita: number;
  activa: boolean;
}

export interface MensajeVista {
  id: string;
  citaId: string;
  entrante: boolean;
  cuerpo: string;
  enviadoEn: number;
  tipo: string;
}

export interface PendienteVista {
  citaId: string;
  motivo: string;
  desde: number;
}

export interface Snapshot {
  ahora: number;
  inicio: number;
  fin: number;
  reglas: Reglas;
  citas: CitaVista[];
  mensajes: MensajeVista[];
  pendientes: PendienteVista[];
  totales: {
    agendado: number;
    confirmado: number;
    esperando: number;
    vencido: number;
    /** plata de las citas que de verdad pueden caerse: suma de soles × riesgo */
    enRiesgo: number;
    citasVivas: number;
    confirmadasSinLlamar: number;
    recordatoriosEnviados: number;
    rescatado: number;
  };
  clinica: { odontologos: number; pacientes: number };
}

const HOUR = 3_600_000;

function carrilDe(status: AppointmentStatus): Carril | null {
  if (status === "scheduled") return "programada";
  if (status === "reminded") return "recordada";
  if (status === "confirmed") return "confirmada";
  if (status === "no_response" || status === "reschedule_requested") return "vencida";
  return null;
}

export function buildSnapshot(mundo: Mundo, cat: Catalogo, reglas: Reglas): Snapshot {
  const ahora = mundo.ahora;

  const pacientes = new Map(cat.pacientes.map((p) => [p.id, p]));
  const odontologos = new Map(cat.odontologos.map((d) => [d.id, d]));
  const tratamientos = new Map(cat.tratamientos.map((t) => [t.id, t]));

  const citas: CitaVista[] = mundo.citas.map((c) => {
    const p = pacientes.get(c.pacienteId);
    const d = odontologos.get(c.odontologoId);
    const t = tratamientos.get(c.tratamientoId);
    const status = c.status;
    const previas = p?.previousNoShows ?? 0;

    const entrada = { status, startsAt: c.startsAt, previousNoShows: previas, now: ahora };

    return {
      id: c.id,
      paciente: p?.fullName ?? "—",
      telefono: p?.phone ?? "",
      tratamiento: t?.name ?? "—",
      odontologo: d?.fullName ?? "—",
      colorOdontologo: d?.color ?? "#888",
      startsAt: c.startsAt.getTime(),
      endsAt: c.endsAt.getTime(),
      status,
      carril: carrilDe(status) ?? "programada",
      soles: (t?.priceCents ?? 0) / 100,
      riesgo: riskOf(entrada),
      motivo: riskReason({ ...entrada, remindedAt: c.remindedAt }),
      inasistenciasPrevias: previas,
      remindedAt: c.remindedAt?.getTime() ?? null,
      esperandoHoras: c.remindedAt
        ? Math.max(0, (ahora.getTime() - c.remindedAt.getTime()) / HOUR)
        : null,
      horasParaCita: (c.startsAt.getTime() - ahora.getTime()) / HOUR,
      activa: carrilDe(status) !== null,
    };
  });

  const vivas = citas.filter((c) => c.activa);
  const suma = (f: (c: CitaVista) => boolean) => vivas.filter(f).reduce((s, c) => s + c.soles, 0);

  const abiertas = mundo.alertas.filter((a) => !a.resolvedAt);
  const porCita = new Map(citas.map((c) => [c.id, c]));

  const pendientes: PendienteVista[] = [
    ...abiertas.map((a) => ({
      citaId: a.appointmentId,
      motivo: a.message,
      desde: a.createdAt.getTime(),
    })),
    ...vivas
      .filter((c) => c.status === "reschedule_requested")
      .map((c) => ({
        citaId: c.id,
        motivo: `${c.paciente} pidió otro horario`,
        desde: c.remindedAt ?? c.startsAt,
      })),
  ]
    .filter((p) => porCita.get(p.citaId)?.activa)
    .sort((a, b) => {
      const ca = porCita.get(a.citaId)!;
      const cb = porCita.get(b.citaId)!;
      const pa = (ca.soles * ca.riesgo) / Math.max(1, ca.horasParaCita);
      const pb = (cb.soles * cb.riesgo) / Math.max(1, cb.horasParaCita);
      return pb - pa;
    });

  const recordatorios = mundo.mensajes.filter((m) => m.kind.startsWith("reminder"));
  const confirmadas = vivas.filter((c) => c.status === "confirmed");

  return {
    ahora: ahora.getTime(),
    inicio: DEMO_START.getTime(),
    fin: DEMO_END.getTime(),
    reglas,
    citas,
    mensajes: mundo.mensajes.map((m) => ({
      id: m.id,
      citaId: m.appointmentId,
      entrante: m.direction === "inbound",
      cuerpo: m.body,
      enviadoEn: m.sentAt.getTime(),
      tipo: m.kind,
    })),
    pendientes,
    totales: {
      agendado: suma(() => true),
      confirmado: suma((c) => c.status === "confirmed"),
      esperando: suma((c) => c.status === "scheduled" || c.status === "reminded"),
      vencido: suma((c) => c.carril === "vencida"),
      enRiesgo: Math.round(vivas.reduce((s, c) => s + c.soles * c.riesgo, 0)),
      citasVivas: vivas.length,
      confirmadasSinLlamar: confirmadas.length,
      recordatoriosEnviados: recordatorios.length,
      rescatado: confirmadas.filter((c) => c.remindedAt !== null).reduce((s, c) => s + c.soles, 0),
    },
    clinica: { odontologos: cat.odontologos.length, pacientes: cat.pacientes.length },
  };
}
