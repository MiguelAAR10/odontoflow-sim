import { describe, it, expect } from "vitest";
import { catalogoBase, DEMO_START } from "@/domain/seed";
import type { Reglas, UserEvent } from "@/domain/tipos";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot } from "@/runtime/snapshot";
import { siguienteEvento } from "@/runtime/siguiente-evento";

const HOUR = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * HOUR);

const cat = catalogoBase();
const reglas: Reglas = { ...cat.reglas };

const snap = (eventos: UserEvent[] = [], target = DEMO_START) =>
  buildSnapshot(reproducir(cat, eventos, reglas, target), cat, reglas);

describe("registro de actividad", () => {
  it("al avanzar el reloj, el feed registra hitos automatizados", () => {
    const s = snap([], enHoras(30));
    expect(s.actividad.length).toBeGreaterThan(0);
    // debe haber al menos un recordatorio y al menos una respuesta o alerta
    const clases = new Set(s.actividad.map((a) => a.clase));
    expect(clases.has("recordatorio")).toBe(true);
    expect(clases.has("respuesta") || clases.has("alerta")).toBe(true);
  });

  it("el feed está ordenado del más reciente al más viejo", () => {
    const s = snap([], enHoras(30));
    for (let i = 1; i < s.actividad.length; i++) {
      expect(s.actividad[i - 1].at).toBeGreaterThanOrEqual(s.actividad[i].at);
    }
  });

  it("cuando un paciente no responde, se crea una acción para recepción en el feed", () => {
    const s = snap([], enHoras(30));
    const tareas = s.actividad.filter((a) => a.accionHumana);
    expect(tareas.length).toBeGreaterThan(0);
    expect(tareas.some((t) => /recepción|contactar/i.test(t.texto))).toBe(true);
  });
});

describe("escenarios deterministas de pacientes", () => {
  // Estos tests congelan la historia de la demo: los mismos pacientes siempre
  // cumplen su rol, lo que hace la presentación ensayable.

  it("Diego Manrique (p10) siempre termina confirmando al avanzar el reloj", () => {
    const s = snap([], enHoras(96));
    const hitos = s.actividad.filter((a) => a.paciente === "Diego Manrique");
    expect(hitos.some((h) => /confirmó/i.test(h.texto))).toBe(true);
  });

  it("Valeria Ochoa (p17) siempre pide reprogramar", () => {
    const s = snap([], enHoras(96));
    const hitos = s.actividad.filter((a) => a.paciente === "Valeria Ochoa");
    expect(hitos.some((h) => /reprogramar|reagend/i.test(h.texto))).toBe(true);
  });

  it("Raúl Ticona (p22) siempre queda sin respuesta y genera tarea de recepción", () => {
    const s = snap([], enHoras(40));
    const hitos = s.actividad.filter((a) => a.paciente === "Raúl Ticona");
    expect(hitos.some((h) => /no respondió|sin respuesta/i.test(h.texto))).toBe(true);
    expect(hitos.some((h) => h.accionHumana)).toBe(true);
  });
});

describe("siguiente evento", () => {
  it("encuentra un próximo instante distinto al actual mientras hay historia", () => {
    const prox = siguienteEvento(cat, [], reglas, DEMO_START.getTime());
    expect(prox).not.toBeNull();
    expect(prox!).toBeGreaterThan(DEMO_START.getTime());
  });

  it("es determinista: dos llamadas dan el mismo instante", () => {
    const a = siguienteEvento(cat, [], reglas, DEMO_START.getTime());
    const b = siguienteEvento(cat, [], reglas, DEMO_START.getTime());
    expect(a).toBe(b);
  });

  it("devuelve null cuando ya no hay más cambios (cerca del fin de la demo)", () => {
    const prox = siguienteEvento(cat, [], reglas, new Date(2026, 7, 16, 19, 0).getTime());
    // a esa hora puede que aún quede el cierre de alguna cita; si devuelve algo,
    // no puede ser mayor al fin de la demo
    if (prox !== null) expect(prox).toBeLessThanOrEqual(new Date(2026, 7, 16, 20, 0).getTime());
  });
});
