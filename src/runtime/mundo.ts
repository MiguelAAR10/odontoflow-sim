import { evaluate, type AppointmentStatus, type AppointmentView } from "@/domain/engine";
import { assertTransition } from "@/domain/transitions";
import {
  textoConfirmacion,
  textoRecordatorio2h,
  textoRecordatorio24h,
  textoReprogramacion,
  type PlantillaCita,
} from "@/domain/channel";
import { respuestaDe } from "@/domain/paciente-sim";
import { DEMO_END, DEMO_START } from "@/domain/seed";
import type { Alerta, Catalogo, Cita, Mensaje, Reglas, UserEvent, UserEventKind } from "@/domain/tipos";
import { clampReloj } from "./horario";

/**
 * El mundo de la clínica en un instante dado.
 *
 * Toda la simulación vive acá y es una función pura: recibe el catálogo base,
 * la historia de acciones del recepcionista y un instante, y devuelve cómo está
 * la clínica en ese momento. No hay base de datos, ni efectos, ni estado global.
 *
 * Para que la línea de tiempo vaya hacia atrás no se deshace nada: se reconstruye
 * desde el seed y se reproduce la historia — el motor, las acciones del
 * recepcionista y las respuestas simuladas de los pacientes — hasta el instante
 * pedido. Por eso pasar dos veces por el mismo momento da exactamente el mismo
 * estado, y por eso todo tiene que ser determinista.
 */

/** Resolución del avance. Media hora basta para reglas medidas en horas. */
const STEP_MS = 30 * 60_000;
const HOUR = 3_600_000;

export interface Mundo {
  ahora: Date;
  citas: Cita[];
  mensajes: Mensaje[];
  alertas: Alerta[];
}

interface RunCat {
  pacientes: Map<string, { fullName: string; phone: string; previousNoShows: number }>;
  odontologos: Map<string, string>;
  tratamientos: Map<string, { name: string; priceCents: number }>;
}

function runCat(cat: Catalogo): RunCat {
  return {
    pacientes: new Map(
      cat.pacientes.map((p) => [
        p.id,
        { fullName: p.fullName, phone: p.phone, previousNoShows: p.previousNoShows },
      ]),
    ),
    odontologos: new Map(cat.odontologos.map((d) => [d.id, d.fullName])),
    tratamientos: new Map(cat.tratamientos.map((t) => [t.id, { name: t.name, priceCents: t.priceCents }])),
  };
}

function plantilla(c: Cita, cat: RunCat): PlantillaCita {
  return {
    paciente: cat.pacientes.get(c.pacienteId)?.fullName ?? "paciente",
    tratamiento: cat.tratamientos.get(c.tratamientoId)?.name ?? "tratamiento",
    odontologo: cat.odontologos.get(c.odontologoId) ?? "el odontólogo",
    startsAt: c.startsAt,
  };
}

/** Cambia el estado validando la transición. Nunca escribir `status` sin pasar por acá. */
function mover(c: Cita, to: AppointmentStatus) {
  assertTransition(c.status, to);
  c.status = to;
}

/**
 * Reproduce la historia desde el inicio de la demo hasta `target`.
 *
 * Determinista: con los mismos `cat`, `eventos` y `reglas`, el resultado es
 * idéntico. Las respuestas simuladas no se guardan en ningún lado: se recalculan
 * solas en cada reconstrucción, a partir del id estable de cada cita.
 */
