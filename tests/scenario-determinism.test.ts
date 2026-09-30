import { describe, it, expect } from "vitest";
import { compileScenario, compileComportamiento, applyScenarioOverrides } from "@/domain/scenario-compiler";
import { validateScenario } from "@/domain/scenario";
import { reproducir } from "@/runtime/mundo";
import { SCENARIOS, listScenarios, getScenario } from "@/domain/scenarios";
import { baselineScenario } from "@/domain/scenarios/baseline";
import { noShowHeavyScenario } from "@/domain/scenarios/no-show-heavy";
import { cancellationRecoveryScenario } from "@/domain/scenarios/cancellation-recovery";
import { DEMO_END } from "@/domain/seed";

const HOUR = 3_600_000;

/** Serializa un Mundo a algo comparable con toEqual sin arrastrar closures. */
function mundoComparable(m: ReturnType<typeof reproducir>) {
  return JSON.parse(JSON.stringify(m));
}

describe("los 3 escenarios con nombre son válidos", () => {
  it.each(listScenarios().map((s) => [s.metadata.id, s]))("%s no tiene errores de validación", (_id, s) => {
    expect(validateScenario(s)).toEqual([]);
  });

  it("el registro expone exactamente baseline, no-show-heavy y cancellation-recovery", () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(
      ["baseline", "cancellation-recovery", "no-show-heavy"].sort(),
    );
  });

  it("getScenario cae a baseline ante un id desconocido", () => {
    expect(getScenario("no-existe").metadata.id).toBe("baseline");
  });
});

describe("determinismo: mismo escenario + mismos ids = mismo mundo, siempre", () => {
  it("compilar el mismo escenario dos veces da catálogos iguales", () => {
    const cat = getScenario("baseline");
    expect(compileScenario(cat)).toEqual(compileScenario(cat));
  });

  it("reproducir el mismo escenario dos veces da el mismo mundo", () => {
    const scenario = noShowHeavyScenario;
    const cat = compileScenario(scenario);
    const comportamiento = compileComportamiento(scenario);
    const objetivo = new Date(scenario.calendar.start.getTime() + 48 * HOUR);

    const m1 = reproducir(cat, [], scenario.rules, objetivo, comportamiento);
    const m2 = reproducir(cat, [], scenario.rules, objetivo, comportamiento);

    expect(mundoComparable(m1)).toEqual(mundoComparable(m2));
  });

  it("retroceder y volver a avanzar reproduce el mismo mundo (sin deshacer nada, reconstruyendo)", () => {
    const scenario = cancellationRecoveryScenario;
    const cat = compileScenario(scenario);
    const comportamiento = compileComportamiento(scenario);
    const t1 = new Date(scenario.calendar.start.getTime() + 24 * HOUR);
    const t2 = new Date(scenario.calendar.start.getTime() + 72 * HOUR);

    const directo = reproducir(cat, [], scenario.rules, t1, comportamiento);
    // ir hasta t2 y "retroceder" es simplemente reproducir de nuevo hasta t1:
    // el mundo se reconstruye desde el seed cada vez, nunca se deshace nada.
    reproducir(cat, [], scenario.rules, t2, comportamiento);
    const vuelta = reproducir(cat, [], scenario.rules, t1, comportamiento);

    expect(mundoComparable(directo)).toEqual(mundoComparable(vuelta));
  });

  it("la selección de escenario es solo un id: releer el mismo id siempre da la misma definición", () => {
    expect(getScenario("baseline")).toBe(getScenario("baseline"));
  });
});

