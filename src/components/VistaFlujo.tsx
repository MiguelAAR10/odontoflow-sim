import type { Carril, Snapshot } from "@/runtime/snapshot";
import { fechaCorta, hhmm, soles, useFlip } from "./util";

/**
 * Flujo de confirmación: dónde está cada cita dentro del proceso.
 *
 * Al mover el reloj, las tarjetas se deslizan de un carril al siguiente en vez
 * de reaparecer ya colocadas. Ese movimiento es la explicación del producto: se
 * ve al sistema empujando las citas hacia "confirmada" sin que nadie llame.
 */

const CARRILES: { clave: Carril; titulo: string; color: string; vacio: string }[] = [
  {
    clave: "programada",
    titulo: "Programada",
    color: "var(--color-line-3)",
    vacio: "Sin citas fuera de la ventana de recordatorio.",
  },
  {
    clave: "recordada",
    titulo: "Recordada",
    color: "var(--color-wait)",
    vacio: "Nadie esperando respuesta.",
  },
  {
    clave: "confirmada",
    titulo: "Confirmada",
    color: "var(--color-ok)",
    vacio: "Todavía nadie confirmó.",
  },
  {
    clave: "vencida",
    titulo: "Venció plazo",
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

  // La clave incluye el reloj: cada movimiento vuelve a medir posiciones.
  useFlip(`${snapshot.ahora}-${visibles.length}`);

  const recientes = [...snapshot.mensajes].reverse().slice(0, 40);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {CARRILES.map((carril) => {
          const lista = visibles
            .filter((c) => c.carril === carril.clave)
            .sort((a, b) => a.startsAt - b.startsAt);
          const monto = lista.reduce((s, c) => s + c.soles, 0);
          const esVencida = carril.clave === "vencida";

          return (
            <section
              key={carril.clave}
              className="overflow-hidden rounded-[9px] border border-line bg-panel"
            >
              <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-2.5 py-2">
                <span className="h-3.5 w-[3px] rounded-[2px]" style={{ background: carril.color }} />
                <h2 className="rotulo text-[9.5px]" style={{ color: carril.color }}>
                  {carril.titulo}
                </h2>
                <span className="tabular ml-auto text-[13px] font-semibold">{lista.length}</span>
              </header>
              <div className="tabular border-b border-line bg-panel-2 px-2.5 py-1 text-[10.5px] text-ink-3">
                {lista.length ? soles(monto) : "—"}
              </div>

              <div className="flex min-h-16 flex-col gap-1.5 p-2">
                {lista.length === 0 ? (
                  <p className="p-2.5 text-[10.5px] leading-relaxed text-ink-4">{carril.vacio}</p>
                ) : (
                  lista.map((c) => {
                    const espera = c.esperandoHoras ?? 0;
                    const tope = snapshot.reglas.alertAfterHours;
                    return (
                      <button
                        key={c.id}
                        data-flip={c.id}
                        onClick={() => onAbrir(c.id)}
                        className={`relative w-full rounded-md border px-2.5 py-2 text-left transition hover:shadow-sm ${
                          esVencida
                            ? "border-late-line bg-late-soft"
                            : "border-line bg-panel hover:border-line-3 hover:bg-panel-2"
                        }`}
                      >
                        {esVencida && (
                          <span className="absolute top-1.5 right-2 h-[5px] w-[5px] rounded-full bg-late" />
                        )}
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className={`truncate text-[12px] font-semibold tracking-[-0.012em] ${esVencida ? "text-late" : ""}`}
                          >
                            {c.paciente}
                          </span>
                          <span className="tabular ml-auto text-[11px] font-semibold whitespace-nowrap text-ink-2">
                            {soles(c.soles)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-3">
                          {c.tratamiento} · {fechaCorta(c.startsAt)} {hhmm(c.startsAt)}
                        </span>

                        <span className="tabular mt-1.5 flex items-center gap-1.5 text-[9.5px] text-ink-4">
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
                                : "sin historial de faltas"}
                            </span>
                          ) : carril.clave === "confirmada" ? (
                            <span>confirmó el paciente</span>
                          ) : (
                            <span>
                              recordatorio en{" "}
                              {Math.max(
                                0,
                                c.horasParaCita - snapshot.reglas.firstReminderHours,
                              ).toFixed(0)}{" "}
                              h
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

      {/* registro del motor */}
      <section className="mt-3 overflow-hidden rounded-[9px] border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-2.5">
          <h2 className="rotulo text-[10px] text-ink-2">Registro del motor</h2>
          <span className="tabular ml-auto text-[11px] text-ink-3">
            {snapshot.mensajes.length || ""}
          </span>
        </header>
        <div className="flex max-h-32 flex-col overflow-y-auto">
          {recientes.length === 0 ? (
            <p className="px-3 py-2.5 text-[11px] text-ink-4">
              Sin actividad. Mueve la línea de tiempo y el motor empieza a trabajar solo.
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
                  className="tabular anim-cae grid grid-cols-[44px_12px_1fr] items-center gap-2 border-b border-line px-3 py-1 text-[11px] last:border-b-0"
                >
                  <span className="text-ink-4">{hhmm(m.enviadoEn)}</span>
                  <span
                    className="h-[5px] w-[5px] justify-self-center rounded-full"
                    style={{ background: color }}
                  />
                  <span className="truncate text-ink-2">
                    {m.entrante
                      ? `respondió ${m.cuerpo === "1" ? "confirmando" : "pidiendo cambio"} · ${cita?.paciente ?? ""}`
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
