import { describe, it, expect } from "vitest";
import { respuestaDe } from "@/domain/paciente-sim";
import { catalogoBase } from "@/domain/seed";

const cat = catalogoBase();
const previasDe = new Map(cat.pacientes.map((p) => [p.id, p.previousNoShows]));
const citas = cat.citas;
const IDS = citas.map((c) => c.id);

describe("simulación de pacientes", () => {
  it("es determinista: mil llamadas con el mismo id dan lo mismo", () => {
    for (const id of IDS.slice(0, 10)) {
      const primera = JSON.stringify(respuestaDe(id, 0));
      for (let i = 0; i < 1000; i++) {
        expect(JSON.stringify(respuestaDe(id, 0))).toBe(primera);
      }
    }
  });

  it("el reparto sobre los 60 ids cae en 62/13/25 con ±10 puntos", () => {
    let confirma = 0;
    let reprograma = 0;
    let silencio = 0;
    for (const c of citas) {
      const r = respuestaDe(c.id, previasDe.get(c.pacienteId) ?? 0);
      if (r.tipo === "confirma") confirma++;
      else if (r.tipo === "reprograma") reprograma++;
      else silencio++;
    }
    const n = citas.length;
    expect(confirma / n).toBeGreaterThan(0.52);
    expect(confirma / n).toBeLessThan(0.72);
    expect(reprograma / n).toBeGreaterThan(0.03);
    expect(reprograma / n).toBeLessThan(0.23);
    expect(silencio / n).toBeGreaterThan(0.15);
    expect(silencio / n).toBeLessThan(0.35);
  });

  it("quien tiene 2 inasistencias previas guarda silencio más que quien tiene 0", () => {
    const silencio = (prev: number) =>
      IDS.filter((id) => respuestaDe(id, prev).tipo === "silencio").length / IDS.length;
    expect(silencio(2)).toBeGreaterThan(silencio(0));
  });

  it("trasHoras siempre está entre 0.5 y 5", () => {
    for (const id of IDS) {
      const r = respuestaDe(id, 0);
      if (r.tipo === "silencio") continue;
      expect(r.trasHoras).toBeGreaterThanOrEqual(0.5);
      expect(r.trasHoras).toBeLessThanOrEqual(5);
    }
  });
});
