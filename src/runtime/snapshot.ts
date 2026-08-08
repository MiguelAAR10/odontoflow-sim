import type { EventoActividad } from "@/domain/tipos";
import type { AppointmentStatus } from "@/domain/engine";
import type { DiaSemana } from "@/domain/tipos";
import { riskOf, riskReason } from "@/domain/risk";
import { cuentaCandidatos, candidatosParaHueco } from "@/domain/lista-espera";
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

export type Carril = "programada" | "recordada" | "confirmada" | "vencida" | "recuperada" | "cancelada";

export interface CitaVista {
  id: string;
  paciente: string;
  telefono: string;
  tratamiento: string;
  tratamientoId: string;
  odontologo: string;
  odontologoId: string;
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
  /** true si esta cita fue recuperada desde la lista de espera */
  recuperada: boolean;
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
  /** para ordenar y agrupar la cola de operaciones */
  prioridad: number;
  /** tipo de acción para etiquetar y agrupar */
  clase: "sin_respuesta" | "reprogramacion" | "hueco_libre" | "retraso_lab" | "cancelacion";
}

export interface DoctorVista {
  id: string;
  fullName: string;
  specialty: string;
  color: string;
  diasAtiende: DiaSemana[];
  /** atiende hoy según el reloj virtual */
  atiendeHoy: boolean;
  /** citas activas de hoy para este doctor */
  citasHoy: CitaVista[];
  /** huecos hoy (cancelados sin reasignar dentro de la jornada) */
  huecosHoy: number;
  /** cuánto de su día de hoy está confirmado vs en riesgo */
  confirmadoHoy: number;
  enRiesgoHoy: number;
}

export interface PacienteVista {
  id: string;
  fullName: string;
  phone: string;
  inasistenciasPrevias: number;
  proximaCita?: { id: string; startsAt: number; tratamiento: string; odontologo: string };
  enListaEspera: boolean;
}

export interface ListaEsperaVista {
  id: string;
  paciente: string;
  tratamiento: string | null;
  odontologo: string | null;
  desde: number;
  hasta: number | null;
  createdAt: number;
}

export interface TrabajoLabVista {
  id: string;
  paciente: string;
  tratamiento: string;
  laboratorio: string;
  odontologo: string;
  enviadoEn: number;
  prometidoEn: number;
  estado: string;
  responsable: string;
  /** horas de retraso respecto de la fecha prometida; null si va en tiempo */
  retrasoHoras: number | null;
}

export interface ActividadVista {
  id: string;
  at: number;
  citaId: string | null;
  paciente: string | null;
  texto: string;
  clase: EventoActividad["clase"];
  accionHumana: boolean;
}

/** Candidato de la lista de espera que califica para un hueco, con su motivo. */
export interface CandidatoElegibleVista {
  candidatoId: string;
  paciente: string;
  tratamiento: string | null;
  odontologo: string | null;
  motivos: string[];
}

export interface Snapshot {
  ahora: number;
  inicio: number;
  fin: number;
  reglas: Reglas;
  citas: CitaVista[];
  mensajes: MensajeVista[];
  pendientes: PendienteVista[];
  doctores: DoctorVista[];
  pacientes: PacienteVista[];
  listaEspera: ListaEsperaVista[];
  trabajosLab: TrabajoLabVista[];
  /** cola de operaciones: lo que necesita atención hoy, priorizado */
  operaciones: PendienteVista[];
  /** feed cronológico de hitos automatizados (registro de actividad) */
  actividad: ActividadVista[];
  /** candidatos elegibles para cada cita cancelada, para mostrar en Agenda */
  elegiblesPorCita: Record<string, CandidatoElegibleVista[]>;
  totales: {
    agendado: number;
    confirmado: number;
    esperando: number;
    vencido: number;
    cancelado: number;
    recuperado: number;
    /** citas ya atendidas (status completed), vivo o no — para que el contador no "pierda" citas */
    completadas: number;
    /** valor (soles) de las citas recuperadas — nunca "dinero ganado" */
    valorRecuperado: number;
    /** plata de las citas que de verdad pueden caerse: suma de soles × riesgo */
    enRiesgo: number;
    /** valor de las citas pendientes de confirmación (no "dinero en riesgo") */
    valorPendiente: number;
    citasVivas: number;
    confirmadasSinLlamar: number;
    recordatoriosEnviados: number;
    rescatado: number;
    /** huecos disponibles que pueden recuperarse hoy */
    espaciosRecuperables: number;
    /** labos vencidos o próximos a vencer */
    labosEnRiesgo: number;
  };
  clinica: { odontologos: number; pacientes: number };
}

