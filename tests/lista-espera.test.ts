import { describe, it, expect } from "vitest";
import { candidatosParaHueco, primerCandidato } from "@/domain/lista-espera";
import { catalogoBase } from "@/domain/seed";
import type { CandidatoListaEspera } from "@/domain/tipos";

const cat = catalogoBase();

describe("lista de espera", () => {
  it("filtra por tratamiento y odontólogo preferidos", () => {
    const ahora = new Date(2026, 7, 13, 12, 0);
    const cita = {
      odontologoId: "d1",
      tratamientoId: "t1",
      startsAt: new Date(2026, 7, 13, 14, 0),
    };
    const lista: CandidatoListaEspera[] = [
      { id: "x1", pacienteId: "p1", tratamientoId: "t1", odontologoId: "d1", desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 12, 10, 0) },
      { id: "x2", pacienteId: "p2", tratamientoId: "t2", odontologoId: "d1", desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 12, 10, 0) },
      { id: "x3", pacienteId: "p3", tratamientoId: "t1", odontologoId: "d2", desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 12, 10, 0) },
      { id: "x4", pacienteId: "p4", tratamientoId: null, odontologoId: null, desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 12, 10, 0) },
    ];
    const compat = candidatosParaHueco(cita, lista, ahora).map((c) => c.id);
    expect(compat).toContain("x1"); // mismo tratamiento y odontólogo
    expect(compat).toContain("x4"); // sin preferencia: le sirve cualquiera
    expect(compat).not.toContain("x2"); // tratamiento distinto
    expect(compat).not.toContain("x3"); // odontólogo distinto
  });

  it("respeta la ventana horaria del candidato", () => {
    const ahora = new Date(2026, 7, 13, 12, 0);
    const cita = {
      odontologoId: "d1",
      tratamientoId: "t1",
      startsAt: new Date(2026, 7, 13, 14, 0),
    };
    const lista: CandidatoListaEspera[] = [
      // candidato cuya ventana ya cerró
      { id: "x1", pacienteId: "p1", tratamientoId: null, odontologoId: null, desde: new Date(2026, 7, 13, 8, 0), hasta: new Date(2026, 7, 13, 12, 0), createdAt: new Date(2026, 7, 12, 10, 0) },
      // candidato válido
      { id: "x2", pacienteId: "p2", tratamientoId: null, odontologoId: null, desde: new Date(2026, 7, 13, 8, 0), hasta: new Date(2026, 7, 14, 20, 0), createdAt: new Date(2026, 7, 12, 10, 0) },
    ];
    const compat = candidatosParaHueco(cita, lista, ahora).map((c) => c.id);
    expect(compat).toEqual(["x2"]);
  });

  it("ordena por antigüedad de la solicitud", () => {
    const ahora = new Date(2026, 7, 13, 12, 0);
    const cita = {
      odontologoId: "d1",
      tratamientoId: "t1",
      startsAt: new Date(2026, 7, 13, 14, 0),
    };
    const lista: CandidatoListaEspera[] = [
      { id: "nuevo", pacienteId: "p1", tratamientoId: null, odontologoId: null, desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 13, 9, 0) },
      { id: "viejo", pacienteId: "p2", tratamientoId: null, odontologoId: null, desde: new Date(2026, 7, 13, 8, 0), hasta: null, createdAt: new Date(2026, 7, 11, 9, 0) },
    ];
    const compat = candidatosParaHueco(cita, lista, ahora).map((c) => c.id);
    expect(compat[0]).toBe("viejo");
  });

  it("primerCandidato devuelve null si nadie es compatible", () => {
    const ahora = new Date(2026, 7, 13, 12, 0);
    const cita = {
      odontologoId: "d1",
      tratamientoId: "t1",
      startsAt: new Date(2026, 7, 13, 14, 0),
    };
    expect(primerCandidato(cita as never, [], ahora)).toBeNull();
  });

  it("el seed trae candidatos para una cancelación típica", () => {
    const ahora = new Date(2026, 7, 13, 12, 0);
    const cita = {
      odontologoId: "d1",
      tratamientoId: "t1",
      startsAt: new Date(2026, 7, 13, 14, 0),
    };
    expect(candidatosParaHueco(cita, cat.listaEspera, ahora).length).toBeGreaterThan(0);
  });
});