export function reproducir(cat: Catalogo, eventos: UserEvent[], reglas: Reglas, target: Date): Mundo {
  const rc = runCat(cat);
  const destino = clampReloj(target);

  // Copia mutable del estado base: el catálogo original no se toca.
  const citas: Cita[] = cat.citas.map((c) => ({
    ...c,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    remindedAt: c.remindedAt ? new Date(c.remindedAt.getTime()) : null,
  }));
  const porId = new Map(citas.map((c) => [c.id, c]));
  const mensajes: Mensaje[] = [];
  const alertas: Alerta[] = [];

  const evs = [...eventos].sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq);
  const conEventoUsuario = new Set(evs.map((e) => e.appointmentId));
  const simAplicada = new Set<string>();
  let siguienteEvento = 0;

  const vista = (): AppointmentView[] =>
    citas.map((c) => ({
      id: c.id,
      patientId: c.pacienteId,
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      remindedAt: c.remindedAt,
    }));

  const pasoMotor = (ahora: Date) => {
    const acciones = evaluate({
      now: ahora,
      appointments: vista(),
      rules: reglas,
      sentMessages: mensajes.map((m) => ({ appointmentId: m.appointmentId, kind: m.kind })),
      raisedAlerts: alertas.map((a) => ({ appointmentId: a.appointmentId, kind: a.kind })),
    });

    for (const acc of acciones) {
      const c = porId.get(acc.appointmentId);
      if (!c) continue;

      if (acc.type === "send_reminder") {
        const p = plantilla(c, rc);
        mensajes.push({
          id: `m-${c.id}-${acc.kind}`,
          appointmentId: c.id,
          patientId: c.pacienteId,
          direction: "outbound",
          body: acc.kind === "reminder_24h" ? textoRecordatorio24h(p) : textoRecordatorio2h(p),
          sentAt: ahora,
          kind: acc.kind,
        });
        if (acc.kind === "reminder_24h") {
          mover(c, "reminded");
          c.remindedAt = ahora;
        }
      }

      if (acc.type === "raise_alert") {
        mover(c, "no_response");
        alertas.push({
          id: `al-${c.id}-${acc.kind}`,
          appointmentId: c.id,
          kind: acc.kind,
          message: `${plantilla(c, rc).paciente} no respondió el recordatorio en ${reglas.alertAfterHours} horas`,
          createdAt: ahora,
          resolvedAt: null,
        });
      }

      if (acc.type === "mark_completed") mover(c, "completed");
      if (acc.type === "mark_no_show") mover(c, "no_show");
    }
  };

  const aplicarEvento = (ev: { appointmentId: string; kind: UserEventKind }, ahora: Date) => {
    const c = porId.get(ev.appointmentId);
    if (!c) return;

    // Una respuesta que llega cuando la cita ya se cerró no cambia el pasado.
    if (c.status === "completed" || c.status === "no_show" || c.status === "cancelled") {
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
      return;
    }

    if (ev.kind === "patient_confirm") {
      mensajes.push({
        id: `m-${c.id}-in-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "inbound",
        body: "1",
        sentAt: ahora,
        kind: "patient_reply",
      });
      mover(c, "confirmed");
      mensajes.push({
        id: `m-${c.id}-ack-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "outbound",
        body: textoConfirmacion(plantilla(c, rc)),
        sentAt: ahora,
        kind: "confirmation_ack",
      });
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }

    if (ev.kind === "patient_reschedule") {
      mensajes.push({
        id: `m-${c.id}-in-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "inbound",
        body: "2",
        sentAt: ahora,
        kind: "patient_reply",
      });
      mover(c, "reschedule_requested");
      mensajes.push({
        id: `m-${c.id}-ack-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "outbound",
        body: textoReprogramacion(plantilla(c, rc)),
        sentAt: ahora,
        kind: "reschedule_ack",
      });
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }

    // El recepcionista actuó o decidió esperar: la alerta deja de pedir atención.
    if (ev.kind === "apply_suggestion" || ev.kind === "snooze") {
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }
  };

  /**
   * Respuestas que los pacientes dan solos tras el recordatorio.
   * Se calculan a partir del id de la cita, así que son estables al retroceder.
   * Si el recepcionista ya tomó la cita, no se pisa: manda el humano.
   */
  const aplicarSim = (ahora: Date) => {
    for (const c of citas) {
      if (c.remindedAt === null) continue;
      if (conEventoUsuario.has(c.id)) continue;
      if (simAplicada.has(c.id)) continue;
      if (c.status !== "reminded" && c.status !== "no_response") continue;

      const previas = rc.pacientes.get(c.pacienteId)?.previousNoShows ?? 0;
      const r = respuestaDe(c.id, previas);
      if (r.tipo === "silencio") {
        simAplicada.add(c.id);
        continue;
      }
      const vence = c.remindedAt.getTime() + r.trasHoras * HOUR;
      if (ahora.getTime() < vence) continue;

      aplicarEvento(
        { appointmentId: c.id, kind: r.tipo === "confirma" ? "patient_confirm" : "patient_reschedule" },
        ahora,
      );
      simAplicada.add(c.id);
    }
  };

  for (let t = DEMO_START.getTime(); t <= destino.getTime(); t += STEP_MS) {
    const ahora = new Date(t);
    pasoMotor(ahora);
    while (siguienteEvento < evs.length && evs[siguienteEvento].at.getTime() <= t) {
      aplicarEvento(evs[siguienteEvento], ahora);
      siguienteEvento++;
    }
    aplicarSim(ahora);
  }

  // último paso exacto, por si `destino` no cae en el borde de 30 min
  const final = new Date(destino.getTime());
  pasoMotor(final);
  while (siguienteEvento < evs.length && evs[siguienteEvento].at.getTime() <= final.getTime()) {
    aplicarEvento(evs[siguienteEvento], final);
    siguienteEvento++;
  }
  aplicarSim(final);

  return { ahora: final, citas, mensajes, alertas };
}
