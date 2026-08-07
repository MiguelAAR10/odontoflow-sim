/**
 * Recorrido de la demo, de punta a punta, contra el runtime puro.
 *
 * Comprueba lo que un evaluador va a hacer en vivo: mover el reloj, ver salir los
 * recordatorios, ver a los pacientes confirmar solos, responder como paciente y
 * retroceder en el tiempo. Si esto pasa, la demo funciona.
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
  check(s.pendientes.length === 0, "nadie pide decisión todavía");

  console.log("\n2 · Avanzar 24 horas");
  s = snap(enHoras(24));
  console.log(
    `     ${s.totales.recordatoriosEnviados} recordatorios · ${s.totales.confirmadasSinLlamar} confirmadas · ${soles(s.totales.rescatado)} rescatado`,
  );
  check(s.totales.recordatoriosEnviados > recordatoriosIniciales, "el sistema envió recordatorios solo");

  console.log("\n3 · Avanzar 6 horas más");
  s = snap(enHoras(30));
  console.log(`     ${s.pendientes.length} piden decisión · ${soles(s.totales.vencido)} en riesgo`);
  check(s.pendientes.length > 0, "el silencio genera alertas");

  console.log("\n4 · Responder como paciente");
  s = snap(enHoras(31));
  const objetivo = s.citas.find(
    (c) => c.activa && c.carril === "vencida" && c.startsAt > enHoras(31).getTime(),
  );
  check(!!objetivo, "hay una cita rescatable", objetivo?.paciente);
  if (objetivo) {
    eventos = [...eventos, { at: enHoras(31), appointmentId: objetivo.id, kind: "patient_confirm", seq: eventos.length }];
    s = snap(enHoras(31));
    const despues = s.citas.find((c) => c.id === objetivo.id)!;
    check(despues.status === "confirmed", `${objetivo.paciente} quedó confirmado`);
    check(
      s.mensajes.some((m) => m.citaId === objetivo.id && m.tipo === "confirmation_ack"),
      "se le envió el acuse",
    );
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
