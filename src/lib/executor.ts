import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  alerts,
  appointments,
  dentists,
  messages,
  patients,
  rules,
  treatments,
  userEvents,
} from "@/db/schema";
import { seed } from "@/db/seed";
import { evaluate, type AppointmentStatus, type AppointmentView, type Rules } from "./engine";
import { assertTransition } from "./transitions";
import {
  channel,
  textoConfirmacion,
  textoRecordatorio24h,
  textoRecordatorio2h,
  textoReprogramacion,
} from "./channel";
import { DEMO_END, DEMO_START, setClock } from "./clock";

/**
 * Ejecutor: convierte las decisiones del motor en hechos persistidos.
 *
 * La pieza importante es `seekTo`. La línea de tiempo se puede arrastrar en
 * ambos sentidos, y el estado del mundo tiene que ser el mismo cada vez que se
 * pasa por un instante dado. Para lograrlo no se "deshace" nada: se reconstruye
 * el mundo desde el seed y se reproduce la historia — el motor más las acciones
 * del recepcionista — hasta el instante pedido.
 *
 * Toda la simulación corre en memoria y se persiste una sola vez al final. Con
 * ~200 pasos por 60 citas, hacerlo contra la base en cada paso costaría miles
 * de consultas para el mismo resultado.
 */

/** Resolución del avance. Media hora es suficiente para reglas medidas en horas. */
const STEP_MS = 30 * 60_000;

export type UserEventKind =
  | "patient_confirm"
  | "patient_reschedule"
  | "apply_suggestion"
  | "snooze";

interface CitaMem {
  id: string;
  patientId: string;
  dentistId: string;
  treatmentId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  remindedAt: Date | null;
}

interface MsgMem {
  id: string;
  appointmentId: string;
  patientId: string;
  direction: "outbound" | "inbound";
  body: string;
  sentAt: Date;
  kind: string;
}