describe("cambiar el comportamiento cambia SOLO los resultados que dependen del comportamiento", () => {
  it("no-show-heavy produce más silencio que baseline, con las mismas citas e ids", () => {
    const base = { cat: compileScenario(baselineScenario), comp: compileComportamiento(baselineScenario) };
    const pesado = { cat: compileScenario(noShowHeavyScenario), comp: compileComportamiento(noShowHeavyScenario) };

    // Mismos datos estructurales: solo el comportamiento difiere entre escenarios.
    expect(pesado.cat.citas.map((c) => c.id)).toEqual(base.cat.citas.map((c) => c.id));
    expect(pesado.cat.pacientes).toEqual(base.cat.pacientes);

    const objetivo = DEMO_END;
    const mBase = reproducir(base.cat, [], baselineScenario.rules, objetivo, base.comp);
    const mPesado = reproducir(pesado.cat, [], noShowHeavyScenario.rules, objetivo, pesado.comp);

    const noShowsBase = mBase.citas.filter((c) => c.status === "no_show").length;
    const noShowsPesado = mPesado.citas.filter((c) => c.status === "no_show").length;

    expect(noShowsPesado).toBeGreaterThan(noShowsBase);
  });

  it("cancellation-recovery produce más ciclos cancelar→ofertar→recuperar que baseline", () => {
    // Se cuenta por el REGISTRO DE ACTIVIDAD ("Cita recuperada..."), no por el
    // status final de la cita en el snapshot: una cita recuperada temprano en
    // la semana puede seguir avanzando y llegar a "completed" para cuando se
    // llega a DEMO_END (el motor la completa al pasar su propio `endsAt`), así
    // que el status final subcuenta recuperaciones reales. El log de
    // actividad es el registro durable del evento, y no se reescribe.
    const base = { cat: compileScenario(baselineScenario), comp: compileComportamiento(baselineScenario) };
    const recup = {
      cat: compileScenario(cancellationRecoveryScenario),
      comp: compileComportamiento(cancellationRecoveryScenario),
    };

    const objetivo = DEMO_END;
    const mBase = reproducir(base.cat, [], baselineScenario.rules, objetivo, base.comp);
    const mRecup = reproducir(recup.cat, [], cancellationRecoveryScenario.rules, objetivo, recup.comp);

    const contarRecuperaciones = (actividad: typeof mBase.actividad) =>
      actividad.filter((a) => a.texto === "Cita recuperada desde la lista de espera.").length;

    const recuperacionesBase = contarRecuperaciones(mBase.actividad);
    const recuperacionesNuevo = contarRecuperaciones(mRecup.actividad);

    // baseline ya tiene 2 (p24 cancela sus 2 citas de la semana); el escenario
    // nuevo debe superarlo claramente al sumar 4 pacientes guionados más.
    expect(recuperacionesBase).toBeGreaterThan(0);
    expect(recuperacionesNuevo).toBeGreaterThan(recuperacionesBase);
  });
});

describe("los overrides de edición producen un escenario válido y recompilable", () => {
  it("un override de reglas válido se refleja en el catálogo compilado", () => {
    const efectivo = applyScenarioOverrides(baselineScenario, {
      rules: { ...baselineScenario.rules, firstReminderHours: 48 },
    });
    expect(validateScenario(efectivo)).toEqual([]);
    expect(compileScenario(efectivo).reglas.firstReminderHours).toBe(48);
  });

  it("un override de comportamiento inválido es detectado por validateScenario", () => {
    const efectivo = applyScenarioOverrides(baselineScenario, {
      behavior: {
        ...baselineScenario.behavior,
        confirmProbability: 0.9,
        rescheduleProbability: 0.5, // suma 1.4 > 1
      },
    });
    const errores = validateScenario(efectivo);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => e.includes("no puede superar 1"))).toBe(true);
  });

  it("un override de doctores con un rol fijo huérfano NO se detecta acá (los roles son de pacientes, no de doctores) pero uno de reglas inválidas sí", () => {
    const efectivo = applyScenarioOverrides(baselineScenario, {
      rules: { ...baselineScenario.rules, clinicOpenHour: 22, clinicCloseHour: 8 },
    });
    const errores = validateScenario(efectivo);
    expect(errores.some((e) => e.includes("cierre"))).toBe(true);
  });
});
