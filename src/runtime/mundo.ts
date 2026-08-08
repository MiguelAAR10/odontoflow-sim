import { evaluate, type AppointmentStatus, type AppointmentView } from "@/domain/engine";
import { assertTransition } from "@/domain/transitions";
import {
  textoConfirmacion,
  textoOfertaHueco,
  textoRecordatorio2h,
  textoRecordatorio24h,
  textoRecuperacion,
  textoReprogramacion,
  type PlantillaCita,
} from "@/domain/channel";
import { respuestaDe } from "@/domain/paciente-sim";
import { primerCandidato, candidatosParaHueco } from "@/domain/lista-espera";
import { DEMO_START } from "@/domain/seed";
import { opcionesParaReprogramar, opcionElegida } from "@/domain/reprogramacion";
import type {
  Alerta,
  CandidatoListaEspera,
  Catalogo,
  Cita,
  EventoActividad,
  Laboratorio,
  Mensaje,
  Odontologo,
  Reglas,
  TrabajoLaboratorio,
  UserEvent,
  UserEventKind,
} from "@/domain/tipos";
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
 * recepcionista, las cancelaciones con recuperación desde la lista de espera y
 * las respuestas simuladas de los pacientes — hasta el instante pedido. Por eso
 * pasar dos veces por el mismo momento da exactamente el mismo estado, y por
 * eso todo tiene que ser determinista.
 */

/** Resolución del avance. Media hora basta para reglas medidas en horas. */
const STEP_MS = 30 * 60_000;
const HOUR = 3_600_000;

/** Tiempo que tarda un candidato en aceptar la oferta de un hueco, para la sim. */
const ACEPTA_TRAS_MS = 45 * 60_000;
/** Tiempo que tarda el sistema en reagendar automáticamente a quien pidió reprogramar. */
const REPRO_TRAS_MS = 30 * 60_000;

export interface Mundo {
  ahora: Date;
  citas: Cita[];
  mensajes: Mensaje[];
  alertas: Alerta[];
  /** registro cronológico de hitos automatizados (el feed «Actividad reciente») */
  actividad: EventoActividad[];
  /** lista de espera tal cual está en el catálogo (no muta) */
  listaEspera: CandidatoListaEspera[];
  /** trabajos de laboratorio del catálogo (no mutan con el tiempo) */
  trabajosLab: TrabajoLaboratorio[];
  laboratorios: Laboratorio[];
  odontologos: Odontologo[];
}

interface RunCat {
  pacientes: Map<string, { fullName: string; phone: string; previousNoShows: number }>;
  odontologos: Map<string, { fullName: string; specialty: string }>;
  tratamientos: Map<string, { name: string; priceCents: number }>;
  listaEspera: CandidatoListaEspera[];
}

function runCat(cat: Catalogo): RunCat {
  return {
    pacientes: new Map(
      cat.pacientes.map((p) => [
        p.id,
        { fullName: p.fullName, phone: p.phone, previousNoShows: p.previousNoShows },
      ]),
    ),
    odontologos: new Map(
      cat.odontologos.map((d) => [d.id, { fullName: d.fullName, specialty: d.specialty }]),
    ),
    tratamientos: new Map(cat.tratamientos.map((t) => [t.id, { name: t.name, priceCents: t.priceCents }])),
    listaEspera: cat.listaEspera,
  };
}

function plantilla(c: Cita, cat: RunCat): PlantillaCita {
  return {
    paciente: cat.pacientes.get(c.pacienteId)?.fullName ?? "paciente",
    tratamiento: cat.tratamientos.get(c.tratamientoId)?.name ?? "tratamiento",
    odontologo: cat.odontologos.get(c.odontologoId)?.fullName ?? "el odontólogo",
    startsAt: c.startsAt,
  };
}

