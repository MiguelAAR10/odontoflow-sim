"use client";

import type { CitaVista, Snapshot } from "@/lib/snapshot";
import { fechaCorta, hhmm, soles, useContador } from "./util";

/**
 * Vista de ingresos: qué plata está en juego y qué la pone en riesgo.
 *
 * Abre con la cifra sin confirmar porque es la pregunta que se hace el dueño de
 * la clínica, no "cuántas citas hay". El resto de la pantalla existe para
 * explicar ese número.
 */

function Pips({ riesgo }: { riesgo: number }) {
  return (
    <span className="flex gap-[2.5px]" aria-label={`Riesgo ${Math.round(riesgo * 100)}%`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const encendido = riesgo > (i + 0.5) / 5;
        return (
          <span
            key={i}
            className="h-2 w-2 rounded-full border"
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
  const enJuego = totales.agendado - totales.confirmado;
  const animado = useContador(enJuego);
  const rescatado = useContador(totales.rescatado);

  const riesgosas = snapshot.citas
    .filter((c) => c.activa && c.riesgo > 0)
    .sort((a, b) => b.riesgo * b.soles - a.riesgo * a.soles)
    .slice(0, 9);

  const total = totales.agendado || 1;
  const anchoDe = (v: number) => `${((v / total) * 100).toFixed(2)}%`;

  const rescatadas = snapshot.citas.filter(
    (c) => c.activa && c.status === "confirmed" && c.remindedAt !== null,
  );

  return (
    <>
      {/* cifra dominante */}
      <div className="flex flex-wrap items-end gap-6 px-0.5 pb-4">
        <div>
          <div
            className="font-[family-name:var(--font-display)] leading-[0.9] tracking-[-0.035em]"
            style={{
              fontSize: "clamp(32px,5.2vw,60px)",
              color: totales.vencido > 0 ? "var(--color-late)" : "var(--color-ink)",
            }}
          >
            {soles(animado)}
          </div>
          <div className="rotulo mt-1.5 text-[9.5px] text-ink-3">En juego esta semana</div>
        </div>
        <p className="w-full pb-1 text-[12.5px] leading-relaxed text-ink-2 sm:w-auto sm:max-w-[34ch]">
          {totales.vencido > 0 ? (
            <>
              <b className="font-semibold text-ink">{soles(totales.vencido)}</b> venció el plazo de
              respuesta y necesita una decisión.
            </>
          ) : (
            <>
              <b className="font-semibold text-ink">{soles(totales.confirmado)}</b> ya los confirmó
              el propio paciente, sin una sola llamada.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_320px]">
        {/* tabla por riesgo */}
        <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
          <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-2.5">
            <h2 className="rotulo text-[10px] text-ink-2">Riesgo de no ocurrir</h2>
            <span className="tabular ml-auto text-[11px] text-ink-3">
              {riesgosas.length} de {totales.citasVivas}
            </span>
          </header>

          <div className="grid grid-cols-[46px_1fr_74px] gap-2.5 bg-panel-2 px-3 py-1.5 sm:grid-cols-[54px_1fr_78px_78px_58px]">
            {["Riesgo", "Paciente", "Cuándo", "Monto", ""].map((h, i) => (
              <span
                key={h + i}
                className={`rotulo text-[9px] text-ink-4 ${i === 3 ? "sm:text-right" : ""} ${
                  i === 2 ? "hidden sm:block" : ""
                } ${i === 4 ? "hidden sm:block" : ""} ${i === 3 ? "hidden sm:block" : ""}`}
              >
                {h}
              </span>
            ))}
            <span className="rotulo text-right text-[9px] text-ink-4 sm:hidden">Monto</span>
          </div>

          {riesgosas.length === 0 ? (
            <p className="px-3 py-6 text-[12px] text-ink-3">
              Todas las citas vivas están confirmadas por el paciente.
            </p>
          ) : (
            riesgosas.map((c) => (
              <button
                key={c.id}
                onClick={() => onAbrir(c.id)}
                className="grid w-full grid-cols-[46px_1fr_74px] items-center gap-2.5 border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-ok-soft sm:grid-cols-[54px_1fr_78px_78px_58px]"
              >
                <Pips riesgo={c.riesgo} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold tracking-[-0.01em]">
                    {c.paciente}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {c.tratamiento.toLowerCase()} ·{" "}
                    <em
                      className={`not-italic ${c.carril === "vencida" ? "font-semibold text-late" : ""}`}
                    >
                      {c.motivo}
                    </em>
                  </span>
                </span>
                <span className="tabular hidden text-[11.5px] text-ink-2 sm:block">
                  {fechaCorta(c.startsAt)} {hhmm(c.startsAt)}
                </span>
                <span className="tabular text-right text-[12.5px] font-semibold">
                  {soles(c.soles)}
                </span>
                <span className="hidden text-right text-[11px] text-ink-4 sm:block">abrir →</span>
              </button>
            ))
          )}
        </section>

        <div className="flex flex-col gap-3.5">
          {/* composición */}
          <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
            <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-2.5">
              <h2 className="rotulo text-[10px] text-ink-2">Composición</h2>
              <span className="ml-auto text-[11px] text-ink-3">filtrar</span>
            </header>
            <div className="p-3">
              <div className="flex h-6 overflow-hidden rounded border border-line bg-panel-3">
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
                    className="transition-[width,filter] duration-500 hover:brightness-90"
                    style={{ width: anchoDe(valor), background: color }}
                  />
                ))}
              </div>

              {(
                [
                  ["Confirmado", totales.confirmado, "var(--color-ok)", "confirmada"],
                  ["Esperando", totales.esperando, "var(--color-wait)", "esperando"],
                  ["Venció el plazo", totales.vencido, "var(--color-late)", "vencida"],
                ] as const
              ).map(([etiqueta, valor, color, seg]) => (
                <button
                  key={seg}
                  onClick={() => onFiltrar(seg)}
                  className="flex w-full items-center gap-2 border-b border-line py-2 text-[11.5px] text-ink-2 transition-[padding] last:border-b-0 hover:pl-1 hover:text-ink"
                >
                  <i className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
                  {etiqueta}
                  <b className="tabular ml-auto font-semibold text-ink">{soles(valor)}</b>
                  <span className="tabular text-ink-4">→</span>
                </button>
              ))}
            </div>
          </section>

          {/* recuperado */}
          <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
            <header className="border-b border-line bg-panel-2 px-3 py-2.5">
              <h2 className="rotulo text-[10px] text-ink-2">Recuperado por el sistema</h2>
            </header>
            <div className="flex items-center gap-3.5 p-3">
              <div>
                <div className="font-[family-name:var(--font-display)] text-[30px] leading-none tracking-[-0.025em] text-ok">
                  {soles(rescatado)}
                </div>
                <p className="mt-1 text-[11px] text-ink-3">
                  {rescatadas.length > 0
                    ? `${rescatadas.length} cita${rescatadas.length > 1 ? "s" : ""} confirmada${rescatadas.length > 1 ? "s" : ""} tras el recordatorio`
                    : "mueve el reloj y el sistema empieza a trabajar"}
                </p>
              </div>
              <div className="ml-auto flex h-8 items-end gap-[3px]">
                {Array.from({ length: 9 }, (_, i) => {
                  const c: CitaVista | undefined = rescatadas[i];
                  const max = Math.max(...rescatadas.map((x) => x.soles), 900);
                  return (
                    <i
                      key={i}
                      className="w-2 rounded-[2px] transition-[height,background] duration-500"
                      style={{
                        height: c ? `${Math.max(6, (c.soles / max) * 32)}px` : "4px",
                        background: c ? "var(--color-ok)" : "var(--color-line)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