const HOUR = 3_600_000;
const DIA_LABEL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function carrilDe(status: AppointmentStatus): Carril {
  if (status === "scheduled") return "programada";
  if (status === "reminded") return "recordada";
  if (status === "confirmed") return "confirmada";
  if (status === "recovered") return "recuperada";
  if (status === "cancelled") return "cancelada";
  if (status === "no_response" || status === "reschedule_requested") return "vencida";
  return "programada";
}

/** Una cita "activa" es la que todavía está en juego para el día de la agenda. */
function estaActiva(status: AppointmentStatus): boolean {
  return (
    status === "scheduled" ||
    status === "reminded" ||
    status === "confirmed" ||
    status === "no_response" ||
    status === "reschedule_requested" ||
    status === "recovered"
  );
}

function mismoDia(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
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
      tratamientoId: c.tratamientoId,
      odontologo: d?.fullName ?? "—",
      odontologoId: c.odontologoId,
      colorOdontologo: d?.color ?? "#888",
      startsAt: c.startsAt.getTime(),
      endsAt: c.endsAt.getTime(),
      status,
      carril: carrilDe(status),
      soles: (t?.priceCents ?? 0) / 100,
      riesgo: riskOf(entrada),
      motivo: riskReason({ ...entrada, remindedAt: c.remindedAt }),
      inasistenciasPrevias: previas,
      remindedAt: c.remindedAt?.getTime() ?? null,
      esperandoHoras: c.remindedAt
        ? Math.max(0, (ahora.getTime() - c.remindedAt.getTime()) / HOUR)
        : null,
      horasParaCita: (c.startsAt.getTime() - ahora.getTime()) / HOUR,
      activa: estaActiva(status),
      recuperada: status === "recovered",
    };
  });

  const vivas = citas.filter((c) => c.activa);
  const suma = (f: (c: CitaVista) => boolean) => vivas.filter(f).reduce((s, c) => s + c.soles, 0);

  const abiertas = mundo.alertas.filter((a) => !a.resolvedAt);
  const porCita = new Map(citas.map((c) => [c.id, c]));

  // --- Doctores ---
  const hoyDia = new Date(ahora).getDay() as DiaSemana;
  const doctores: DoctorVista[] = cat.odontologos.map((d) => {
    const atiendeHoy = d.diasAtiende.length === 0 ? true : d.diasAtiende.includes(hoyDia);
    const citasDocHoy = vivas.filter((c) => c.odontologoId === d.id && mismoDia(c.startsAt, ahora.getTime()));
    const huecosHoy = citas.filter(
      (c) => c.odontologoId === d.id && mismoDia(c.startsAt, ahora.getTime()) && c.status === "cancelled",
    ).length;
    const confirmadoHoy = citasDocHoy.filter((c) => c.status === "confirmed" || c.status === "recovered").reduce(
      (s, c) => s + c.soles,
      0,
    );
    const enRiesgoHoy = citasDocHoy
      .filter((c) => c.status !== "confirmed" && c.status !== "recovered")
      .reduce((s, c) => s + c.soles * c.riesgo, 0);
    return {
      id: d.id,
      fullName: d.fullName,
      specialty: d.specialty,
      color: d.color,
      diasAtiende: d.diasAtiende,
      atiendeHoy,
      citasHoy: citasDocHoy,
      huecosHoy,
      confirmadoHoy,
      enRiesgoHoy,
    };
  });

  // --- Pacientes ---
  const idsEnLista = new Set(cat.listaEspera.map((w) => w.pacienteId));
  const pacientesVista: PacienteVista[] = cat.pacientes.map((p) => {
    const proxima = vivas
      .filter((c) => c.telefono === p.phone)
      .sort((a, b) => a.startsAt - b.startsAt)[0];
    return {
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
      inasistenciasPrevias: p.previousNoShows,
      enListaEspera: idsEnLista.has(p.id),
      proximaCita: proxima
        ? {
            id: proxima.id,
            startsAt: proxima.startsAt,
            tratamiento: proxima.tratamiento,
            odontologo: proxima.odontologo,
          }
        : undefined,
    };
  });

  // --- Lista de espera ---
  const listaEspera: ListaEsperaVista[] = cat.listaEspera.map((w) => ({
    id: w.id,
    paciente: pacientes.get(w.pacienteId)?.fullName ?? "—",
    tratamiento: w.tratamientoId ? tratamientos.get(w.tratamientoId)?.name ?? null : null,
    odontologo: w.odontologoId ? odontologos.get(w.odontologoId)?.fullName ?? null : null,
    desde: w.desde.getTime(),
    hasta: w.hasta?.getTime() ?? null,
    createdAt: w.createdAt.getTime(),
  }));

  // --- Laboratorios ---
  const trabajosLab: TrabajoLabVista[] = cat.trabajosLab.map((t) => {
    const prometido = t.prometidoEn.getTime();
    const retrasoMs = ahora.getTime() - prometido;
    const estaVencido = retrasoMs > 0 && t.estado !== "entregado" && t.estado !== "recibido";
    return {
      id: t.id,
      paciente: pacientes.get(t.pacienteId)?.fullName ?? "—",
      tratamiento: tratamientos.get(t.tratamientoId)?.name ?? "—",
      laboratorio: cat.laboratorios.find((l) => l.id === t.laboratorioId)?.nombre ?? "—",
      odontologo: odontologos.get(t.odontologoId)?.fullName ?? "—",
      enviadoEn: t.enviadoEn.getTime(),
      prometidoEn: prometido,
      estado: t.estado,
      responsable: t.responsable,
      retrasoHoras: estaVencido ? retrasoMs / HOUR : null,
    };
  });
  const labosEnRiesgo = trabajosLab.filter(
    (t) => t.retrasoHoras !== null || (t.estado !== "entregado" && t.estado !== "recibido" && t.prometidoEn - ahora.getTime() < 24 * HOUR),
  ).length;

  // --- Cola de operaciones (acciones priorizadas) ---
  // reúne todo lo que requiere atención, con su clase y prioridad.
  const operacionesRaw: PendienteVista[] = [];

  for (const a of abiertas) {
    const c = porCita.get(a.appointmentId);
    const clase: PendienteVista["clase"] =
      a.kind === "bloque_vacio" ? "hueco_libre" : a.kind === "no_response" ? "sin_respuesta" : "sin_respuesta";
    operacionesRaw.push({
      citaId: a.appointmentId,
      motivo: a.message,
      desde: a.createdAt.getTime(),
      clase,
      prioridad: (c?.soles ?? 0) * (c?.riesgo ?? 1) + (clase === "hueco_libre" ? 5000 : 0),
    });
  }
  for (const c of vivas) {
    if (c.status === "reschedule_requested") {
      operacionesRaw.push({
        citaId: c.id,
        motivo: `${c.paciente} pidió reprogramar (${c.tratamiento.toLowerCase()})`,
        desde: c.remindedAt ?? c.startsAt,
        clase: "reprogramacion",
        prioridad: c.soles * c.riesgo + 2000,
      });
    }
  }
  // laboratorios vencidos o al límite
  for (const t of trabajosLab) {
    if (t.retrasoHoras !== null) {
      operacionesRaw.push({
        citaId: t.id,
        motivo: `${t.paciente} · ${t.tratamiento.toLowerCase()} en ${t.laboratorio} venció hace ${Math.round(t.retrasoHoras)} h`,
        desde: t.prometidoEn,
        clase: "retraso_lab",
        prioridad: 8000 + t.retrasoHoras * 50,
      });
    } else if (t.estado !== "entregado" && t.estado !== "recibido" && t.prometidoEn - ahora.getTime() < 24 * HOUR) {
      operacionesRaw.push({
        citaId: t.id,
        motivo: `${t.paciente} · ${t.tratamiento.toLowerCase()} vence pronto en ${t.laboratorio}`,
        desde: t.prometidoEn,
        clase: "retraso_lab",
        prioridad: 4000,
      });
    }
  }
  // huecos cancelados con candidatos (recuperables)
  const recuperables = citas.filter((c) => c.status === "cancelled" && cuentaCandidatos(
    { odontologoId: c.odontologoId, tratamientoId: c.tratamientoId, startsAt: new Date(c.startsAt) },
    cat.listaEspera,
    ahora,
  ) > 0);
  for (const c of recuperables) {
    if (operacionesRaw.some((o) => o.citaId === c.id)) continue;
    operacionesRaw.push({
      citaId: c.id,
      motivo: `Espacio de ${c.tratamiento.toLowerCase()} liberado; hay candidatos en lista de espera`,
      desde: ahora.getTime(),
      clase: "hueco_libre",
      prioridad: c.soles + 3000,
    });
  }

  const operaciones = operacionesRaw.sort((a, b) => b.prioridad - a.prioridad);

  // pendientes (cola clásica de decisión, usada por la Agenda y Operación)
  const pendientes: PendienteVista[] = [
    ...abiertas
      .filter((a) => a.kind !== "bloque_vacio")
      .map((a) => {
        const c = porCita.get(a.appointmentId);
        return {
          citaId: a.appointmentId,
          motivo: a.message,
          desde: a.createdAt.getTime(),
          clase: "sin_respuesta" as const,
          prioridad: (c?.soles ?? 0) * (c?.riesgo ?? 1),
        };
      }),
    ...vivas
      .filter((c) => c.status === "reschedule_requested")
      .map((c) => ({
        citaId: c.id,
        motivo: `${c.paciente} pidió otro horario`,
        desde: c.remindedAt ?? c.startsAt,
        clase: "reprogramacion" as const,
        prioridad: c.soles * c.riesgo + 2000,
      })),
  ]
    .filter((p) => {
      const c = porCita.get(p.citaId);
      return c && c.activa;
    })
    .sort((a, b) => b.prioridad - a.prioridad);

  const recordatorios = mundo.mensajes.filter((m) => m.kind.startsWith("reminder"));
  const confirmadas = vivas.filter((c) => c.status === "confirmed");
  const recuperadas = vivas.filter((c) => c.status === "recovered");
  const canceladas = citas.filter((c) => c.status === "cancelled");
  const completadasTodas = citas.filter((c) => c.status === "completed");
  const pendientesConfirmacion = vivas.filter(
    (c) => c.status === "scheduled" || c.status === "reminded" || c.status === "no_response" || c.status === "reschedule_requested",
  );

  // --- Feed de actividad cronológico ---
  // Solo los hitos que ocurrieron hasta el instante actual, ordenados del más reciente al más viejo.
  const actividad: ActividadVista[] = mundo.actividad
    .filter((a) => a.at.getTime() <= ahora.getTime())
    .map((a) => ({
      id: a.id,
      at: a.at.getTime(),
      citaId: a.appointmentId,
      paciente: a.pacienteId ? pacientes.get(a.pacienteId)?.fullName ?? null : null,
      texto: a.texto,
      clase: a.clase,
      accionHumana: a.accionHumana,
    }))
    .sort((a, b) => b.at - a.at);

  // --- Candidatos elegibles por cita cancelada (para el panel de Agenda) ---
  const elegiblesPorCita: Record<string, CandidatoElegibleVista[]> = {};
  for (const c of citas.filter((x) => x.status === "cancelled")) {
    const cands = candidatosParaHueco(
      { odontologoId: c.odontologoId, tratamientoId: c.tratamientoId, startsAt: new Date(c.startsAt) },
      cat.listaEspera,
      ahora,
    );
    if (cands.length === 0) continue;
    elegiblesPorCita[c.id] = cands.map((cand) => {
      const motivos: string[] = ["lista de espera"];
      if (cand.tratamientoId) {
        const tt = tratamientos.get(cand.tratamientoId)?.name.toLowerCase();
        if (tt) motivos.push(`duración compatible (${tt})`);
      } else {
        motivos.push("cualquier tratamiento");
      }
      if (cand.odontologoId) {
        const od = odontologos.get(cand.odontologoId)?.fullName;
        if (od) motivos.push(`${od} disponible`);
      } else {
        motivos.push("cualquier especialista");
      }
      return {
        candidatoId: cand.id,
        paciente: pacientes.get(cand.pacienteId)?.fullName ?? "—",
        tratamiento: cand.tratamientoId ? tratamientos.get(cand.tratamientoId)?.name ?? null : null,
        odontologo: cand.odontologoId ? odontologos.get(cand.odontologoId)?.fullName ?? null : null,
        motivos,
      };
    });
  }

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
    doctores,
    pacientes: pacientesVista,
    listaEspera,
    trabajosLab,
    operaciones,
    actividad,
    elegiblesPorCita,
    totales: {
      agendado: suma(() => true),
      confirmado: suma((c) => c.status === "confirmed"),
      esperando: suma((c) => c.status === "scheduled" || c.status === "reminded"),
      vencido: suma((c) => c.carril === "vencida"),
      cancelado: canceladas.reduce((s, c) => s + c.soles, 0),
      recuperado: recuperadas.reduce((s, c) => s + c.soles, 0),
      completadas: completadasTodas.length,
      valorRecuperado: recuperadas.reduce((s, c) => s + c.soles, 0),
      enRiesgo: Math.round(vivas.reduce((s, c) => s + c.soles * c.riesgo, 0)),
      valorPendiente: pendientesConfirmacion.reduce((s, c) => s + c.soles, 0),
      citasVivas: vivas.length,
      confirmadasSinLlamar: confirmadas.length,
      recordatoriosEnviados: recordatorios.length,
      rescatado:
        confirmadas.filter((c) => c.remindedAt !== null).reduce((s, c) => s + c.soles, 0) +
        recuperadas.reduce((s, c) => s + c.soles, 0),
      espaciosRecuperables: recuperables.length,
      labosEnRiesgo,
    },
    clinica: { odontologos: cat.odontologos.length, pacientes: cat.pacientes.length },
  };
}

/** Etiqueta legible de un día de atención, para la vista de doctores. */
export function etiquetaDias(dias: DiaSemana[]): string {
  if (dias.length === 0) return "todos los días";
  if (dias.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => dias.includes(d as DiaSemana))) return "lun a sáb";
  if (dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d as DiaSemana))) return "lun a vie";
  return dias
    .slice()
    .sort()
    .map((d) => DIA_LABEL[d].slice(0, 3))
    .join(", ");
}
