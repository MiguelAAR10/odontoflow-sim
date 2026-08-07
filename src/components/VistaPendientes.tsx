"use client";

import { useEffect } from "react";
import type { Snapshot } from "@/lib/snapshot";
import type { UserEventKind } from "@/lib/executor";
import { DIAS, duracion, hhmm, soles } from "./util";

/**
 * Consola de decisión.
 *
 * Una cita a la vez y el resto de la pantalla vacío a propósito: recepción no
 * navega, decide. Se opera con teclado — Enter aplica la sugerencia, 1 y 2
 * simulan la respuesta del paciente, E pospone — porque en mostrador cada
 * segundo cuenta y el ratón sobra.
 */

function sugerencia(c: {
  status: string;
  odontologo: string;
  soles: number;
  inasistenciasPrevias: number;
  alertAfterHours: number;
}): { texto: string; accion: string } {
  if (c.status === "reschedule_requested")
    return {
      texto: `Ofrecer los tres huecos libres más cercanos de ${c.odontologo} y mantener el bloque actual abierto hasta que responda.`,
      accion: "Enviar horarios",
    };
  if (c.status === "no_response" && c.inasistenciasPrevias > 0)
    return {
      texto: `Llamar por teléfono. Tiene ${c.inasistenciasPrevias} inasistencia${c.inasistenciasPrevias > 1 ? "s" : ""} previa${c.inasistenciasPrevias > 1 ? "s" : ""} y el bloque vale ${soles(c.soles)}: es el que más conviene rescatar.`,
      accion: "Marcar llamado",
    };
  if (c.status === "no_response")
    return {
      texto: "Reenviar el recordatorio y ofrecer el bloque a lista de espera si no responde.",
      accion: "Reenviar",
    };
  return {
    texto: `Todavía está dentro del plazo de ${c.alertAfterHours} horas. Puedes dejarlo correr: el sistema avisa solo si vence.`,
    accion: "Dejar correr",
  };
}

const Tecla = ({ children }: { children: React.ReactNode }) => (
  <kbd className="tabular ml-auto rounded border border-current/30 px-1 text-[9.5px] opacity-70">
    {children}
  </kbd>
);

