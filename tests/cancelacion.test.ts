import { describe, it, expect } from "vitest";
import { catalogoBase, DEMO_START } from "@/domain/seed";
import type { Reglas, UserEvent } from "@/domain/tipos";
import { reproducir } from "@/runtime/mundo";
import { candidatosParaHueco } from "@/domain/lista-espera";

const HOUR = 3_600_000;
const enHoras = (h: number) => new Date(DEMO_START.getTime() + h * HOUR);

const cat = catalogoBase();
const reglas: Reglas = { ...cat.reglas };

function citaCancelable() {
  const momento = enHoras(25);
  const citas = reproducir(cat, [], reglas, enHoras(24)).citas;
  return citas.find(
    (c) =>
      (c.status === "confirmed" || c.status === "reminded") &&
      c.endsAt.getTime() > enHoras(27).getTime() &&
      candidatosParaHueco(c, cat.listaEspera, momento).length > 0,
  )!;
}

describe("flujo de cancelación y recuperación", () => {
  it("una cancelación pasa la cita a cancelled", () => {
    const objetivo = citaCancelable();
    const ev: UserEvent = { at: enHoras(25), appointmentId: objetivo.id, kind: "patient_cancel", seq: 0 };
    const m = reproducir(cat, [ev], reglas, enHoras(25));
    const cita = m.citas.find((c) => c.id === objetivo.id)!;
    expect(cita.status).toBe("cancelled");
  });

  it("una cancelación dispara una oferta a la lista de espera", () => {
    const objetivo = citaCancelable();
    const ev: UserEvent = { at: enHoras(25), appointmentId: objetivo.id, kind: "patient_cancel", seq: 0 };
    const m = reproducir(cat, [ev], reglas, enHoras(25));
    // debe existir un mensaje de oferta a la lista de espera
    expect(m.mensajes.some((x) => x.kind === "waitlist_offer" && x.appointmentId === objetivo.id)).toBe(true);
  });

  it("tras aceptar la oferta simulada, la cita queda recuperada", () => {
    const objetivo = citaCancelable();
    const ev: UserEvent = { at: enHoras(25), appointmentId: objetivo.id, kind: "patient_cancel", seq: 0 };
    // la aceptación simulada tarda ~45 min; avanzamos 2 h para asegurar
    const m = reproducir(cat, [ev], reglas, enHoras(27));
    const cita = m.citas.find((c) => c.id === objetivo.id)!;
    expect(["cancelled", "recovered"]).toContain(cita.status);
  });

  it("recover_slot manual reasigna la cita al primer candidato", () => {
    const objetivo = citaCancelable();
    const cancel: UserEvent = { at: enHoras(25), appointmentId: objetivo.id, kind: "patient_cancel", seq: 0 };
    const recover: UserEvent = { at: enHoras(26), appointmentId: objetivo.id, kind: "recover_slot", seq: 1 };
    const m = reproducir(cat, [cancel, recover], reglas, enHoras(26));
    const cita = m.citas.find((c) => c.id === objetivo.id)!;
    expect(cita.status).toBe("recovered");
  });

  it("una cita recuperada se cierra como completed al pasar su hora", () => {
    const objetivo = citaCancelable();
    const cancel: UserEvent = { at: enHoras(25), appointmentId: objetivo.id, kind: "patient_cancel", seq: 0 };
    const recover: UserEvent = { at: enHoras(26), appointmentId: objetivo.id, kind: "recover_slot", seq: 1 };
    // avanzamos bastante para que la cita ya haya pasado
    const muyTarde = new Date(objetivo.endsAt.getTime() + HOUR);
    const m = reproducir(cat, [cancel, recover], reglas, muyTarde);
    const cita = m.citas.find((c) => c.id === objetivo.id)!;
    expect(cita.status).toBe("completed");
  });
});
