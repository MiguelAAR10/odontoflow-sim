import type { Carril, Snapshot } from "@/runtime/snapshot";
import { fechaCorta, hhmm, soles, useFlip } from "./util";

/**
 * Flujo de confirmación: dónde está cada cita dentro del proceso.
 *
 * Al mover el reloj, las tarjetas se deslizan de una columna a la siguiente en
 * vez de reaparecer ya colocadas. Ese movimiento es la explicación del
 * producto: se ve al sistema moviendo las citas hacia «Confirmada» sin que
 * nadie tenga que llamar.
 */

const CARRILES: { clave: Carril; titulo: string; color: string; vacio: string }[] = [
  {
    clave: "programada",
    titulo: "Programada",
    color: "var(--color-line-3)",
    vacio: "Sin citas pendientes de recordatorio.",
  },
  {
    clave: "recordada",
    titulo: "Recordatorio enviado",
    color: "var(--color-wait)",
    vacio: "Ningún paciente esperando respuesta.",
  },
  {
    clave: "confirmada",
    titulo: "Confirmada",
    color: "var(--color-ok)",
    vacio: "Aún no hay citas confirmadas.",
  },
  {
    clave: "vencida",
    titulo: "Plazo vencido",
    color: "var(--color-late)",
    vacio: "Ningún paciente superó el plazo.",
  },
];

export function VistaFlujo({
  snapshot,
  filtro,
  onAbrir,
}: {
  snapshot: Snapshot;
  filtro: Carril[] | null;
  onAbrir: (id: string) => void;
}) {
  const visibles = snapshot.citas.filter(
    (c) => c.activa && (!filtro || filtro.includes(c.carril)),
  );

  useFlip(`${snapshot.ahora}-${visibles.length}`);

  const recientes = [...snapshot.mensajes].reverse().slice(0, 40);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CARRILES.map((carril) => {
          const lista = visibles
            .filter((c) => c.carril === carril.clave)
            .sort((a, b) => a.startsAt - b.startsAt);
          const monto = lista.reduce((s, c) => s + c.soles, 0);
          const esVencida = carril.clave === "vencida";

          return (
            <section
              key={carril.clave}
              className="overflow-hidden rounded-xl border border-line bg-panel"
            >
              <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3.5 py-2.5">
                <span className="h-4 w-[3px] rounded-full" style={{ background: carril.color }} />
                <h2 className="rotulo text-[10.5px] text-ink-2">
                  {carril.titulo}
                </h2>
                <span className="tabular ml-auto text-[15px] font-semibold">{lista.length}</span>
              </header>
              <div className="tabular border-b border-line bg-panel-2 px-3.5 py-1.5 text-[12px] text-ink-3">
                {lista.length ? soles(monto) : "—"}
              </div>

              <div className="flex min-h-20 flex-col gap-2 p-2.5">
                {lista.length === 0 ? (
                  <p className="p-2.5 text-[12.5px] leading-relaxed text-ink-4">{carril.vacio}</p>
                ) : (
                  lista.map((c) => {
                    const espera = c.esperandoHoras ?? 0;
                    const tope = snapshot.reglas.alertAfterHours;
                    return (
                      <button
                        key={c.id}
                        data-flip={c.id}
                        onClick={() => onAbrir(c.id)}
                        className={`relative w-full rounded-lg border px-3 py-2.5 text-left transition hover:shadow-sm ${
                          esVencida
                            ? "border-late-line bg-late-soft"
                            : "border-line bg-panel hover:border-line-3 hover:bg-panel-2"
                        }`}
                      >
                        {esVencida && (
                          <span className="absolute top-2 right-2.5 h-[6px] w-[6px] rounded-full bg-late" />
                        )}
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className={`truncate text-[13px] font-semibold tracking-[-0.01em] ${esVencida ? "text-late" : ""}`}
                          >
                            {c.paciente}
                          </span>
                          <span className="tabular ml-auto whitespace-nowrap text-[12px] font-semibold text-ink-2">
                            {soles(c.soles)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {c.tratamiento} · {fechaCorta(c.startsAt)} {hhmm(c.startsAt)}
                        </span>

                        <span className="tabular mt-2 flex items-center gap-2 text-[11px] text-ink-4">
                          {carril.clave === "recordada" ? (
                            <>
                              <span>{espera.toFixed(1)} h</span>
                              <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                                <i
                                  className="absolute inset-y-0 left-0 bg-wait transition-[width] duration-500"
                                  style={{ width: `${Math.min(100, (espera / tope) * 100)}%` }}
                                />
                              </span>
                              <span>{tope} h</span>
                            </>
                          ) : carril.clave === "vencida" ? (
                            <span>
                              {c.inasistenciasPrevias
                                ? `${c.inasistenciasPrevias} inasistencia${c.inasistenciasPrevias > 1 ? "s" : ""} previa${c.inasistenciasPrevias > 1 ? "s" : ""}`
                                : "sin inasistencias previas"}
                            </span>
                          ) : carril.clave === "confirmada" ? (
                            <span>confirmada por el paciente</span>
                          ) : (
                            <span>
                              recordatorio en{" "}
                              {Math.max(0, c.horasParaCita - snapshot.reglas.firstReminderHours).toFixed(0)} h
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* registro de actividad */}
      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Registro de actividad</h2>
          <span className="tabular ml-auto text-[12.5px] text-ink-3">
            {snapshot.mensajes.length || ""}
          </span>
        </header>
        <div className="flex max-h-40 flex-col overflow-y-auto">
          {recientes.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-4">
              Sin actividad. Avance el tiempo para que el sistema procese los recordatorios.
            </p>
          ) : (
            recientes.map((m) => {
              const cita = snapshot.citas.find((c) => c.id === m.citaId);
              const color = m.entrante
                ? "var(--color-ok)"
                : m.tipo.startsWith("reminder")
                  ? "var(--color-line-3)"
                  : "var(--color-ok)";
              return (
                <div
                  key={m.id}
                  className="tabular anim-cae grid grid-cols-[52px_12px_1fr] items-center gap-2.5 border-b border-line px-4 py-1.5 text-[12.5px] last:border-b-0"
                >
                  <span className="text-ink-4">{hhmm(m.enviadoEn)}</span>
                  <span
                    className="h-[6px] w-[6px] justify-self-center rounded-full"
                    style={{ background: color }}
                  />
                  <span className="truncate text-ink-2">
                    {m.entrante
                      ? `respondió ${m.cuerpo === "1" ? "confirmando" : "pidiendo reagendar"} · ${cita?.paciente ?? ""}`
                      : m.tipo.startsWith("reminder")
                        ? `recordatorio enviado · ${cita?.paciente ?? ""}`
                        : `acuse enviado · ${cita?.paciente ?? ""}`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