export function VistaPendientes({
  snapshot,
  seleccion,
  onEvento,
  onIrA,
  ocupado,
}: {
  snapshot: Snapshot;
  seleccion: string | null;
  onEvento: (id: string, kind: UserEventKind) => void;
  onIrA: (vista: "flujo") => void;
  ocupado: boolean;
}) {
  const cola = snapshot.pendientes;
  const cita =
    (seleccion && snapshot.citas.find((c) => c.id === seleccion && c.activa)) ||
    (cola.length ? snapshot.citas.find((c) => c.id === cola[0].citaId) : undefined);

  const decidible =
    !!cita &&
    (cita.status === "no_response" ||
      cita.status === "reschedule_requested" ||
      cita.status === "reminded");

  // Atajos de teclado. Solo activos cuando hay algo que decidir.
  useEffect(() => {
    if (!cita || !decidible || ocupado) return;
    const manejar = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/);
      if (enCampo) return;
      const mapa: Record<string, UserEventKind> = {
        Enter: "apply_suggestion",
        e: "snooze",
        E: "snooze",
        "1": "patient_confirm",
        "2": "patient_reschedule",
      };
      const kind = mapa[e.key];
      if (!kind) return;
      e.preventDefault();
      onEvento(cita.id, kind);
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [cita, decidible, ocupado, onEvento]);

  const hilo = cita ? snapshot.mensajes.filter((m) => m.citaId === cita.id) : [];
  const indice = cita ? cola.findIndex((p) => p.citaId === cita.id) : -1;

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_330px]">
      {!cita ? (
        <section className="rounded-[9px] border border-line bg-panel p-6">
          <h2 className="font-[family-name:var(--font-display)] text-[19px] tracking-[-0.015em] text-ok">
            Sin pendientes
          </h2>
          <p className="mt-1.5 max-w-[56ch] text-[12px] leading-relaxed text-ink-2">
            Nada requiere una decisión humana. El motor sigue solo: avisa únicamente si un paciente
            supera el plazo de {snapshot.reglas.alertAfterHours} horas.
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-[7px] border border-line bg-line sm:grid-cols-4">
            {[
              [snapshot.totales.recordatoriosEnviados, "recordatorios"],
              [snapshot.totales.confirmadasSinLlamar, "confirmadas"],
              [snapshot.totales.citasVivas, "citas vivas"],
              [soles(snapshot.totales.rescatado), "rescatado"],
            ].map(([valor, etiqueta]) => (
              <div key={String(etiqueta)} className="bg-panel px-3 py-2.5">
                <div className="tabular text-[17px] font-semibold tracking-[-0.03em]">{valor}</div>
                <div className="mt-0.5 text-[10px] text-ink-3">{etiqueta}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex min-h-[400px] flex-col justify-center rounded-[9px] border border-line bg-panel px-8 py-7">
          <div className="rotulo mb-4 text-[9.5px] text-ink-3">
            {indice >= 0 ? `decisión ${indice + 1} de ${cola.length}` : "consulta puntual"} ·{" "}
            {cita.status === "no_response"
              ? "venció el plazo"
              : cita.status === "reschedule_requested"
                ? "pide cambio"
                : cita.status === "confirmed"
                  ? "confirmada"
                  : "esperando"}
          </div>

          <h1
            className="font-[family-name:var(--font-display)] leading-[1.04] tracking-[-0.03em]"
            style={{ fontSize: "clamp(28px,4.2vw,44px)" }}
          >
            {cita.paciente}
          </h1>
          <p className="tabular mt-2 text-[14px] text-ink-2">
            {cita.tratamiento.toLowerCase()} · {DIAS[new Date(cita.startsAt).getDay()]}{" "}
            {hhmm(cita.startsAt)} · {cita.odontologo} ·{" "}
            <b className="font-semibold text-ink">{soles(cita.soles)}</b>
          </p>

          <div className="mt-5 flex flex-wrap gap-6 border-t border-line pt-4">
            {[
              [
                "Recordatorio",
                cita.esperandoHoras !== null ? `hace ${cita.esperandoHoras.toFixed(1)} h` : "sin enviar",
                false,
              ],
              [
                "Respuesta",
                cita.status === "no_response"
                  ? "vencida"
                  : cita.status === "confirmed"
                    ? "confirmó"
                    : cita.esperandoHoras !== null
                      ? `quedan ${Math.max(0, snapshot.reglas.alertAfterHours - cita.esperandoHoras).toFixed(1)} h`
                      : "—",
                cita.status === "no_response",
              ],
              ["Inasistencias", String(cita.inasistenciasPrevias), cita.inasistenciasPrevias > 0],
              ["Falta", duracion(cita.horasParaCita), false],
            ].map(([etiqueta, valor, alerta]) => (
              <div key={String(etiqueta)} className="min-w-24">
                <div className="rotulo text-[8.5px] text-ink-3">{etiqueta}</div>
                <div
                  className={`tabular mt-0.5 text-[14px] ${alerta ? "font-semibold text-late" : ""}`}
                >
                  {valor}
                </div>
              </div>
            ))}
          </div>

          {decidible && (
            <div className="mt-5 max-w-[62ch] border-l-[3px] border-ok pl-4">
              <div className="rotulo mb-1.5 text-[9px] text-ok">El sistema propone</div>
              <p className="text-[15px] leading-relaxed">
                {
                  sugerencia({ ...cita, alertAfterHours: snapshot.reglas.alertAfterHours })
                    .texto
                }
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {decidible ? (
              <>
                <button
                  disabled={ocupado}
                  onClick={() => onEvento(cita.id, "apply_suggestion")}
                  className="flex items-center gap-2 rounded-md border border-dark bg-dark px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-88 disabled:opacity-50"
                >
                  {sugerencia({ ...cita, alertAfterHours: snapshot.reglas.alertAfterHours }).accion}
                  <Tecla>↵</Tecla>
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => onEvento(cita.id, "snooze")}
                  className="flex items-center gap-2 rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 transition hover:border-ok hover:bg-ok-soft hover:text-ok disabled:opacity-50"
                >
                  Esperar <Tecla>E</Tecla>
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => onEvento(cita.id, "patient_confirm")}
                  className="flex items-center gap-2 rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 transition hover:border-ok hover:bg-ok-soft hover:text-ok disabled:opacity-50"
                >
                  El paciente confirma <Tecla>1</Tecla>
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => onEvento(cita.id, "patient_reschedule")}
                  className="flex items-center gap-2 rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 transition hover:border-ok hover:bg-ok-soft hover:text-ok disabled:opacity-50"
                >
                  Pide cambio <Tecla>2</Tecla>
                </button>
              </>
            ) : (
              <button
                onClick={() => onIrA("flujo")}
                className="rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 hover:bg-panel-2"
              >
                Volver al flujo
              </button>
            )}
          </div>
        </section>
      )}

      {/* conversación */}
      <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-2.5">
          <h2 className="rotulo text-[10px] text-ink-2">Conversación</h2>
          <span className="tabular ml-auto text-[11px] text-ink-3">{hilo.length || ""}</span>
        </header>
        <div className="flex max-h-[380px] flex-col gap-2 overflow-y-auto p-2.5">
          {hilo.length === 0 ? (
            <p className="p-3 text-[11.5px] leading-relaxed text-ink-4">
              {cita
                ? `Sin mensajes: no entró en la ventana de ${snapshot.reglas.firstReminderHours} horas.`
                : "Abre una cita para ver su conversación."}
            </p>
          ) : (
            hilo.map((m) => (
              <div
                key={m.id}
                className={`anim-cae max-w-[94%] rounded-[9px] border px-2.5 py-2 text-[11.5px] leading-relaxed whitespace-pre-line ${
                  m.entrante
                    ? "self-end rounded-br-[2px] border-ok-line bg-ok-soft"
                    : "rounded-bl-[2px] border-line bg-panel-2"
                }`}
              >
                <div className="rotulo mb-1 text-[8.5px] text-ink-4">
                  {m.entrante ? "paciente" : "clínica"} · {hhmm(m.enviadoEn)}
                </div>
                {m.cuerpo}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
