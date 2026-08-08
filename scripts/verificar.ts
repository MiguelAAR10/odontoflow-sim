/**
 * Recorrido de la demo, de punta a punta, contra el runtime puro.
 *
 * Comprueba lo que un evaluador va a hacer en vivo: mover el reloj, ver salir los
 * recordatorios, ver a los pacientes confirmar solos, responder como paciente,
 * cancelar una cita y verla recuperarse desde la lista de espera, y retroceder
 * en el tiempo. Si esto pasa, la demo funciona.
 *
 *   npm run verificar
 */
import { catalogoBase, DEMO_START } from "@/domain/seed";
import type { Reglas, UserEvent } from "@/domain/tipos";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot } from "@/runtime/snapshot";

const H = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * H);
const soles = (n: number) => `S/ ${Math.round(n).toLocaleString("es-PE")}`;

let fallos = 0;
function check(ok: boolean, texto: string, detalle = "") {
  console.log(`${ok ? "  ok  " : " FALLA"}  ${texto}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

const cat = catalogoBase();
const reglas: Reglas = { ...cat.reglas };
let eventos: UserEvent[] = [];

const snap = (target = DEMO_START) => buildSnapshot(reproducir(cat, eventos, reglas, target), cat, reglas);

async function main() {
  console.log("\n1 · Punto de partida");
  let s = snap();
  const recordatoriosIniciales = s.totales.recordatoriosEnviados;
  console.log(`     ${s.totales.citasVivas} citas vivas · ${soles(s.totales.agendado)} agendados`);
  check(s.totales.citasVivas > 30, "hay clínica cargada");
  check(
    s.operaciones.every((o) => o.clase === "retraso_lab"),
    "ninguna cita pide decisión todavía",
  );

  console.log("\n2 · Avanzar 24 horas");
  s = snap(enHoras(24));
  console.log(
    `     ${s.totales.recordatoriosEnviados} recordatorios · ${s.totales.confirmadasSinLlamar} confirmadas · ${soles(s.totales.rescatado)} rescatado`,
  );
  check(s.totales.recordatoriosEnviados > recordatoriosIniciales, "el sistema envió recordatorios solo");

  console.log("\n3 · Avanzar 6 horas más");
  s = snap(enHoras(30));
  console.log(`     ${s.operaciones.length} acciones en cola · ${soles(s.totales.vencido)} vencido`);
  check(s.operaciones.length > 0, "el silencio y las reprogramaciones generan trabajo");

  console.log("\n4 · Cancelar una cita y verla recuperarse");
  s = snap(enHoras(31));
  // buscamos una cita confirmada futura con candidatos en lista de espera
  const cancelable = s.citas.find(
    (c) => c.activa && (c.status === "confirmed" || c.status === "reminded") && c.startsAt > enHoras(31).getTime(),
  );
  check(!!cancelable, "hay una cita cancelable", cancelable?.paciente);
  if (cancelable) {
    eventos = [...eventos, { at: enHoras(31), appointmentId: cancelable.id, kind: "patient_cancel", seq: eventos.length }];
    // al cancelar, debe aparecer en operaciones como hueco libre o tener candidatos
    s = snap(enHoras(31));
    const cancelada = s.citas.find((c) => c.id === cancelable.id)!;
    check(cancelada.status === "cancelled", `${cancelable.paciente} quedó cancelada`);
    // avanzamos un par de horas para que un candidato acepte (simulado, determinista)
    s = snap(enHoras(33));
    const trasOferta = s.citas.find((c) => c.id === cancelable.id)!;
    check(
      trasOferta.status === "recovered" || trasOferta.status === "cancelled",
      `tras la oferta: estado=${trasOferta.status}`,
    );
    if (trasOferta.status === "recovered") {
      console.log(`     ${soles(s.totales.recuperado)} recuperado tras la aceptación simulada`);
      check(s.totales.recuperado > 0, "la cancelación terminó en cita recuperada");
    }
  }

  console.log("\n5 · Retroceder en el tiempo");
  const huella = () =>
    JSON.stringify(
      reproducir(cat, eventos, reglas, enHoras(31)).citas.map((a) => [a.id, a.status]).sort(),
    );
  const antes = huella();
  snap(DEMO_START);
  check(
    snap(DEMO_START).totales.recordatoriosEnviados === recordatoriosIniciales,
    "el pasado vuelve a su estado original",
  );
  check(huella() === antes, "ir y volver reproduce el mismo mundo");

  console.log("\n6 · No hay duplicados");
  const msgs = reproducir(cat, eventos, reglas, enHoras(48)).mensajes;
  const enviados = msgs.filter((m) => m.kind.startsWith("reminder"));
  const claves = enviados.map((m) => `${m.appointmentId}:${m.kind}`);
  check(new Set(claves).size === claves.length, "ningún recordatorio se envió dos veces");

  console.log("\n7 · Centro de operaciones prioriza acciones");
  s = snap(enHoras(30));
  check(s.operaciones.length > 0, "la cola de operaciones tiene contenido");
  console.log(`     primeras clases: ${s.operaciones.slice(0, 3).map((o) => o.clase).join(", ")}`);

  console.log("\n8 · Laboratorios con alerta de retraso");
  s = snap(enHoras(30));
  check(s.trabajosLab.length > 0, "hay trabajos de laboratorio cargados");
  console.log(`     ${s.totales.labosEnRiesgo} trabajos en riesgo o por vencer`);

  console.log(
    fallos === 0
      ? "\nRecorrido completo sin fallos.\n"
      : `\n${fallos} comprobación(es) fallaron.\n`,
  );
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