function plantillaPaciente(patientId: string, cat: RunCat): { paciente: string; phone: string } {
  const p = cat.pacientes.get(patientId);
  return { paciente: p?.fullName ?? "paciente", phone: p?.phone ?? "" };
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
 * solas en cada reconstrucción, a partir del id estable de cada cita. Lo mismo
 * aplica a la aceptación de un hueco por parte de un candidato de la lista de
 * espera: se deriva del id del candidato.
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
  const actividad: EventoActividad[] = [];

  /** Agrega una línea al registro de actividad. Determinista (mismo id → mismo texto). */
  const log = (
    id: string,
    at: Date,
    clase: EventoActividad["clase"],
    texto: string,
    opts: { appointmentId?: string; pacienteId?: string | null; accionHumana?: boolean } = {},
  ) => {
    actividad.push({
      id,
      at,
      clase,
      texto,
      appointmentId: opts.appointmentId ?? null,
      pacienteId: opts.pacienteId ?? null,
      accionHumana: opts.accionHumana ?? false,
    });
  };

  // Para cada cita cancelada que tiene un candidato, recordamos el instante en
  // que se le ofreció el hueco. La aceptación simulada se dispara tras un lapso
  // fijo y determinista (mismo instante → mismo resultado).
  const ofertaEn = new Map<string, { at: Date; candidatoId: string }>();
  const recuperadaPorSim = new Set<string>();
  // Para citas que pidieron reprogramar: instante en que el paciente lo pidió.
  // El sistema propone opciones y reagenda automáticamente tras un lapso fijo.
  const reproDesde = new Map<string, Date>();
  const reproResuelta = new Set<string>();
  // Citas que ya fueron reagendadas por la sim al menos una vez: no se vuelven a
  // reprogramar para evitar bucles en simulaciones largas (una misma cita que
  // entrara dos veces en la ventana de recordatorio pediría reagendar infinito).
  const yaReprogramada = new Set<string>();

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

  /** Cierra las alertas abiertas de una cita (al actuar sobre ella). */
  const resolverAlertasDe = (citaId: string, ahora: Date) => {
    for (const a of alertas) if (a.appointmentId === citaId && !a.resolvedAt) a.resolvedAt = ahora;
  };

  /**
   * Ante una cancelación, busca candidatos en la lista de espera y le ofrece el
   * hueco al primero compatible. La oferta queda registrada; la aceptación la
   * resuelve `aplicarSim` tras un lapso determinista.
   *
   * Si nadie es compatible, levanta una alerta "bloque_vacio": el espacio quedó
   * libre y conviene reasignarlo a mano.
   */
  const ofrecerHuecoTrasCancelacion = (c: Cita, ahora: Date) => {
    const todos = candidatosParaHueco(c, rc.listaEspera, ahora);
    if (todos.length === 0) {
      alertas.push({
        id: `al-${c.id}-bloque_vacio`,
        appointmentId: c.id,
        kind: "bloque_vacio",
        message: `Cancelación dejó un hueco libre de ${plantilla(c, rc).tratamiento.toLowerCase()} sin candidatos en lista de espera.`,
        createdAt: ahora,
        resolvedAt: null,
      });
      log(`act-${c.id}-sincand-${ahora.getTime()}`, ahora, "hueco", `Sin pacientes elegibles para este hueco.`, {
        appointmentId: c.id,
        accionHumana: true,
      });
      return;
    }
    const p = plantilla(c, rc);
    // Registro de pacientes elegibles: cada uno con su motivo (reglas ficticias de demo).
    log(
      `act-${c.id}-cand-${ahora.getTime()}`,
      ahora,
      "hueco",
      `${todos.length} paciente${todos.length > 1 ? "s" : ""} elegible${todos.length > 1 ? "s" : ""} encontrado${todos.length > 1 ? "s" : ""}.`,
      { appointmentId: c.id },
    );
    for (const cand of todos) {
      const nombreCand = cat.pacientes.find((x) => x.id === cand.pacienteId)?.fullName ?? "paciente";
      const rasgos: string[] = ["lista de espera"];
      if (cand.tratamientoId) {
        const tt = cat.tratamientos.find((t) => t.id === cand.tratamientoId)?.name.toLowerCase() ?? "tratamiento";
        rasgos.push(`busca ${tt}`);
      }
      if (cand.odontologoId) {
        const od = cat.odontologos.find((d) => d.id === cand.odontologoId)?.fullName ?? "odontólogo";
        rasgos.push(`prefiere ${od}`);
      } else {
        rasgos.push("cualquier odontólogo");
      }
      log(
        `act-${c.id}-canddetalle-${cand.id}-${ahora.getTime()}`,
        ahora,
        "hueco",
        `${nombreCand} · ${rasgos.join(" · ")}.`,
        { appointmentId: c.id, pacienteId: cand.pacienteId },
      );
    }
    const cand = todos[0];
    const paciente = plantillaPaciente(cand.pacienteId, rc).paciente;
    mensajes.push({
      id: `m-${c.id}-oferta-${ahora.getTime()}`,
      appointmentId: c.id,
      patientId: cand.pacienteId,
      direction: "outbound",
      body: textoOfertaHueco({
        paciente,
        tratamiento: cat.tratamientos.find((t) => t.id === c.tratamientoId)?.name ?? "tratamiento",
        odontologo: cat.odontologos.find((d) => d.id === c.odontologoId)?.fullName ?? "el odontólogo",
        startsAt: c.startsAt,
      }),
      sentAt: ahora,
      kind: "waitlist_offer",
    });
    log(`act-${c.id}-oferta-${ahora.getTime()}`, ahora, "oferta", `Horario ofrecido automáticamente a ${paciente}.`, {
      appointmentId: c.id,
      pacienteId: cand.pacienteId,
    });
    log(`act-${c.id}-tarea-oferta-${ahora.getTime()}`, ahora, "oferta", `${p.paciente} · esperando respuesta del candidato.`, {
      appointmentId: c.id,
      pacienteId: c.pacienteId,
      accionHumana: true,
    });
    ofertaEn.set(c.id, { at: ahora, candidatoId: cand.id });
  };

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
          log(`act-${c.id}-rem24`, ahora, "recordatorio", `Primer recordatorio enviado a ${p.paciente}.`, {
            appointmentId: c.id,
            pacienteId: c.pacienteId,
          });
        } else {
          log(`act-${c.id}-rem2`, ahora, "recordatorio", `Segundo recordatorio enviado a ${p.paciente}.`, {
            appointmentId: c.id,
            pacienteId: c.pacienteId,
          });
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
        const p = plantilla(c, rc);
        log(`act-${c.id}-alerta`, ahora, "alerta", `${p.paciente} no respondió después de 2 intentos.`, {
          appointmentId: c.id,
          pacienteId: c.pacienteId,
        });
        log(`act-${c.id}-tarea`, ahora, "alerta", `Acción creada para recepción: contactar a ${p.paciente}.`, {
          appointmentId: c.id,
          pacienteId: c.pacienteId,
          accionHumana: true,
        });
      }

      if (acc.type === "mark_completed") {
        mover(c, "completed");
        const p = plantilla(c, rc);
        log(`act-${c.id}-completada`, ahora, "completada", `${p.paciente} — cita completada.`, {
          appointmentId: c.id,
          pacienteId: c.pacienteId,
        });
      }
      if (acc.type === "mark_no_show") mover(c, "no_show");
    }
  };

  const aplicarEvento = (ev: { appointmentId: string; kind: UserEventKind }, ahora: Date) => {
    const c = porId.get(ev.appointmentId);
    if (!c) return;

    // Una respuesta que llega cuando la cita ya se cerró no cambia el pasado.
    if (c.status === "completed" || c.status === "no_show") {
      resolverAlertasDe(c.id, ahora);
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
      const p = plantilla(c, rc);
      log(`act-${c.id}-confirma-${ahora.getTime()}`, ahora, "respuesta", `${p.paciente} confirmó su cita.`, {
        appointmentId: c.id,
        pacienteId: c.pacienteId,
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
      resolverAlertasDe(c.id, ahora);
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
      const p = plantilla(c, rc);
      log(`act-${c.id}-repro-${ahora.getTime()}`, ahora, "reprograma", `${p.paciente} pide reprogramar su cita.`, {
        appointmentId: c.id,
        pacienteId: c.pacienteId,
      });
      mover(c, "reschedule_requested");
      reproDesde.set(c.id, ahora);
      mensajes.push({
        id: `m-${c.id}-ack-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "outbound",
        body: textoReprogramacion(plantilla(c, rc)),
        sentAt: ahora,
        kind: "reschedule_ack",
      });
      resolverAlertasDe(c.id, ahora);
    }

    if (ev.kind === "patient_cancel") {
      // Si ya estaba cancelada o recuperada, no se hace nada dos veces.
      if (c.status === "cancelled" || c.status === "recovered") return;
      mensajes.push({
        id: `m-${c.id}-in-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: c.pacienteId,
        direction: "inbound",
        body: "cancelé",
        sentAt: ahora,
        kind: "patient_reply",
      });
      const p = plantilla(c, rc);
      log(`act-${c.id}-cancela-${ahora.getTime()}`, ahora, "hueco", `${p.paciente} canceló su cita.`, {
        appointmentId: c.id,
        pacienteId: c.pacienteId,
      });
      mover(c, "cancelled");
      resolverAlertasDe(c.id, ahora);
      log(
        `act-${c.id}-hueco-${ahora.getTime()}`,
        ahora,
        "hueco",
        `Espacio disponible: ${p.tratamiento.toLowerCase()} · ${p.odontologo} · ${formatoCita(p.startsAt)}.`,
        { appointmentId: c.id, pacienteId: c.pacienteId },
      );
      // La cancelación libera el espacio: ofrecerlo a la lista de espera.
      ofrecerHuecoTrasCancelacion(c, ahora);
    }

    // El recepcionista fuerza la oferta a la lista de espera sobre una cita viva.
    if (ev.kind === "offer_waitlist") {
      // Si la cita sigue viva (no cancelada), la tratamos como cancelación para
      // liberar el hueco. Si ya estaba cancelada, simplemente reofrece.
      if (c.status !== "cancelled") {
        if (c.status === "recovered") {
          resolverAlertasDe(c.id, ahora);
          return;
        }
        mover(c, "cancelled");
        resolverAlertasDe(c.id, ahora);
      }
      ofrecerHuecoTrasCancelacion(c, ahora);
    }

    // El recepcionista confirma que un candidato tomó el hueco (recuperación manual).
    if (ev.kind === "recover_slot") {
      if (c.status !== "cancelled") {
        resolverAlertasDe(c.id, ahora);
        return;
      }
      const cand = primerCandidato(c, rc.listaEspera, ahora);
      if (!cand) return;
      c.pacienteId = cand.pacienteId;
      mover(c, "recovered");
      mensajes.push({
        id: `m-${c.id}-rec-${ahora.getTime()}`,
        appointmentId: c.id,
        patientId: cand.pacienteId,
        direction: "outbound",
        body: textoRecuperacion({
          paciente: cat.pacientes.find((p) => p.id === cand.pacienteId)?.fullName ?? "paciente",
          tratamiento: cat.tratamientos.find((t) => t.id === c.tratamientoId)?.name ?? "tratamiento",
          odontologo: cat.odontologos.find((d) => d.id === c.odontologoId)?.fullName ?? "el odontólogo",
          startsAt: c.startsAt,
        }),
        sentAt: ahora,
        kind: "recovery_ack",
      });
      resolverAlertasDe(c.id, ahora);
      const nombreRecup = cat.pacientes.find((p) => p.id === cand.pacienteId)?.fullName ?? "paciente";
      ofertaEn.delete(c.id);
      log(`act-${c.id}-acepta-${ahora.getTime()}`, ahora, "aceptacion", `${nombreRecup} aceptó el horario.`, {
        appointmentId: c.id,
        pacienteId: cand.pacienteId,
      });
      log(`act-${c.id}-recupok-${ahora.getTime()}`, ahora, "aceptacion", `Cita recuperada desde la lista de espera.`, {
        appointmentId: c.id,
        pacienteId: cand.pacienteId,
      });
    }

    // El recepcionista actuó o decidió esperar: la alerta deja de pedir atención.
    if (ev.kind === "apply_suggestion" || ev.kind === "snooze") {
      resolverAlertasDe(c.id, ahora);
    }
  };

  /**
   * Respuestas que los pacientes dan solos tras el recordatorio.
   * Se calculan a partir del id de la cita, así que son estables al retroceder.
   * Si el recepcionista ya tomó la cita, no se pisa: manda el humano.
   */
  const aplicarSim = (ahora: Date) => {
    for (const c of citas) {
      // 0) reprogramación automática: el paciente pidió otro horario y el sistema
      //    le propone opciones; tras un lapso fijo, elige una y reagenda la cita.
      if (
        c.status === "reschedule_requested" &&
        reproDesde.has(c.id) &&
        !reproResuelta.has(c.id) &&
        ahora.getTime() >= (reproDesde.get(c.id)?.getTime() ?? 0) + REPRO_TRAS_MS
      ) {
        const p = plantilla(c, rc);
        const durMin = cat.tratamientos.find((t) => t.id === c.tratamientoId)?.durationMin ?? 60;
        const opciones = opcionesParaReprogramar(c, citas, reglas, durMin, reproDesde.get(c.id)!);
        if (opciones.length === 0) {
          // sin huecos: queda como tarea para recepción
          reproResuelta.add(c.id);
          continue;
        }
        const idx = opcionElegida(c.id, opciones.length);
        const elegida = opciones[idx];
        log(
          `act-${c.id}-repropop-${ahora.getTime()}`,
          ahora,
          "reprograma",
          `OdontoFlow encuentra ${opciones.length} horarios compatibles.`,
          { appointmentId: c.id, pacienteId: c.pacienteId },
        );
        const listaOpciones = opciones.map((o) => o.etiqueta).join(" · ");
        log(
          `act-${c.id}-reproopts-${ahora.getTime()}`,
          ahora,
          "reprograma",
          `Opciones: ${listaOpciones}.`,
          { appointmentId: c.id, pacienteId: c.pacienteId },
        );
        c.startsAt = new Date(elegida.startsAt.getTime());
        c.endsAt = new Date(elegida.endsAt.getTime());
        c.remindedAt = null;
        mover(c, "confirmed");
        reproResuelta.add(c.id);
        yaReprogramada.add(c.id);
        log(
          `act-${c.id}-reprook-${ahora.getTime()}`,
          ahora,
          "reprograma",
          `${p.paciente} seleccionó ${elegida.etiqueta}. Cita reagendada automáticamente.`,
          { appointmentId: c.id, pacienteId: c.pacienteId },
        );
        continue;
      }

      // 1) aceptación simulada de un hueco ofrecido tras cancelación
      const oferta = ofertaEn.get(c.id);
      if (
        oferta &&
        c.status === "cancelled" &&
        !recuperadaPorSim.has(c.id) &&
        ahora.getTime() >= oferta.at.getTime() + ACEPTA_TRAS_MS
      ) {
        const cand = rc.listaEspera.find((x) => x.id === oferta.candidatoId);
        if (!cand || (cand.hasta && cand.hasta.getTime() < ahora.getTime())) {
          // el candidato ya no le sirve o desapareció; ofrecer al siguiente
          const nombreCand = cat.pacientes.find((p) => p.id === cand?.pacienteId)?.fullName ?? "el candidato";
          log(`act-${c.id}-sinresp-${ahora.getTime()}`, ahora, "oferta", `${nombreCand} no respondió la oferta.`, {
            appointmentId: c.id,
            pacienteId: cand?.pacienteId,
          });
          ofertaEn.delete(c.id);
          ofrecerHuecoTrasCancelacion(c, ahora);
          continue;
        }
        const nombreAcepta = cat.pacientes.find((p) => p.id === cand.pacienteId)?.fullName ?? "el candidato";
        c.pacienteId = cand.pacienteId;
        mover(c, "recovered");
        mensajes.push({
          id: `m-${c.id}-simrec-${ahora.getTime()}`,
          appointmentId: c.id,
          patientId: cand.pacienteId,
          direction: "inbound",
          body: "1",
          sentAt: ahora,
          kind: "patient_reply",
        });
        mensajes.push({
          id: `m-${c.id}-recack-${ahora.getTime()}`,
          appointmentId: c.id,
          patientId: cand.pacienteId,
          direction: "outbound",
          body: textoRecuperacion({
            paciente: cat.pacientes.find((p) => p.id === cand.pacienteId)?.fullName ?? "paciente",
            tratamiento: cat.tratamientos.find((t) => t.id === c.tratamientoId)?.name ?? "tratamiento",
            odontologo: cat.odontologos.find((d) => d.id === c.odontologoId)?.fullName ?? "el odontólogo",
            startsAt: c.startsAt,
          }),
          sentAt: ahora,
          kind: "recovery_ack",
        });
        resolverAlertasDe(c.id, ahora);
        recuperadaPorSim.add(c.id);
        ofertaEn.delete(c.id);
        log(`act-${c.id}-acepta-${ahora.getTime()}`, ahora, "aceptacion", `${nombreAcepta} aceptó el horario.`, {
          appointmentId: c.id,
          pacienteId: cand.pacienteId,
        });
        log(`act-${c.id}-recupok-${ahora.getTime()}`, ahora, "aceptacion", `Cita recuperada desde la lista de espera.`, {
          appointmentId: c.id,
          pacienteId: cand.pacienteId,
        });
        continue;
      }

      // 2) respuestas al recordatorio
      if (c.remindedAt === null) continue;
      if (conEventoUsuario.has(c.id)) continue;
      if (simAplicada.has(c.id)) continue;
      if (c.status !== "reminded" && c.status !== "no_response") continue;

      const previas = rc.pacientes.get(c.pacienteId)?.previousNoShows ?? 0;
      let r = respuestaDe(c.id, c.pacienteId, previas);
      // Si la cita ya fue reagendada por la sim una vez, no vuelve a pedirlo: la
      // tratamos como silencio para no entrar en bucle de reprogramaciones.
      if (yaReprogramada.has(c.id) && (r.tipo === "reprograma" || r.tipo === "cancela")) {
        r = { tipo: "silencio" };
      }
      if (r.tipo === "silencio") {
        simAplicada.add(c.id);
        continue;
      }
      const vence = c.remindedAt.getTime() + r.trasHoras * HOUR;
      if (ahora.getTime() < vence) continue;

      aplicarEvento(
        {
          appointmentId: c.id,
          kind:
            r.tipo === "confirma"
              ? "patient_confirm"
              : r.tipo === "reprograma"
                ? "patient_reschedule"
                : "patient_cancel",
        },
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

  return {
    ahora: final,
    citas,
    mensajes,
    alertas,
    actividad,
    listaEspera: cat.listaEspera,
    trabajosLab: cat.trabajosLab,
    laboratorios: cat.laboratorios,
    odontologos: cat.odontologos,
  };
}

const DIAS_FMT = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function formatoCita(d: Date): string {
  return `${DIAS_FMT[d.getDay()]} ${hhmmFmt(d)}`;
}
function hhmmFmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
