import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine";
import type { AppointmentView, AppointmentStatus, EvaluateInput, Rules } from "@/lib/engine";

const RULES: Rules = { firstReminderHours: 24, secondReminderHours: 2, alertAfterHours: 6 };
const NOW = new Date("2026-08-12T09:00:00");
const HOUR = 3_600_000;

/** Crea una cita que empieza dentro de `inHours` horas a partir de NOW. */
function appt(
  inHours: number,
  status: AppointmentStatus = "scheduled",
  extra: Partial<AppointmentView> = {},
): AppointmentView {
  const startsAt = new Date(NOW.getTime() + inHours * HOUR);
  return {
    id: extra.id ?? "a1",
    patientId: "p1",
    status,
    startsAt,
    endsAt: new Date(startsAt.getTime() + HOUR),
    remindedAt: null,
    ...extra,
  };
}

function run(appointments: AppointmentView[], input: Partial<EvaluateInput> = {}) {
  return evaluate({
    now: NOW,
    appointments,
    rules: RULES,
    sentMessages: [],
    raisedAlerts: [],
    ...input,
  });
}

describe("primer recordatorio", () => {
  it("lo emite cuando la cita entra en la ventana de 24 h", () => {
    const acts = run([appt(20)]);
    expect(acts).toEqual([{ type: "send_reminder", appointmentId: "a1", kind: "reminder_24h" }]);
  });

  it("no lo emite si todavía falta más de 24 h", () => {
    expect(run([appt(30)])).toEqual([]);
  });

  it("no lo emite dos veces", () => {
    const acts = run([appt(20)], {
      sentMessages: [{ appointmentId: "a1", kind: "reminder_24h" }],
    });
    expect(acts).toEqual([]);
  });

  it("no lo emite para una cita que ya pasó", () => {
    const acts = run([appt(-5)]);
    expect(acts.some((a) => a.type === "send_reminder")).toBe(false);
  });
});

describe("bordes exactos de la ventana", () => {
  it("a 23 h 59 min sí entra", () => {
    const a = appt(0);
    a.startsAt = new Date(NOW.getTime() + 24 * HOUR - 60_000);
    a.endsAt = new Date(a.startsAt.getTime() + HOUR);
    expect(run([a])).toHaveLength(1);
  });

  it("a 24 h 01 min todavía no", () => {
    const a = appt(0);
    a.startsAt = new Date(NOW.getTime() + 24 * HOUR + 60_000);
    a.endsAt = new Date(a.startsAt.getTime() + HOUR);
    expect(run([a])).toEqual([]);
  });

  it("a exactamente 24 h entra (límite inclusivo)", () => {
    expect(run([appt(24)])).toHaveLength(1);
  });
});

describe("segundo recordatorio", () => {
  it("sale a 2 h de la cita si ya se recordó y no respondió", () => {
    const a = appt(1.5, "reminded", { remindedAt: new Date(NOW.getTime() - HOUR) });
    const acts = run([a], { sentMessages: [{ appointmentId: "a1", kind: "reminder_24h" }] });
    expect(acts).toContainEqual({
      type: "send_reminder",
      appointmentId: "a1",
      kind: "reminder_2h",
    });
  });

  it("no sale si la cita ya está confirmada", () => {
    const a = appt(1.5, "confirmed", { remindedAt: new Date(NOW.getTime() - HOUR) });
    expect(run([a])).toEqual([]);
  });
});

describe("alerta por silencio", () => {
  it("se levanta al superar el plazo de 6 h", () => {
    const a = appt(20, "reminded", { remindedAt: new Date(NOW.getTime() - 7 * HOUR) });
    const acts = run([a], { sentMessages: [{ appointmentId: "a1", kind: "reminder_24h" }] });
    expect(acts).toContainEqual({ type: "raise_alert", appointmentId: "a1", kind: "no_response" });
  });

  it("no se levanta antes del plazo", () => {
    const a = appt(20, "reminded", { remindedAt: new Date(NOW.getTime() - 3 * HOUR) });
    const acts = run([a], { sentMessages: [{ appointmentId: "a1", kind: "reminder_24h" }] });
    expect(acts.some((x) => x.type === "raise_alert")).toBe(false);
  });

  it("no se levanta dos veces", () => {
    const a = appt(20, "reminded", { remindedAt: new Date(NOW.getTime() - 7 * HOUR) });
    const acts = run([a], {
      sentMessages: [{ appointmentId: "a1", kind: "reminder_24h" }],
      raisedAlerts: [{ appointmentId: "a1", kind: "no_response" }],
    });
    expect(acts.some((x) => x.type === "raise_alert")).toBe(false);
  });
});

describe("cierre de la cita", () => {
  it("una cita confirmada que ya pasó se marca atendida", () => {
    const a = appt(-3, "confirmed");
    expect(run([a])).toEqual([{ type: "mark_completed", appointmentId: "a1" }]);
  });

  it("una cita sin confirmar que ya pasó se marca ausencia", () => {
    const a = appt(-3, "reminded", { remindedAt: new Date(NOW.getTime() - 30 * HOUR) });
    expect(run([a])).toEqual([{ type: "mark_no_show", appointmentId: "a1" }]);
  });
});

describe("citas cerradas", () => {
  it.each(["completed", "no_show", "cancelled"] as const)(
    "una cita %s no genera ninguna acción",
    (status) => {
      expect(run([appt(-3, status)])).toEqual([]);
      expect(run([appt(20, status)])).toEqual([]);
    },
  );
});

describe("idempotencia", () => {
  it("dos llamadas con el mismo input dan el mismo resultado", () => {
    const citas = [appt(20, "scheduled", { id: "a1" }), appt(1, "scheduled", { id: "a2" })];
    expect(run(citas)).toEqual(run(citas));
  });

  it("tras registrar los mensajes emitidos, la segunda pasada no repite nada", () => {
    const citas = [appt(20, "scheduled", { id: "a1" })];
    const primera = run(citas);
    const enviados = primera
      .filter((a) => a.type === "send_reminder")
      .map((a) => ({ appointmentId: a.appointmentId, kind: a.kind as string }));
    expect(run(citas, { sentMessages: enviados })).toEqual([]);
  });
});

describe("varias citas a la vez", () => {
  it("evalúa cada una por separado", () => {
    const acts = run([
      appt(20, "scheduled", { id: "a1" }),
      appt(40, "scheduled", { id: "a2" }),
      appt(-2, "confirmed", { id: "a3" }),
    ]);
    expect(acts).toHaveLength(2);
    expect(acts.map((a) => a.appointmentId).sort()).toEqual(["a1", "a3"]);
  });
});