interface AlertMem {
  id: string;
  appointmentId: string;
  kind: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

interface Catalogo {
  pacientes: Map<string, { fullName: string; phone: string }>;
  odontologos: Map<string, string>;
  tratamientos: Map<string, { name: string; priceCents: number }>;
  reglas: Rules;
}

async function cargarCatalogo(db: Db): Promise<Catalogo> {
  const [ps, ds, ts, rs] = await Promise.all([
    db.select().from(patients).all(),
    db.select().from(dentists).all(),
    db.select().from(treatments).all(),
    db.select().from(rules).all(),
  ]);
  const r = rs[0];
  return {
    pacientes: new Map(ps.map((p) => [p.id, { fullName: p.fullName, phone: p.phone }])),
    odontologos: new Map(ds.map((d) => [d.id, d.fullName])),
    tratamientos: new Map(ts.map((t) => [t.id, { name: t.name, priceCents: t.priceCents }])),
    reglas: {
      firstReminderHours: r?.firstReminderHours ?? 24,
      secondReminderHours: r?.secondReminderHours ?? 2,
      alertAfterHours: r?.alertAfterHours ?? 6,
    },
  };
}

function plantilla(c: CitaMem, cat: Catalogo) {
  return {
    paciente: cat.pacientes.get(c.patientId)?.fullName ?? "paciente",
    tratamiento: cat.tratamientos.get(c.treatmentId)?.name ?? "tratamiento",
    odontologo: cat.odontologos.get(c.dentistId) ?? "el odontólogo",
    startsAt: c.startsAt,
  };
}

/** Cambia el estado validando la transición. Nunca escribir `status` sin pasar por acá. */
function mover(c: CitaMem, to: AppointmentStatus) {
  assertTransition(c.status, to);
  c.status = to;
}

/**
 * Reproduce la historia desde el inicio de la demo hasta `target`.
 * Devuelve el mundo resultante, sin persistir nada.
 */
function reproducir(
  citas: CitaMem[],
  cat: Catalogo,
  eventos: { at: Date; appointmentId: string; kind: UserEventKind }[],
  target: Date,
) {
  const msgs: MsgMem[] = [];
  const alertas: AlertMem[] = [];
  const porId = new Map(citas.map((c) => [c.id, c]));
  let siguienteEvento = 0;

  const vista = (): AppointmentView[] =>
    citas.map((c) => ({
      id: c.id,
      patientId: c.patientId,
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      remindedAt: c.remindedAt,
    }));

  const pasoMotor = (ahora: Date) => {
    const acciones = evaluate({
      now: ahora,
      appointments: vista(),
      rules: cat.reglas,
      sentMessages: msgs.map((m) => ({ appointmentId: m.appointmentId, kind: m.kind })),
      raisedAlerts: alertas.map((a) => ({ appointmentId: a.appointmentId, kind: a.kind })),
    });

    for (const acc of acciones) {
      const c = porId.get(acc.appointmentId);
      if (!c) continue;

      if (acc.type === "send_reminder") {
        const p = plantilla(c, cat);
        msgs.push({
          id: `m-${c.id}-${acc.kind}`,
          appointmentId: c.id,
          patientId: c.patientId,
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
          message: `${plantilla(c, cat).paciente} no respondió el recordatorio en ${cat.reglas.alertAfterHours} horas`,
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
    // Pasa de verdad: el paciente contesta el recordatorio al día siguiente,
    // cuando el sistema ya lo marcó como ausencia. Se ignora en vez de romper.
    if (c.status === "completed" || c.status === "no_show" || c.status === "cancelled") {
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
      return;
    }

    if (ev.kind === "patient_confirm") {
      msgs.push({
        id: `m-${c.id}-in-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.patientId,
        direction: "inbound",
        body: "1",
        sentAt: ahora,
        kind: "patient_reply",
      });
      mover(c, "confirmed");
      msgs.push({
        id: `m-${c.id}-ack-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.patientId,
        direction: "outbound",
        body: textoConfirmacion(plantilla(c, cat)),
        sentAt: ahora,
        kind: "confirmation_ack",
      });
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }

    if (ev.kind === "patient_reschedule") {
      msgs.push({
        id: `m-${c.id}-in-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.patientId,
        direction: "inbound",
        body: "2",
        sentAt: ahora,
        kind: "patient_reply",
      });
      mover(c, "reschedule_requested");
      msgs.push({
        id: `m-${c.id}-ack-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.patientId,
        direction: "outbound",
        body: textoReprogramacion(plantilla(c, cat)),
        sentAt: ahora,
        kind: "reschedule_ack",
      });
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }

    // El recepcionista actuó (llamó, reenvió) o decidió esperar: la alerta deja
    // de pedir su atención, pero el estado de la cita no cambia — solo el
    // paciente puede confirmarla.
    if (ev.kind === "apply_suggestion" || ev.kind === "snooze") {
      for (const a of alertas) if (a.appointmentId === c.id && !a.resolvedAt) a.resolvedAt = ahora;
    }
  };

  for (let t = DEMO_START.getTime(); t <= target.getTime(); t += STEP_MS) {
    const ahora = new Date(t);
    pasoMotor(ahora);
    while (
      siguienteEvento < eventos.length &&
      eventos[siguienteEvento].at.getTime() <= t
    ) {
      aplicarEvento(eventos[siguienteEvento], ahora);
      siguienteEvento++;
    }
  }

  // último paso exacto, por si `target` no cae en el borde de 30 min
  pasoMotor(target);
  while (
    siguienteEvento < eventos.length &&
    eventos[siguienteEvento].at.getTime() <= target.getTime()
  ) {
    aplicarEvento(eventos[siguienteEvento], target);
    siguienteEvento++;
  }

  return { citas, msgs, alertas };
}

/**
 * Lleva la clínica al instante `target`, hacia adelante o hacia atrás.
 * Devuelve el instante efectivo (acotado al rango de la demo).
 */
export async function seekTo(db: Db, target: Date): Promise<Date> {
  const destino = new Date(
    Math.min(DEMO_END.getTime(), Math.max(DEMO_START.getTime(), target.getTime())),
  );

  // Los eventos del usuario son la única historia que no se puede regenerar.
  const eventos = (await db.select().from(userEvents).orderBy(asc(userEvents.at), asc(userEvents.seq)).all()).map(
    (e) => ({
      at: e.at,
      appointmentId: e.appointmentId,
      kind: e.kind as UserEventKind,
    }),
  );

  // Reconstruir el mundo base y volver a colocar los eventos, que `seed` limpia.
  await seed(db);
  if (eventos.length) {
    await db
      .insert(userEvents)
      .values(
        eventos.map((e, i) => ({
          id: `ev-${e.at.getTime()}-${i}`,
          at: e.at,
          appointmentId: e.appointmentId,
          kind: e.kind,
          seq: i,
        })),
      )
      .run();
  }

  const cat = await cargarCatalogo(db);
  const base = (await db.select().from(appointments).all()).map<CitaMem>((a) => ({
    id: a.id,
    patientId: a.patientId,
    dentistId: a.dentistId,
    treatmentId: a.treatmentId,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    status: a.status as AppointmentStatus,
    remindedAt: a.remindedAt,
  }));

  const mundo = reproducir(base, cat, eventos, destino);

  // Persistir el resultado de una sola vez.
  for (const c of mundo.citas) {
    await db
      .update(appointments)
      .set({ status: c.status, remindedAt: c.remindedAt, updatedAt: destino })
      .where(eq(appointments.id, c.id))
      .run();
  }
  for (const m of mundo.msgs) {
    await channel.send(db, {
      appointmentId: m.appointmentId,
      patientId: m.patientId,
      phone: cat.pacientes.get(m.patientId)?.phone ?? "",
      body: m.body,
      kind: m.kind,
      sentAt: m.sentAt,
    });
    if (m.direction === "inbound") {
      await db.insert(messages).values({ ...m, direction: "inbound" }).onConflictDoNothing().run();
    }
  }
  if (mundo.alertas.length) {
    await db.insert(alerts).values(mundo.alertas).onConflictDoNothing().run();
    for (const a of mundo.alertas) {
      if (a.resolvedAt) {
        await db.update(alerts).set({ resolvedAt: a.resolvedAt }).where(eq(alerts.id, a.id)).run();
      }
    }
  }

  return setClock(db, destino);
}

/**
 * Registra una acción del recepcionista (o una respuesta del paciente) en el
 * instante actual y recalcula el mundo para que surta efecto.
 */
export async function recordEvent(
  db: Db,
  appointmentId: string,
  kind: UserEventKind,
  at: Date,
): Promise<void> {
  const previos = await db.select().from(userEvents).all();
  await db
    .insert(userEvents)
    .values({
      id: `ev-${at.getTime()}-${previos.length}`,
      at,
      appointmentId,
      kind,
      seq: previos.length,
    })
    .run();
  await seekTo(db, at);
}

/** Vuelve al inicio de la demo y borra toda la historia. */
export async function resetDemo(db: Db): Promise<Date> {
  await db.delete(userEvents).run();
  return seekTo(db, DEMO_START);
}
