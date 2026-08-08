import { describe, it, expect } from "vitest";
import { respuestaDe, ESCENARIO_DEMO } from "@/domain/paciente-sim";
import { catalogoBase } from "@/domain/seed";

const cat = catalogoBase();
const previasDe = new Map(cat.pacientes.map((p) => [p.id, p.previousNoShows]));
const citas = cat.citas;
const IDS = citas.map((c) => c.id);

describe("simulación de pacientes", () => {
  it("es determinista: mil llamadas con el mismo id dan lo mismo", () => {
    for (const c of citas.slice(0, 10)) {
      const primera = JSON.stringify(respuestaDe(c.id, c.pacienteId, 0));
      for (let i = 0; i < 1000; i++) {
        expect(JSON.stringify(respuestaDe(c.id, c.pacienteId, 0))).toBe(primera);
      }
    }
  });

  it("los pacientes-escenario siempre cumplen su rol, sin importar el hash", () => {
    // p10 confirma, p17 reprograma, p23 silencio, p24 cancela
    expect(respuestaDe("x", "p10", 0).tipo).toBe("confirma");
    expect(respuestaDe("x", "p17", 0).tipo).toBe("reprograma");
    expect(respuestaDe("x", "p23", 0).tipo).toBe("silencio");
    expect(respuestaDe("x", "p24", 0).tipo).toBe("cancela");
    // aunque cambien las inasistencias previas, el rol fijo manda
    expect(respuestaDe("x", "p10", 5).tipo).toBe("confirma");
    expect(respuestaDe("x", "p24", 5).tipo).toBe("cancela");
  });

  it("el reparto sobre los 60 ids cae cerca de 62/13/25 (excluyendo roles fijos)", () => {
    let confirma = 0;
    let reprograma = 0;
    let silencio = 0;
    for (const c of citas) {
      const r = respuestaDe(c.id, c.pacienteId, previasDe.get(c.pacienteId) ?? 0);
      if (r.tipo === "confirma") confirma++;
      else if (r.tipo === "reprograma") reprograma++;
      else if (r.tipo === "silencio") silencio++;
      // "cancela" es un rol fijo de un solo paciente (p23); no entra al reparto
    }
    const n = citas.length;
    expect(confirma / n).toBeGreaterThan(0.5);
    expect(confirma / n).toBeLessThan(0.72);
    expect(reprograma / n).toBeGreaterThan(0.03);
    expect(reprograma / n).toBeLessThan(0.25);
    expect(silencio / n).toBeGreaterThan(0.12);
    expect(silencio / n).toBeLessThan(0.35);
  });

  it("quien tiene 2 inasistencias previas guarda silencio más que quien tiene 0 (en el reparto libre)", () => {
    // solo pacientes sin rol fijo, para medir el efecto real del historial
    const libres = citas.filter((c) => !(c.pacienteId in ESCENARIO_DEMO));
    const silencio = (prev: number) =>
      libres.filter((c) => respuestaDe(c.id, c.pacienteId, prev).tipo === "silencio").length / libres.length;
    expect(silencio(2)).toBeGreaterThan(silencio(0));
  });

  it("trasHoras siempre está entre 0.5 y 5", () => {
    for (const c of IDS) {
      const r = respuestaDe(c, "p1", 0);
      if (r.tipo === "silencio") continue;
      expect(r.trasHoras).toBeGreaterThanOrEqual(0.5);
      expect(r.trasHoras).toBeLessThanOrEqual(5);
    }
  });
});
