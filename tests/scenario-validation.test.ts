import { describe, it, expect } from "vitest";
import { validateScenario, type ScenarioDefinition } from "@/domain/scenario";
import { baselineScenario } from "@/domain/scenarios/baseline";

/**
 * Validación pura, un caso inválido por requisito del brief (§8). Cada test
 * parte de `baselineScenario` (ya válido, ya probado) y rompe EXACTAMENTE una
 * cosa, para que el error atribuido no deje dudas de cuál regla lo disparó.
 */

function romper(cambios: Partial<ScenarioDefinition>): ScenarioDefinition {
  return { ...baselineScenario, ...cambios };
}

describe("validateScenario — un escenario válido no tiene errores", () => {
  it("baseline no tiene errores", () => {
    expect(validateScenario(baselineScenario)).toEqual([]);
  });
});

describe("validateScenario — cada requisito del brief, roto uno por uno", () => {
  it("ids únicos: dos doctores con el mismo id", () => {
    const escenario = romper({
      doctors: [...baselineScenario.doctors, { ...baselineScenario.doctors[0] }],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("Id duplicado en doctores"))).toBe(true);
  });

  it("referencias de citas: tratamiento inexistente", () => {
    const escenario = romper({
      appointments: [
        { ...baselineScenario.appointments[0], treatmentId: "no-existe" },
        ...baselineScenario.appointments.slice(1),
      ],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes('tratamiento "no-existe" no existe'))).toBe(true);
  });

  it("referencias de citas: paciente inexistente", () => {
    const escenario = romper({
      appointments: [
        { ...baselineScenario.appointments[0], patientId: "no-existe" },
        ...baselineScenario.appointments.slice(1),
      ],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes('paciente "no-existe" no existe'))).toBe(true);
  });

  it("el doctor trabaja el día de la cita: Dr. Salazar (solo lun/mié/vie) puesto un domingo", () => {
    const salazar = baselineScenario.doctors.find((d) => d.id === "d2")!;
    expect(salazar.diasAtiende).not.toContain(0); // domingo
    const domingo = new Date(2026, 7, 16, 10, 0); // domingo 16 de agosto
    const escenario = romper({
      appointments: [
        { ...baselineScenario.appointments[0], doctorId: "d2", startsAt: domingo },
        ...baselineScenario.appointments.slice(1),
      ],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("no atiende ese día"))).toBe(true);
  });

  it("la duración del tratamiento debe ser positiva", () => {
    const escenario = romper({
      treatments: baselineScenario.treatments.map((t, i) => (i === 0 ? { ...t, durationMin: 0 } : t)),
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("duración debe ser positiva"))).toBe(true);
  });

  it("el precio sintético no puede ser negativo", () => {
    const escenario = romper({
      treatments: baselineScenario.treatments.map((t, i) => (i === 0 ? { ...t, priceCents: -1 } : t)),
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("precio sintético no puede ser negativo"))).toBe(true);
  });

  it("el cierre de la clínica debe ser posterior a la apertura", () => {
    const escenario = romper({ rules: { ...baselineScenario.rules, clinicOpenHour: 20, clinicCloseHour: 8 } });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("cierre debe ser posterior"))).toBe(true);
  });

  it("el segundo recordatorio debe ir más cerca de la cita que el primero", () => {
    const escenario = romper({
      rules: { ...baselineScenario.rules, firstReminderHours: 2, secondReminderHours: 24 },
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("segundo recordatorio debe ir más cerca"))).toBe(true);
  });

  it("la distribución de probabilidad no puede superar 1", () => {
    const escenario = romper({
      behavior: { ...baselineScenario.behavior, confirmProbability: 0.8, rescheduleProbability: 0.5 },
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("no puede superar 1"))).toBe(true);
  });

  it("un rol fijo debe apuntar a un paciente que existe", () => {
    const escenario = romper({
      behavior: {
        ...baselineScenario.behavior,
        scriptedRoles: { ...baselineScenario.behavior.scriptedRoles, "paciente-fantasma": "cancela" },
      },
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes('paciente "paciente-fantasma" no existe'))).toBe(true);
  });

  it("las referencias de la lista de espera deben existir (tratamiento)", () => {
    const escenario = romper({
      waitlist: [
        { ...baselineScenario.waitlist[0], treatmentId: "no-existe" },
        ...baselineScenario.waitlist.slice(1),
      ],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes('Lista de espera "w1": tratamiento "no-existe" no existe'))).toBe(true);
  });

  it("las referencias de la lista de espera deben existir (doctor)", () => {
    const escenario = romper({
      waitlist: [
        { ...baselineScenario.waitlist[0], doctorId: "no-existe" },
        ...baselineScenario.waitlist.slice(1),
      ],
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes('Lista de espera "w1": doctor "no-existe" no existe'))).toBe(true);
  });

  it("el inicio del calendario debe ser anterior al fin", () => {
    const escenario = romper({
      calendar: { start: baselineScenario.calendar.end, end: baselineScenario.calendar.start },
    });
    const errores = validateScenario(escenario);
    expect(errores.some((e) => e.includes("inicio del calendario debe ser anterior"))).toBe(true);
  });

  it("acumula VARIOS errores a la vez, no se detiene en el primero", () => {
    const escenario = romper({
      rules: { ...baselineScenario.rules, clinicOpenHour: 20, clinicCloseHour: 8 },
      treatments: baselineScenario.treatments.map((t, i) => (i === 0 ? { ...t, durationMin: -5 } : t)),
    });
    const errores = validateScenario(escenario);
    expect(errores.length).toBeGreaterThanOrEqual(2);
  });
});
