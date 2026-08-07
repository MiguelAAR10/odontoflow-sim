import { describe, it, expect, beforeEach } from "vitest";
import { catalogoBase } from "@/domain/seed";
import type { Catalogo, Reglas, UserEvent } from "@/domain/tipos";
import { DEMO_START } from "@/domain/seed";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot } from "@/runtime/snapshot";

const HOUR = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * HOUR);

let cat: Catalogo;
let reglas: Reglas;

beforeEach(() => {
  cat = catalogoBase();
  reglas = { ...cat.reglas };
});

const run = (eventos: UserEvent[] = [], target = DEMO_START) =>
  reproducir(cat, eventos, reglas, target);

const snap = (eventos: UserEvent[] = [], target = DEMO_START) =>
  buildSnapshot(run(eventos, target), cat, reglas);

describe("el motor trabaja solo", () => {
  it("al arrancar recuerda las citas ya dentro de la ventana de 24 h", () => {
    const s = snap();
    expect(s.totales.recordatoriosEnviados).toBeGreaterThan(0);
    expect(s.totales.recordatoriosEnviados).toBeLessThan(10);
  });

  it("avanzar 24 h dispara más recordatorios", () => {
    const alInicio = snap().totales.recordatoriosEnviados;
    expect(snap([], enHoras(24)).totales.recordatoriosEnviados).toBeGreaterThan(alInicio);
  });

  it("avanzar dos veces no duplica ningún recordatorio", () => {
    const primera = snap([], enHoras(24)).totales.recordatoriosEnviados;
    expect(snap([], enHoras(24)).totales.recordatoriosEnviados).toBe(primera);
  });
});

describe("los pacientes responden solos (simulación)", () => {
  it("avanzar 48 h deja citas confirmadas sin ninguna acción del usuario", () => {
    const s = snap([], enHoras(48));
    expect(s.totales.confirmadasSinLlamar).toBeGreaterThan(0);
    expect(s.totales.rescatado).toBeGreaterThan(0);
  });

  it("el silencio prolongado levanta alertas (los que no responden)", () => {
    const s = snap([], enHoras(30));
    expect(s.pendientes.length).toBeGreaterThan(0);
  });
});

describe("determinismo de la línea de tiempo", () => {
  const huella = (eventos: UserEvent[], target = enHoras(48)) => {
    const m = run(eventos, target);
    return JSON.stringify({
      citas: m.citas.map((c) => [c.id, c.status, c.remindedAt?.getTime() ?? null]).sort(),
      mensajes: m.mensajes.length,
    });
  };

  it("ir a 48 h, volver al inicio y volver a 48 h da exactamente el mismo estado", () => {
    const a = huella([], enHoras(48));
    run([], DEMO_START);
    expect(huella([], enHoras(48))).toBe(a);
  });

  it("retroceder deshace lo que aún no había pasado", () => {
    const base = run([], DEMO_START).mensajes.length;
    expect(run([], enHoras(48)).mensajes.length).toBeGreaterThan(base);
    expect(run([], DEMO_START).mensajes.length).toBe(base);
  });
});

describe("el recepcionista manda sobre la simulación", () => {
  it("si el usuario confirma una cita, la simulación no la pisa", () => {
    // una cita reminded al inicio
    const m0 = run([], enHoras(24));
    const objetivo = m0.citas.find((c) => c.status === "reminded")!;
    expect(objetivo).toBeDefined();

    const ev: UserEvent = {
      at: enHoras(25),
      appointmentId: objetivo.id,
      kind: "patient_confirm",
      seq: 0,
    };
    const m1 = run([ev], enHoras(26));
    const cita = m1.citas.find((c) => c.id === objetivo.id)!;
    expect(cita.status).toBe("confirmed");

    // sin el evento, la simulación podría haber hecho otra cosa; acá manda el humano
    const hilo = m1.mensajes.filter((mm) => mm.appointmentId === objetivo.id);
    expect(hilo.some((mm) => mm.direction === "inbound" && mm.body === "1")).toBe(true);
  });
});
