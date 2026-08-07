import { describe, it, expect } from "vitest";
import { catalogoBase } from "@/domain/seed";
import { DEMO_START } from "@/domain/seed";

describe("catálogo base", () => {
  const cat = catalogoBase();

  it("tiene 60 citas, 28 pacientes, 4 odontólogos y 10 tratamientos", () => {
    expect(cat.citas).toHaveLength(60);
    expect(cat.pacientes).toHaveLength(28);
    expect(cat.odontologos).toHaveLength(4);
    expect(cat.tratamientos).toHaveLength(10);
  });

  it("todas las citas caen dentro del horario de la clínica", () => {
    const fuera = cat.citas.filter((c) => {
      const ini = c.startsAt.getHours() + c.startsAt.getMinutes() / 60;
      const fin = c.endsAt.getHours() + c.endsAt.getMinutes() / 60;
      return ini < 8 || fin > 20;
    });
    expect(fuera.map((c) => c.id)).toEqual([]);
  });

  it("no tiene teléfonos repetidos", () => {
    const tels = cat.pacientes.map((p) => p.phone);
    expect(new Set(tels).size).toBe(tels.length);
  });

  it("las citas ya terminadas están cerradas", () => {
    const terminadas = cat.citas.filter((c) => c.endsAt <= DEMO_START);
    expect(terminadas.length).toBeGreaterThanOrEqual(12);
    expect(
      terminadas.every((c) => c.status === "completed" || c.status === "no_show"),
    ).toBe(true);
  });

  it("es determinista: dos catálogos tienen los mismos valores", () => {
    const a = catalogoBase();
    const b = catalogoBase();
    const huella = (c: typeof a) =>
      JSON.stringify(c.citas.map((x) => [x.id, x.startsAt.getTime(), x.status]));
    expect(huella(a)).toBe(huella(b));
  });
});
