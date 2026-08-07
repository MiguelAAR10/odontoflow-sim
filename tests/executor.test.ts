import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { memoryDb, type Db } from "@/db";
import { alerts, appointments, messages, userEvents } from "@/db/schema";
import { seed } from "@/db/seed";
import { seekTo, recordEvent, resetDemo } from "@/lib/executor";
import { DEMO_START, getNow } from "@/lib/clock";
import { assertTransition, IllegalTransitionError } from "@/lib/transitions";

const HOUR = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * HOUR);

describe("ejecutor sobre la base de datos", () => {
  let db: Db;

  beforeEach(async () => {
    db = await memoryDb();
    await seed(db);
  });

  const recordatorios = async () =>
    (await db.select().from(messages).all()).filter((m) => m.kind.startsWith("reminder"));

  it("al arrancar solo recuerda las citas ya dentro de la ventana", async () => {
    await seekTo(db, DEMO_START);
    const enviados = await recordatorios();
    // el día de hoy tiene citas a menos de 24 h: esas sí reciben aviso de entrada
    expect(enviados.length).toBeGreaterThan(0);
    expect(enviados.length).toBeLessThan(10);
    const citas = await db.select().from(appointments).all();
    for (const m of enviados) {
      const cita = citas.find((c) => c.id === m.appointmentId)!;
      expect(cita.startsAt.getTime() - DEMO_START.getTime()).toBeLessThanOrEqual(24 * HOUR);
    }
  });

  it("avanzar 24 h dispara más recordatorios sin intervención humana", async () => {
    const alInicio = (await seekTo(db, DEMO_START), (await recordatorios()).length);
    await seekTo(db, enHoras(24));
    const enviados = await recordatorios();
    expect(enviados.length).toBeGreaterThan(alInicio);
    expect(enviados.every((m) => m.direction === "outbound")).toBe(true);
  });

  it("el mensaje trae el nombre del paciente y las instrucciones", async () => {
    await seekTo(db, enHoras(24));
    const [primero] = await recordatorios();
    expect(primero.body).toMatch(/Responde 1 para confirmar/);
    expect(primero.body).toMatch(/\d{2}:\d{2}/);
  });

  it("las citas recordadas quedan en estado reminded", async () => {
    await seekTo(db, enHoras(24));
    const recordadas = (await db.select().from(appointments).all()).filter(
      (a) => a.status === "reminded",
    );
    expect(recordadas.length).toBeGreaterThan(0);
    expect(recordadas.every((a) => a.remindedAt !== null)).toBe(true);
  });

  it("avanzar dos veces no duplica ningún recordatorio", async () => {
    await seekTo(db, enHoras(24));
    const primera = (await recordatorios()).length;
    await seekTo(db, enHoras(24));
    expect((await recordatorios()).length).toBe(primera);

    const claves = (await recordatorios()).map((m) => `${m.appointmentId}:${m.kind}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("responder 1 deja la cita confirmada y genera el acuse", async () => {
    await seekTo(db, enHoras(24));
    const objetivo = (await db.select().from(appointments).all()).find(
      (a) => a.status === "reminded",
    )!;

    await recordEvent(db, objetivo.id, "patient_confirm", enHoras(25));

    const despues = (
      await db.select().from(appointments).where(eq(appointments.id, objetivo.id)).all()
    )[0];
    expect(despues.status).toBe("confirmed");

    const hilo = (await db.select().from(messages).all()).filter(
      (m) => m.appointmentId === objetivo.id,
    );
    expect(hilo.some((m) => m.direction === "inbound" && m.body === "1")).toBe(true);
    expect(hilo.some((m) => m.kind === "confirmation_ack")).toBe(true);
  });

  it("responder 2 deja la cita como reprogramación pedida", async () => {
    await seekTo(db, enHoras(24));
    const objetivo = (await db.select().from(appointments).all()).find(
      (a) => a.status === "reminded",
    )!;
    await recordEvent(db, objetivo.id, "patient_reschedule", enHoras(25));
    const despues = (
      await db.select().from(appointments).where(eq(appointments.id, objetivo.id)).all()
    )[0];
    expect(despues.status).toBe("reschedule_requested");
  });

  it("el silencio prolongado levanta una alerta", async () => {
    await seekTo(db, enHoras(30));
    const abiertas = (await db.select().from(alerts).all()).filter((a) => !a.resolvedAt);
    expect(abiertas.length).toBeGreaterThan(0);
    expect(abiertas[0].kind).toBe("no_response");
  });

  it("confirmar resuelve la alerta abierta de esa cita", async () => {
    await seekTo(db, enHoras(30));
    const citas = await db.select().from(appointments).all();
    // una alerta cuya cita todavía no ocurrió: el paciente aún puede confirmar
    const abierta = (await db.select().from(alerts).all()).find((a) => {
      const c = citas.find((x) => x.id === a.appointmentId)!;
      return !a.resolvedAt && c.startsAt > enHoras(31);
    })!;
    expect(abierta).toBeDefined();

    await recordEvent(db, abierta.appointmentId, "patient_confirm", enHoras(31));

    const despues = (await db.select().from(alerts).all()).filter(
      (a) => a.appointmentId === abierta.appointmentId,
    );
    expect(despues.every((a) => a.resolvedAt !== null)).toBe(true);
    const cita = (
      await db.select().from(appointments).where(eq(appointments.id, abierta.appointmentId)).all()
    )[0];
    expect(cita.status).toBe("confirmed");
  });

  it("una respuesta que llega tarde no rompe ni resucita la cita", async () => {
    await seekTo(db, enHoras(24));
    const objetivo = (await db.select().from(appointments).all()).find(
      (a) => a.status === "reminded",
    )!;

    // el paciente contesta mucho después de que su cita ya pasó
    const muyTarde = new Date(objetivo.endsAt.getTime() + 6 * HOUR);
    await expect(recordEvent(db, objetivo.id, "patient_confirm", muyTarde)).resolves.not.toThrow();

    const despues = (
      await db.select().from(appointments).where(eq(appointments.id, objetivo.id)).all()
    )[0];
    expect(["no_show", "completed"]).toContain(despues.status);
  });

  it("el reloj queda donde se lo dejó", async () => {
    await seekTo(db, enHoras(12));
    expect((await getNow(db)).getTime()).toBe(enHoras(12).getTime());
  });

  it("no se puede salir del rango de la demo", async () => {
    const antes = await seekTo(db, new Date(DEMO_START.getTime() - 100 * HOUR));
    expect(antes.getTime()).toBe(DEMO_START.getTime());
  });
});

describe("la línea de tiempo va hacia atrás", () => {
  let db: Db;

  beforeEach(async () => {
    db = await memoryDb();
    await seed(db);
  });

  const huella = async (d: Db) =>
    JSON.stringify({
      citas: (await d.select().from(appointments).all())
        .map((a) => [a.id, a.status, a.remindedAt?.getTime() ?? null])
        .sort(),
      mensajes: (await d.select().from(messages).all()).length,
    });

  it("retroceder deshace lo que aún no había pasado", async () => {
    await seekTo(db, DEMO_START);
    const base = (await db.select().from(messages).all()).length;

    await seekTo(db, enHoras(48));
    const muchos = (await db.select().from(messages).all()).length;
    expect(muchos).toBeGreaterThan(base);

    await seekTo(db, DEMO_START);
    expect((await db.select().from(messages).all()).length).toBe(base);
  });

  it("ir y volver reproduce exactamente el mismo estado", async () => {
    await seekTo(db, enHoras(30));
    const antes = await huella(db);

    await seekTo(db, DEMO_START);
    await seekTo(db, enHoras(30));
    expect(await huella(db)).toBe(antes);
  });

  it("conserva las acciones del usuario al retroceder y volver", async () => {
    await seekTo(db, enHoras(24));
    const objetivo = (await db.select().from(appointments).all()).find(
      (a) => a.status === "reminded",
    )!;
    await recordEvent(db, objetivo.id, "patient_confirm", enHoras(25));

    // retroceder a antes de la confirmación: la cita no puede estar confirmada
    await seekTo(db, enHoras(24));
    const enElPasado = (
      await db.select().from(appointments).where(eq(appointments.id, objetivo.id)).all()
    )[0];
    expect(enElPasado.status).toBe("reminded");

    // volver adelante: la confirmación vuelve a aplicarse
    await seekTo(db, enHoras(26));
    const deVuelta = (
      await db.select().from(appointments).where(eq(appointments.id, objetivo.id)).all()
    )[0];
    expect(deVuelta.status).toBe("confirmed");
  });

  it("reiniciar borra la historia del usuario", async () => {
    await seekTo(db, enHoras(24));
    const objetivo = (await db.select().from(appointments).all()).find(
      (a) => a.status === "reminded",
    )!;
    await recordEvent(db, objetivo.id, "patient_confirm", enHoras(25));
    expect((await db.select().from(userEvents).all()).length).toBe(1);

    await resetDemo(db);
    expect((await db.select().from(userEvents).all()).length).toBe(0);
    expect((await getNow(db)).getTime()).toBe(DEMO_START.getTime());
    // quedan solo los recordatorios propios del instante inicial, ninguna respuesta
    const tras = await db.select().from(messages).all();
    expect(tras.every((m) => m.direction === "outbound")).toBe(true);
    expect((await db.select().from(appointments).all()).some((a) => a.status === "confirmed")).toBe(
      true,
    );
  });
});

describe("máquina de estados", () => {
  it("acepta las transiciones legales", () => {
    expect(() => assertTransition("scheduled", "reminded")).not.toThrow();
    expect(() => assertTransition("reminded", "confirmed")).not.toThrow();
    expect(() => assertTransition("confirmed", "completed")).not.toThrow();
    expect(() => assertTransition("no_response", "confirmed")).not.toThrow();
  });

  it("rechaza las ilegales", () => {
    expect(() => assertTransition("completed", "scheduled")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("scheduled", "completed")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("cancelled", "confirmed")).toThrow(IllegalTransitionError);
  });

  it("permite quedarse en el mismo estado", () => {
    expect(() => assertTransition("reminded", "reminded")).not.toThrow();
  });
});
