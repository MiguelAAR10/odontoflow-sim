import { describe, it, expect } from "vitest";
import { assertTransition, canTransition, IllegalTransitionError } from "@/domain/transitions";

describe("máquina de estados: transiciones nuevas", () => {
  it("una cita cancelada puede recuperarse", () => {
    expect(canTransition("cancelled", "recovered")).toBe(true);
  });

  it("recover_slot valida la transición cancelled → recovered sin lanzar", () => {
    expect(() => assertTransition("cancelled", "recovered")).not.toThrow();
  });

  it("una cita recuperada puede cerrarse como completed", () => {
    expect(canTransition("recovered", "completed")).toBe(true);
  });

  it("una cita recuperada no puede cancelarse de nuevo (ya tiene dueño)", () => {
    expect(canTransition("recovered", "cancelled")).toBe(false);
  });

  it("transiciones ilegales lanzan IllegalTransitionError", () => {
    expect(() => assertTransition("recovered", "scheduled")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("completed", "recovered")).toThrow(IllegalTransitionError);
  });

  it("todo estado activo puede cancelarse", () => {
    for (const from of ["scheduled", "reminded", "confirmed", "reschedule_requested", "no_response"] as const) {
      expect(canTransition(from, "cancelled")).toBe(true);
    }
  });
});
