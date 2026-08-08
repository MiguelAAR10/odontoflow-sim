import { useEffect, useMemo } from "react";
import type { Carril, Snapshot } from "@/runtime/snapshot";
import type { UserEventKind } from "@/domain/tipos";
import { BadgeEstado } from "./BadgeEstado";
import { fechaCorta, hhmm, soles, useFlip } from "./util";

/**
 * Agenda de citas.
 *
 * Dos zonas: arriba, el tablero por carriles (programada → recordada →
 * confirmada / vencida / recuperada). Al seleccionar una cita, abajo aparece la
 * consola con su conversación y las acciones disponibles, incluida la
 * cancelación con recuperación desde la lista de espera.
 */

const CARRILES: { clave: Carril; titulo: string; color: string; vacio: string }[] = [
  { clave: "programada", titulo: "Programada", color: "var(--color-line-3)", vacio: "Sin citas pendientes de recordatorio." },
  { clave: "recordada", titulo: "Recordatorio enviado", color: "var(--color-wait)", vacio: "Ningún paciente esperando respuesta." },
  { clave: "confirmada", titulo: "Confirmada", color: "var(--color-ok)", vacio: "Aún no hay citas confirmadas." },
  { clave: "vencida", titulo: "Plazo vencido", color: "var(--color-late)", vacio: "Ningún paciente superó el plazo." },
  { clave: "recuperada", titulo: "Recuperada", color: "var(--color-azul)", vacio: "Ningún hueco fue recuperado todavía." },
  { clave: "cancelada", titulo: "Cancelada", color: "var(--color-cancel)", vacio: "Sin cancelaciones." },
];

const Tecla = ({ children }: { children: React.ReactNode }) => (
  <kbd className="tabular rounded border border-current/30 px-1 text-[10px] opacity-70">{children}</kbd>
);

