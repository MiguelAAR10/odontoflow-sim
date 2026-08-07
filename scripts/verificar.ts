/**
 * Recorrido de la demo, de punta a punta, contra la base real.
 *
 * Comprueba lo que un evaluador va a hacer en vivo: mover el reloj, ver salir los
 * recordatorios, responder como paciente y retroceder en el tiempo. Si esto pasa,
 * la demo funciona.
 *
 *   npm run verificar
 */
import { createDb } from "@/db";
import { appointments, messages, alerts } from "@/db/schema";
import { seed } from "@/db/seed";
import { seekTo, recordEvent, resetDemo } from "@/lib/executor";
import { DEMO_START } from "@/lib/clock";
import { buildSnapshot } from "@/lib/snapshot";

const H = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * H);
const soles = (n: number) => `S/ ${Math.round(n).toLocaleString("es-PE")}`;

let fallos = 0;
function check(ok: boolean, texto: string, detalle = "") {
  console.log(`${ok ? "  ok  " : " FALLA"}  ${texto}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

async function main() {
  const db = await createDb(process.env.ODONTOFLOW_DB ?? "file:verificacion.db");
  await seed(db);
  await resetDemo(db);

  console.log("\n1 · Punto de partida");
  let s = await buildSnapshot(db);
  const recordatoriosIniciales = s.totales.recordatoriosEnviados;
  console.log(`     ${s.totales.citasVivas} citas vivas · ${soles(s.totales.agendado)} agendados`);
  check(s.totales.citasVivas > 30, "hay clínica cargada");
  check(s.pendientes.length === 0, "nadie pide decisión todavía");

  console.log("\n2 · Avanzar 24 horas");
  await seekTo(db, enHoras(24));
  s = await buildSnapshot(db);
  console.log(
    `     ${s.totales.recordatoriosEnviados} recordatorios · ${soles(s.totales.esperando)} esperando`,
  );
  check(
    s.totales.recordatoriosEnviados > recordatoriosIniciales,
    "el sistema envió recordatorios solo",
  );

  console.log("\n3 · Avanzar 6 horas más");
  await seekTo(db, enHoras(30));
  s = await buildSnapshot(db);
  console.log(`     ${s.pendientes.length} piden decisión · ${soles(s.totales.vencido)} en riesgo`);
  check(s.pendientes.length > 0, "el silencio genera alertas");

  console.log("\n4 · Responder como paciente");
  const objetivo = s.citas.find(
    (c) => c.activa && c.carril === "vencida" && c.startsAt > enHoras(31).getTime(),
  );
  check(!!objetivo, "hay una cita rescatable", objetivo?.paciente);
  if (objetivo) {
    await recordEvent(db, objetivo.id, "patient_confirm", enHoras(31));
    s = await buildSnapshot(db);
    const despues = s.citas.find((c) => c.id === objetivo.id)!;
    check(despues.status === "confirmed", `${objetivo.paciente} quedó confirmado`);
    check(
      s.mensajes.some((m) => m.citaId === objetivo.id && m.tipo === "confirmation_ack"),
      "se le envió el acuse",
    );
    const abiertas = (await db.select().from(alerts).all()).filter(
      (a) => a.appointmentId === objetivo.id && !a.resolvedAt,
    );
    check(abiertas.length === 0, "su alerta quedó resuelta");
  }

  console.log("\n5 · Retroceder en el tiempo");
  const huella = async () =>
    JSON.stringify(
      (await db.select().from(appointments).all())
        .map((a) => [a.id, a.status])
        .sort(),
    );
  const antes = await huella();
  await seekTo(db, DEMO_START);
  const alInicio = await buildSnapshot(db);
  check(
    alInicio.totales.recordatoriosEnviados === recordatoriosIniciales,
    "el pasado vuelve a su estado original",
  );
  await seekTo(db, enHoras(31));
  check((await huella()) === antes, "ir y volver reproduce el mismo mundo");

  console.log("\n6 · No hay duplicados");
  const enviados = (await db.select().from(messages).all()).filter((m) =>
    m.kind.startsWith("reminder"),
  );
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
