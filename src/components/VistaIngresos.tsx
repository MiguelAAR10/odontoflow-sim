import type { CitaVista, Snapshot } from "@/runtime/snapshot";
import { fechaCorta, hhmm, soles, useContador } from "./util";
import { Semana } from "./Semana";

/**
 * Resumen de la clínica: dónde está el riesgo y qué lo genera.
 *
 * Abre con el monto en riesgo: la suma de soles × riesgo de las citas vivas.
 * Es menor que el agendado total y por eso informa: indica cuánto puede
 * perderse de verdad, no cuánto está en juego en abstracto. El resto de la
 * pantalla existe para explicar ese número.
 */

const ACCIONABLES = new Set(["reminded", "no_response", "reschedule_requested"]);

function Pips({ riesgo }: { riesgo: number }) {
  return (
    <span className="flex gap-[3px]" aria-label={`Riesgo ${Math.round(riesgo * 100)}%`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const encendido = riesgo > (i + 0.5) / 5;
        return (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full border"
            style={{
              background: encendido ? (riesgo > 0.6 ? "var(--color-late)" : "var(--color-wait)") : "var(--color-panel)",
              borderColor: encendido
                ? riesgo > 0.6
                  ? "var(--color-late)"
                  : "#c79a3f"
                : "var(--color-line-2)",
            }}
          />
        );
      })}
    </span>
  );
}

export function VistaIngresos({
  snapshot,
  onAbrir,
  onFiltrar,
}: {
  snapshot: Snapshot;
  onAbrir: (id: string) => void;
  onFiltrar: (seg: "confirmada" | "esperando" | "vencida") => void;
}) {
  const { totales } = snapshot;
  const enRiesgo = useContador(totales.enRiesgo);
  const rescatado = useContador(totales.rescatado);

  const riesgosas = snapshot.citas
    .filter((c) => c.activa && ACCIONABLES.has(c.status))
    .sort((a, b) => b.riesgo * b.soles - a.riesgo * a.soles)
    .slice(0, 8);

  const total = totales.agendado || 1;
  const anchoDe = (v: number) => `${((v / total) * 100).toFixed(2)}%`;

  const rescatadas = snapshot.citas.filter(
    (c) => c.activa && c.status === "confirmed" && c.remindedAt !== null,
  );

  return (
    <>
      {/* cifra dominante */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 pb-6">
        <div>
          <div
            className="display leading-[0.9] tracking-[-0.035em] text-ink"
            style={{ fontSize: "clamp(36px,5.5vw,60px)" }}
          >
            {soles(enRiesgo)}
          </div>
          <div className="rotulo mt-2 text-[11px] text-ink-3">Monto en riesgo</div>
        </div>
        <p className="w-full text-[14.5px] leading-relaxed text-ink-2 sm:w-auto sm:max-w-[44ch]">
          De <b className="font-semibold text-ink">{soles(totales.agendado)}</b> agendado,{" "}
          <b className="font-semibold text-ok">{soles(totales.confirmado)}</b> está confirmado y{" "}
          <b className="font-semibold text-late">{soles(totales.vencido)}</b> superó el plazo de
          respuesta. La cifra de arriba es lo que aún puede perderse.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_340px]">
        {/* tabla por riesgo */}
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
            <h2 className="rotulo text-[11px] text-ink-2">Citas con mayor riesgo</h2>
            <span className="tabular ml-auto text-[12.5px] text-ink-3">
              {riesgosas.length > 0 ? `${riesgosas.length} requieren atención` : "sin riesgo"}
            </span>
          </header>

          {riesgosas.length === 0 ? (
            <p className="px-4 py-10 text-[14px] leading-relaxed text-ink-3">
              No hay citas en riesgo en este momento. Avance el tiempo para que el sistema procese
              los recordatorios.
            </p>
          ) : (
            <div className="flex flex-col">
              {riesgosas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onAbrir(c.id)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-ok-soft last:border-b-0"
                >
                  <Pips riesgo={c.riesgo} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">
                      {c.paciente}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                      {c.tratamiento.toLowerCase()} ·{" "}
                      <em className={`not-italic ${c.carril === "vencida" ? "font-semibold text-late" : ""}`}>
                        {c.motivo}
                      </em>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[14px] font-semibold">{soles(c.soles)}</span>
                    <span className="tabular mt-0.5 block text-[11.5px] text-ink-3">
                      {fechaCorta(c.startsAt)} {hhmm(c.startsAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {/* distribución */}
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <header className="border-b border-line bg-panel-2 px-4 py-3">
              <h2 className="rotulo text-[11px] text-ink-2">Distribución por estado</h2>
            </header>
            <div className="p-4">
              <div className="mb-3 flex h-7 overflow-hidden rounded-lg border border-line bg-panel-3">
                {(
                  [
                    ["confirmada", totales.confirmado, "var(--color-ok)"],
                    ["esperando", totales.esperando, "var(--color-wait)"],
                    ["vencida", totales.vencido, "var(--color-late)"],
                  ] as const
                ).map(([seg, valor, color]) => (
                  <button
                    key={seg}
                    onClick={() => onFiltrar(seg)}
                    aria-label={`Ver ${seg}`}
                    title={`${seg}: ${soles(valor)}`}
                    className="transition-[width] duration-500 hover:brightness-90"
                    style={{ width: anchoDe(valor), background: color }}
                  />
                ))}
              </div>

              <div className="flex flex-col">
                {(
                  [
                    ["Confirmado", totales.confirmado, "var(--color-ok)", "confirmada"],
                    ["Por confirmar", totales.esperando, "var(--color-wait)", "esperando"],
                    ["Plazo vencido", totales.vencido, "var(--color-late)", "vencida"],
                  ] as const
                ).map(([etiqueta, valor, color, seg]) => (
                  <button
                    key={seg}
                    onClick={() => onFiltrar(seg)}
                    className="flex w-full items-center gap-2.5 border-b border-line py-2.5 text-[13.5px] text-ink-2 transition last:border-b-0 hover:pl-1 hover:text-ink"
                  >
                    <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
                    {etiqueta}
                    <b className="tabular ml-auto font-semibold text-ink">{soles(valor)}</b>
                    <span className="text-ink-4">→</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* recuperado */}
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <header className="border-b border-line bg-panel-2 px-4 py-3">
              <h2 className="rotulo text-[11px] text-ink-2">Confirmado tras recordatorio</h2>
            </header>
            <div className="flex items-center gap-4 p-4">
              <div>
                <div className="display text-[32px] leading-none tracking-[-0.025em] text-ok">
                  {soles(rescatado)}
                </div>
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  {rescatadas.length > 0
                    ? `${rescatadas.length} cita${rescatadas.length > 1 ? "s" : ""} confirmada${rescatadas.length > 1 ? "s" : ""} de forma automática`
                    : "avance el tiempo para ver resultados"}
                </p>
              </div>
              <div className="ml-auto flex h-10 items-end gap-[3px]">
                {Array.from({ length: 9 }, (_, i) => {
                  const c: CitaVista | undefined = rescatadas[i];
                  const max = Math.max(...rescatadas.map((x) => x.soles), 900);
                  return (
                    <i
                      key={i}
                      className="w-2.5 rounded-[3px] transition-[height,background] duration-500"
                      style={{
                        height: c ? `${Math.max(8, (c.soles / max) * 40)}px` : "5px",
                        background: c ? "var(--color-ok)" : "var(--color-line)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          <Semana snapshot={snapshot} />
        </div>
      </div>
    </>
  );
}