export function VistaAgenda({
  snapshot,
  seleccion,
  onAbrir,
  onEvento,
}: {
  snapshot: Snapshot;
  seleccion: string | null;
  onAbrir: (id: string) => void;
  onEvento: (id: string, kind: UserEventKind) => void;
}) {
  const visibles = snapshot.citas.filter((c) => c.activa || c.status === "cancelled" || c.status === "recovered");
  useFlip(`${snapshot.ahora}-${visibles.length}`);

  const cita = useMemo(
    () =>
      (seleccion && snapshot.citas.find((c) => c.id === seleccion && (c.activa || c.status === "cancelled" || c.status === "recovered"))) ||
      undefined,
    [seleccion, snapshot.citas],
  );

  // Atajos cuando hay una cita seleccionada
  useEffect(() => {
    if (!cita) return;
    const manejar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      const mapa: Record<string, UserEventKind> = {
        "1": "patient_confirm",
        "2": "patient_reschedule",
        "3": "patient_cancel",
        r: "recover_slot",
        R: "recover_slot",
      };
      const kind = mapa[e.key];
      if (!kind) return;
      e.preventDefault();
      onEvento(cita.id, kind);
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [cita, onEvento]);

  const hilo = cita ? snapshot.mensajes.filter((m) => m.citaId === cita.id) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* tablero por carriles */}
      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CARRILES.map((carril) => {
          const lista = visibles
            .filter((c) => c.carril === carril.clave)
            .sort((a, b) => a.startsAt - b.startsAt);
          const monto = lista.reduce((s, c) => s + c.soles, 0);
          const activo = cita && lista.some((c) => c.id === cita.id);
          return (
            <section
              key={carril.clave}
              className={`overflow-hidden rounded-xl border bg-panel transition ${
                activo ? "border-azul ring-1 ring-azul/30" : "border-line"
              }`}
            >
              <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-2">
                <span className="h-3.5 w-[3px] rounded-full" style={{ background: carril.color }} />
                <h2 className="rotulo text-[10px] text-ink-2">{carril.titulo}</h2>
                <span className="tabular ml-auto text-[14px] font-semibold">{lista.length}</span>
              </header>
              <div className="tabular border-b border-line bg-panel-2 px-3 py-1 text-[11px] text-ink-3">
                {lista.length ? soles(monto) : "—"}
              </div>
              <div className="flex min-h-16 flex-col gap-1.5 p-1.5">
                {lista.length === 0 ? (
                  <p className="p-2 text-[11px] leading-relaxed text-ink-4">{carril.vacio}</p>
                ) : (
                  lista.map((c) => (
                    <button
                      key={c.id}
                      data-flip={c.id}
                      onClick={() => onAbrir(c.id)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition hover:shadow-sm ${
                        cita?.id === c.id
                          ? "border-azul bg-azul-soft"
                          : carril.clave === "vencida"
                            ? "border-late-line bg-late-soft"
                            : carril.clave === "cancelada"
                              ? "border-cancel-line bg-cancel-soft opacity-80"
                              : "border-line bg-panel hover:bg-panel-2"
                      }`}
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="truncate text-[12px] font-semibold tracking-[-0.01em]">{c.paciente}</span>
                        <span className="tabular ml-auto whitespace-nowrap text-[11px] font-semibold text-ink-2">
                          {soles(c.soles)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] text-ink-3">
                        {c.tratamiento.toLowerCase()} · {hhmm(c.startsAt)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* consola de la cita seleccionada */}
      {!cita ? (
        <section className="rounded-xl border border-dashed border-line-2 bg-panel-2 px-6 py-8 text-center">
          <p className="text-[13.5px] text-ink-3">
            Seleccione una cita del tablero para ver su conversación y las acciones disponibles.
          </p>
          <p className="mt-1 text-[12px] text-ink-4">
            Pruebe a cancelar una cita confirmada para ver cómo el sistema ofrece el hueco a la lista de espera.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
          {/* detalle + acciones */}
          <section className="overflow-hidden rounded-xl border border-azul-line bg-panel">
            <header className="flex flex-wrap items-center gap-2 border-b border-line bg-azul-soft px-4 py-3">
              <BadgeEstado status={cita.status} />
              <span className="text-[14px] font-semibold tracking-[-0.01em]">{cita.paciente}</span>
              <span className="tabular ml-auto text-[12.5px] text-ink-3">
                {fechaCorta(cita.startsAt)} {hhmm(cita.startsAt)}
              </span>
            </header>
            <div className="px-4 py-4">
              <p className="tabular text-[14px] text-ink-2">
                {cita.tratamiento.toLowerCase()} · {cita.odontologo} ·{" "}
                <b className="font-semibold text-ink">{soles(cita.soles)}</b>
              </p>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-[12.5px]">
                <div>
                  <div className="rotulo text-[9.5px] text-ink-3">Estado</div>
                  <div className="mt-0.5 font-medium">{cita.status}</div>
                </div>
                <div>
                  <div className="rotulo text-[9.5px] text-ink-3">Inasistencias previas</div>
                  <div className="tabular mt-0.5">{cita.inasistenciasPrevias}</div>
                </div>
                {cita.esperandoHoras !== null && (
                  <div>
                    <div className="rotulo text-[9.5px] text-ink-3">Esperando respuesta</div>
                    <div className="tabular mt-0.5">{cita.esperandoHoras.toFixed(1)} h</div>
                  </div>
                )}
              </div>

              {/* acciones según estado */}
              <div className="mt-5 flex flex-wrap gap-2">
                {(cita.status === "reminded" || cita.status === "no_response") && (
                  <>
                    <button
                      onClick={() => onEvento(cita.id, "patient_confirm")}
                      className="flex items-center gap-1.5 rounded-lg bg-ok px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90"
                    >
                      Confirmar <Tecla>1</Tecla>
                    </button>
                    <button
                      onClick={() => onEvento(cita.id, "patient_reschedule")}
                      className="flex items-center gap-1.5 rounded-lg border border-wait-line bg-wait-soft px-3.5 py-2 text-[12.5px] font-semibold text-wait-text transition hover:bg-wait hover:text-white"
                    >
                      Reprogramar <Tecla>2</Tecla>
                    </button>
                  </>
                )}
                {(cita.status === "scheduled" ||
                  cita.status === "reminded" ||
                  cita.status === "confirmed" ||
                  cita.status === "reschedule_requested" ||
                  cita.status === "no_response") && (
                  <button
                    onClick={() => onEvento(cita.id, "patient_cancel")}
                    className="flex items-center gap-1.5 rounded-lg border border-late bg-late-soft px-3.5 py-2 text-[12.5px] font-semibold text-late transition hover:bg-late hover:text-white"
                  >
                    Cancelar cita <Tecla>3</Tecla>
                  </button>
                )}
                {cita.status === "cancelled" && (
                  <button
                    onClick={() => onEvento(cita.id, "recover_slot")}
                    className="flex items-center gap-1.5 rounded-lg bg-azul px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90"
                  >
                    Recuperar desde lista de espera <Tecla>R</Tecla>
                  </button>
                )}
                {cita.status === "reschedule_requested" && (
                  <p className="w-full text-[12px] text-ink-3">
                    El sistema propondrá horarios disponibles de {cita.odontologo} y reagendará automáticamente.
                  </p>
                )}
                {cita.status === "recovered" && (
                  <p className="w-full text-[12px] text-azul-text">
                    Hueco recuperado: un candidato de la lista de espera tomó el lugar.
                  </p>
                )}
              </div>

              {/* panel de pacientes elegibles para un hueco cancelado */}
              {cita.status === "cancelled" && snapshot.elegiblesPorCita[cita.id] && (
                <div className="mt-4 rounded-lg border border-azul-line bg-azul-soft/50 p-3">
                  <div className="rotulo mb-2 text-[10px] text-azul-text">
                    Pacientes elegibles para este hueco · reglas ficticias de demostración
                  </div>
                  <ul className="flex flex-col gap-2">
                    {snapshot.elegiblesPorCita[cita.id].map((cand) => (
                      <li key={cand.candidatoId} className="text-[12px]">
                        <div className="font-semibold text-ink">{cand.paciente}</div>
                        <ul className="ml-3 list-disc text-[11.5px] text-ink-3">
                          {cand.motivos.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* conversación */}
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
              <h2 className="rotulo text-[11px] text-ink-2">Conversación</h2>
              <span className="tabular ml-auto text-[12px] text-ink-3">{hilo.length}</span>
            </header>
            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto p-3">
              {hilo.length === 0 ? (
                <p className="p-3 text-[12.5px] leading-relaxed text-ink-4">
                  Sin mensajes: la cita aún no entra en la ventana de {snapshot.reglas.firstReminderHours} horas.
                </p>
              ) : (
                hilo.map((m) => (
                  <div
                    key={m.id}
                    className={`anim-cae max-w-[92%] rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-line ${
                      m.entrante
                        ? "self-end rounded-br-[3px] border-ok-line bg-ok-soft"
                        : m.tipo === "waitlist_offer" || m.tipo === "recovery_ack"
                          ? "self-start rounded-bl-[3px] border-azul-line bg-azul-soft"
                          : "self-start rounded-bl-[3px] border-line bg-panel-2"
                    }`}
                  >
                    <div className="rotulo mb-1 text-[9px] text-ink-4">
                      {m.entrante ? "paciente" : "clínica"} · {hhmm(m.enviadoEn)}
                    </div>
                    {m.cuerpo}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
