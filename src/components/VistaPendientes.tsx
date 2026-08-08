import { useEffect } from "react";
import type { Snapshot } from "@/runtime/snapshot";
import type { UserEventKind } from "@/domain/tipos";
import { DIAS, duracion, hhmm, soles } from "./util";

/**
 * Consola de decisión.
 *
 * Una cita a la vez y el resto de la pantalla enfocada en ella: recepción no
 * navega, decide. Se opera con teclado — Enter aplica la sugerencia, 1 y 2
 * simulan la respuesta del paciente, E pospone.
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
      texto: `Ofrecer los próximos huecos disponibles de ${c.odontologo}.`,
      accion: "Enviar horarios",
    };
  if (c.status === "no_response" && c.inasistenciasPrevias > 0)
    return {
      texto: `Llamar por teléfono. El paciente tiene ${c.inasistenciasPrevias} inasistencia${c.inasistenciasPrevias > 1 ? "s" : ""} previa${c.inasistenciasPrevias > 1 ? "s" : ""} y la cita vale ${soles(c.soles)}.`,
      accion: "Marcar como llamado",
    };
  if (c.status === "no_response")
    return {
      texto: "Reenviar el recordatorio. Si no responde, pasar el bloque a lista de espera.",
      accion: "Reenviar recordatorio",
    };
  return {
    texto: `Dentro del plazo de ${c.alertAfterHours} horas. El sistema avisa si vence.`,
    accion: "Mantener",
  };
}

const Tecla = ({ children }: { children: React.ReactNode }) => (
  <kbd className="tabular ml-auto rounded border border-current/30 px-1 text-[10px] opacity-70">
    {children}
  </kbd>
);

export function VistaPendientes({
  snapshot,
  seleccion,
  onEvento,
  onIrA,
}: {
  snapshot: Snapshot;
  seleccion: string | null;
  onEvento: (id: string, kind: UserEventKind) => void;
  onIrA: (vista: "flujo") => void;
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

  useEffect(() => {
    if (!cita || !decidible) return;
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
  }, [cita, decidible, onEvento]);

  const hilo = cita ? snapshot.mensajes.filter((m) => m.citaId === cita.id) : [];
  const indice = cita ? cola.findIndex((p) => p.citaId === cita.id) : -1;
  const sug = cita ? sugerencia({ ...cita, alertAfterHours: snapshot.reglas.alertAfterHours }) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_360px]">
      {!cita ? (
        <section className="rounded-xl border border-line bg-panel p-8">
          <h2 className="display text-[22px] tracking-[-0.02em] text-ok">Sin acciones requeridas</h2>
          <p className="mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">
            No hay acciones pendientes. El sistema avisa automáticamente si una cita supera el plazo
            de {snapshot.reglas.alertAfterHours} horas sin respuesta.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {[
              [snapshot.totales.recordatoriosEnviados, "recordatorios"],
              [snapshot.totales.confirmadasSinLlamar, "confirmadas"],
              [snapshot.totales.citasVivas, "citas activas"],
              [soles(snapshot.totales.rescatado), "recuperado"],
            ].map(([valor, etiqueta]) => (
              <div key={String(etiqueta)} className="bg-panel px-4 py-3.5">
                <div className="tabular text-[20px] font-semibold tracking-[-0.03em]">{valor}</div>
                <div className="mt-1 text-[12px] text-ink-3">{etiqueta}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex min-h-[420px] flex-col justify-center rounded-xl border border-line bg-panel px-8 py-8">
          <div className="rotulo mb-5 text-[11px] text-ink-3">
            {indice >= 0 ? `Caso ${indice + 1} de ${cola.length}` : "Consulta"} ·{" "}
            {cita.status === "no_response"
              ? "plazo vencido"
              : cita.status === "reschedule_requested"
                ? "solicita reagendar"
                : cita.status === "confirmed"
                  ? "confirmada"
                  : "esperando respuesta"}
          </div>

          <h1
            className="display leading-[1.05] tracking-[-0.03em]"
            style={{ fontSize: "clamp(30px,4.4vw,46px)" }}
          >
            {cita.paciente}
          </h1>
          <p className="tabular mt-3 text-[15px] text-ink-2">
            {cita.tratamiento.toLowerCase()} · {DIAS[new Date(cita.startsAt).getDay()]}{" "}
            {hhmm(cita.startsAt)} · {cita.odontologo} ·{" "}
            <b className="font-semibold text-ink">{soles(cita.soles)}</b>
          </p>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-5">
            {[
              [
                "Recordatorio",
                cita.esperandoHoras !== null ? `hace ${cita.esperandoHoras.toFixed(1)} h` : "no enviado",
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
              ["Inasistencias previas", String(cita.inasistenciasPrevias), cita.inasistenciasPrevias > 0],
              ["Tiempo hasta la cita", duracion(cita.horasParaCita), false],
            ].map(([etiqueta, valor, alerta]) => (
              <div key={String(etiqueta)} className="min-w-28">
                <div className="rotulo text-[10px] text-ink-3">{etiqueta}</div>
                <div className={`tabular mt-1 text-[15px] ${alerta ? "font-semibold text-late" : ""}`}>
                  {valor}
                </div>
              </div>
            ))}
          </div>

          {decidible && sug && (
            <div className="mt-6 max-w-[64ch] rounded-lg border-l-[3px] border-ok bg-ok-soft py-3 pl-4 pr-3">
              <div className="rotulo mb-1.5 text-[10px] text-ok-text">Acción sugerida</div>
              <p className="text-[15.5px] leading-relaxed">{sug.texto}</p>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3">
            {decidible && sug ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onEvento(cita.id, "apply_suggestion")}
                    className="flex items-center gap-2 rounded-lg bg-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90"
                  >
                    {sug.accion}
                    <Tecla>↵</Tecla>
                  </button>
                  <button
                    onClick={() => onEvento(cita.id, "snooze")}
                    className="flex items-center gap-2 rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 transition hover:border-ok-line hover:bg-ok-soft hover:text-ok-text"
                  >
                    Posponer <Tecla>E</Tecla>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rotulo text-[10px] text-ink-3">Simular respuesta del paciente</span>
                  <button
                    onClick={() => onEvento(cita.id, "patient_confirm")}
                    className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-ok-line hover:bg-ok-soft hover:text-ok-text"
                  >
                    Confirma <Tecla>1</Tecla>
                  </button>
                  <button
                    onClick={() => onEvento(cita.id, "patient_reschedule")}
                    className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-ok-line hover:bg-ok-soft hover:text-ok-text"
                  >
                    Pide reagendar <Tecla>2</Tecla>
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => onIrA("flujo")}
                className="w-fit rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 hover:bg-panel-2"
              >
                Volver al flujo
              </button>
            )}
          </div>
        </section>
      )}

      {/* conversación */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Mensajes</h2>
          <span className="tabular ml-auto text-[12.5px] text-ink-3">{hilo.length || ""}</span>
        </header>
        <div className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto p-3.5">
          {hilo.length === 0 ? (
            <p className="p-3 text-[13.5px] leading-relaxed text-ink-4">
              {cita
                ? `Sin mensajes: la cita aún no entra en la ventana de ${snapshot.reglas.firstReminderHours} horas.`
                : "Seleccione una cita para ver sus mensajes."}
            </p>
          ) : (
            hilo.map((m) => (
              <div
                key={m.id}
                className={`anim-cae max-w-[92%] rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                  m.entrante
                    ? "self-end rounded-br-[3px] border-ok-line bg-ok-soft"
                    : "rounded-bl-[3px] border-line bg-panel-2"
                }`}
              >
                <div className="rotulo mb-1 text-[9.5px] text-ink-4">
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
