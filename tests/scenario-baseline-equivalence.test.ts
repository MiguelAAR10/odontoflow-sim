import { describe, it, expect } from "vitest";
import { catalogoBase } from "@/domain/seed";
import { COMPORTAMIENTO_BASE } from "@/domain/paciente-sim";
import { compileScenario, compileComportamiento } from "@/domain/scenario-compiler";
import { baselineScenario } from "@/domain/scenarios/baseline";
import { validateScenario } from "@/domain/scenario";

/**
 * La prueba central de V2.2: el escenario `baseline` no es una aproximación
 * del simulador de siempre, es EXACTAMENTE el mismo mundo, recompilado por un
 * camino nuevo.
 *
 * `compileScenario(baselineScenario)` recalcula `endsAt` de forma
 * independiente (misma fórmula que `catalogoBase()`, pero ejercitada de
 * nuevo, no copiada) — así que esta comparación profunda es una prueba real
 * del compilador, no una tautología.
 */
describe("el escenario baseline reproduce el mundo original exactamente", () => {
  it("compileScenario(baseline) es profundamente igual a catalogoBase()", () => {
    expect(compileScenario(baselineScenario)).toEqual(catalogoBase());
  });

  it("dos compilaciones de baseline producen catálogos iguales entre sí (determinismo)", () => {
    expect(compileScenario(baselineScenario)).toEqual(compileScenario(baselineScenario));
  });

  it("compileComportamiento(baseline) es igual a COMPORTAMIENTO_BASE", () => {
    expect(compileComportamiento(baselineScenario)).toEqual(COMPORTAMIENTO_BASE);
  });

  it("conserva los 4 roles fijos de la demo (p10, p17, p23, p24)", () => {
    const b = compileComportamiento(baselineScenario);
    expect(b.scriptedRoles.p10).toBe("confirma");
    expect(b.scriptedRoles.p17).toBe("reprograma");
    expect(b.scriptedRoles.p23).toBe("silencio");
    expect(b.scriptedRoles.p24).toBe("cancela");
  });

  it("preserva los volúmenes exactos: 28 pacientes, 4 doctores, 10 tratamientos, 60 citas, 5 en lista de espera", () => {
    expect(baselineScenario.patients).toHaveLength(28);
    expect(baselineScenario.doctors).toHaveLength(4);
    expect(baselineScenario.treatments).toHaveLength(10);
    expect(baselineScenario.appointments).toHaveLength(60);
    expect(baselineScenario.waitlist).toHaveLength(5);
    expect(baselineScenario.laboratories).toHaveLength(3);
    expect(baselineScenario.labJobs).toHaveLength(6);
  });

  it("es un escenario válido según validateScenario", () => {
    expect(validateScenario(baselineScenario)).toEqual([]);
  });
});
