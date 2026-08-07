import { describe, it, expect } from "vitest";
import { dentroDeHorario, clampReloj } from "@/runtime/horario";
import { DEMO_END, DEMO_START } from "@/domain/seed";

describe("dentroDeHorario", () => {
  const abre = 8;
  const cierra = 20;

  it("deja pasar un instante dentro del horario", () => {
    const miercoles12 = new Date(2026, 7, 12, 11, 30);
    expect(dentroDeHorario(miercoles12, abre, cierra).getTime()).toBe(miercoles12.getTime());
  });

  it("mueve la madrugada a la apertura del mismo día", () => {
    const tresAm = new Date(2026, 7, 12, 3, 0);
    const res = dentroDeHorario(tresAm, abre, cierra);
    expect(res.getHours()).toBe(8);
    expect(res.getDate()).toBe(12);
  });

  it("mueve después del cierre a la apertura del día siguiente", () => {
    const oncePm = new Date(2026, 7, 12, 23, 32);
    const res = dentroDeHorario(oncePm, abre, cierra);
    expect(res.getHours()).toBe(8);
    expect(res.getDate()).toBe(13);
  });

  it("varios avances desde las 18 h nunca caen fuera del horario", () => {
    let t = new Date(2026, 7, 12, 18, 0);
    for (let i = 0; i < 6; i++) {
      t = new Date(t.getTime() + 6 * 3_600_000); // +6 h cada paso
      t = dentroDeHorario(t, abre, cierra);
      const h = t.getHours() + t.getMinutes() / 60;
      expect(h).toBeGreaterThanOrEqual(abre);
      expect(h).toBeLessThan(cierra);
    }
  });
});

describe("clampReloj", () => {
  it("no deja salir del rango de la demo", () => {
    expect(clampReloj(new Date(DEMO_START.getTime() - 1000 * 3_600_000)).getTime()).toBe(
      DEMO_START.getTime(),
    );
    expect(clampReloj(new Date(DEMO_END.getTime() + 1000 * 3_600_000)).getTime()).toBe(
      DEMO_END.getTime(),
    );
  });
});
