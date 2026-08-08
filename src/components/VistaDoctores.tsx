import { etiquetaDias, type Snapshot } from "@/runtime/snapshot";
import { BadgeEstado } from "./BadgeEstado";
import { fechaCorta, hhmm, soles } from "./util";

/**
 * Coordinación con doctores.
 *
 * Muestra quién está asignado, qué días atiende, su agenda del día y el impacto
 * de cancelaciones y reprogramaciones sobre su jornada. Destaca a los doctores
 * que solo atienden determinados días y levanta una alerta cuando una
 * cancelación deja un bloque relevante sin pacientes.
 *
 * No automatiza decisiones clínicas: solo coordina la agenda.
 */

export function VistaDoctores({ snapshot, onAbrir }: { snapshot: Snapshot; onAbrir: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {/* tarjetas de doctor, una por columna */}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.doctores.map((d) => {
          const parcial = d.diasAtiende.length > 0 && d.diasAtiende.length < 6;
          return (
            <section
              key={d.id}
              className={`overflow-hidden rounded-xl border bg-panel ${
                d.atiendeHoy ? "border-line" : "border-dashed border-line-2 opacity-75"
              }`}
            >
              <header className="flex items-center gap-2.5 border-b border-line bg-panel-2 px-3.5 py-3">
                <span className="h-8 w-1 rounded-full" style={{ background: d.color }} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{d.fullName}</div>
                  <div className="truncate text-[11.5px] text-ink-3">{d.specialty}</div>
                </div>
              </header>
              <div className="flex flex-col gap-2 px-3.5 py-3 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-3">Días que atiende</span>
                  <span className="font-medium">{etiquetaDias(d.diasAtiende)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-3">Hoy ({fechaCorta(snapshot.ahora)})</span>
                  {d.atiendeHoy ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok-text">
                      <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                      Atiende
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-panel-3 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                      No atiende
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-line pt-2">
                  <div>
                    <div className="tabular text-[15px] font-semibold">{d.citasHoy.length}</div>
                    <div className="text-[10.5px] text-ink-3">citas hoy</div>
                  </div>
                  <div>
                    <div className="tabular text-[15px] font-semibold text-ok-text">
                      {soles(d.confirmadoHoy)}
                    </div>
                    <div className="text-[10.5px] text-ink-3">confirmado</div>
                  </div>
                  <div>
                    <div className={`tabular text-[15px] font-semibold ${d.enRiesgoHoy > 0 ? "text-late" : "text-ink-4"}`}>
                      {d.huecosHoy > 0 ? `${d.huecosHoy} huecos` : "—"}
                    </div>
                    <div className="text-[10.5px] text-ink-3">{d.enRiesgoHoy > 0 ? "en riesgo" : "sin riesgo"}</div>
                  </div>
                </div>
                {parcial && (
                  <p className="rounded-lg bg-wait-soft px-2.5 py-1.5 text-[11px] leading-relaxed text-wait-text">
                    Solo atiende algunos días: reagendar fuera de su jornada cambia la programación.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* detalle de la jornada de hoy por doctor */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Agenda de hoy · {fechaCorta(snapshot.ahora)}</h2>
          <span className="tabular ml-auto text-[12px] text-ink-3">{hhmm(snapshot.ahora)}</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-left">
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Hora</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Doctor</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Paciente</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Tratamiento</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Estado</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Importe</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.doctores
                .filter((d) => d.citasHoy.length > 0)
                .flatMap((d) =>
                  d.citasHoy
                    .slice()
                    .sort((a, b) => a.startsAt - b.startsAt)
                    .map((c) => ({ ...c, doctorColor: d.color })),
                )
                .sort((a, b) => a.startsAt - b.startsAt)
                .map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onAbrir(c.id)}
                    className="cursor-pointer border-b border-line transition last:border-b-0 hover:bg-panel-2"
                  >
                    <td className="tabular px-4 py-2.5 font-medium">{hhmm(c.startsAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.doctorColor }} />
                        {c.odontologo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{c.paciente}</td>
                    <td className="px-4 py-2.5 text-ink-2">{c.tratamiento.toLowerCase()}</td>
                    <td className="px-4 py-2.5"><BadgeEstado status={c.status} size="xs" /></td>
                    <td className="tabular px-4 py-2.5 font-medium">{soles(c.soles)}</td>
                  </tr>
                ))}
              {snapshot.doctores.every((d) => d.citasHoy.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-4">
                    No hay citas programadas para hoy. Avance el reloj para ver la jornada cargarse.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* alerta de impacto sobre agenda del doctor */}
      {snapshot.operaciones.some((o) => o.clase === "hueco_libre") && (
        <section className="rounded-xl border border-azul-line bg-azul-soft px-4 py-3">
          <h3 className="text-[13.5px] font-semibold text-azul-text">Impacto sobre la agenda de doctores</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-ink-2">
            {snapshot.operaciones
              .filter((o) => o.clase === "hueco_libre")
              .map((o) => {
                const c = snapshot.citas.find((x) => x.id === o.citaId);
                return (
                  <li key={o.citaId}>
                    {c?.odontologo}: una cancelación dejó libre un bloque de{" "}
                    {c?.tratamiento.toLowerCase()} a las {c ? hhmm(c.startsAt) : "—"}.
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
