import type { Snapshot } from "@/runtime/snapshot";
import { DIA3, soles } from "./util";

/**
 * Avance semanal.
 *
 * Cinco barras, una por día de la demo: la plata agendada ese día y, en verde,
 * la que el paciente ya confirmó. Al avanzar el reloj se ve el verde crecer de
 * abajo hacia arriba, sin leyenda ni ruido.
 */

const H = 76; // alto del área de barras, en px
const DIAS_DEMO = 5;

export function Semana({ snapshot }: { snapshot: Snapshot }) {
  const { inicio, ahora, citas } = snapshot;

  const dias = Array.from({ length: DIAS_DEMO }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);

  const cubo = new Map<number, { agendado: number; confirmado: number }>();
  for (const key of dias) cubo.set(key, { agendado: 0, confirmado: 0 });

  for (const c of citas) {
    if (!c.activa) continue;
    const key = new Date(c.startsAt);
    key.setHours(0, 0, 0, 0);
    const cubeta = cubo.get(key.getTime());
    if (!cubeta) continue;
    cubeta.agendado += c.soles;
    if (c.status === "confirmed") cubeta.confirmado += c.soles;
  }

  const max = Math.max(1, ...[...cubo.values()].map((v) => v.agendado));
  const esHoy = (key: number) => key === hoy.getTime();

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Avance de la semana</h2>
        <span className="ml-auto text-[12px] text-ink-3">confirmado sobre agendado</span>
      </header>

      <div className="flex items-end justify-between gap-2 px-4 pt-4 pb-3" style={{ height: H + 60 }}>
        {dias.map((key) => {
          const { agendado, confirmado } = cubo.get(key)!;
          const altoTotal = agendado > 0 ? Math.max(12, (agendado / max) * H) : 5;
          const frac = agendado > 0 ? confirmado / agendado : 0;
          const altoVerde = frac * altoTotal;
          const actual = esHoy(key);
          const d = new Date(key);

          return (
            <div key={key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              {actual && agendado > 0 ? (
                <div className="tabular text-center text-[11px] leading-tight text-ink-2">
                  <b className="block font-semibold text-ok-text">{soles(confirmado)}</b>
                  <span className="text-ink-4">de {soles(agendado)}</span>
                </div>
              ) : (
                <div className="h-[28px]" />
              )}

              <div className="flex w-full max-w-[36px] flex-col justify-end" style={{ height: H }}>
                <div
                  className="flex w-full flex-col justify-end overflow-hidden rounded-t-[5px] bg-line transition-[height] duration-500"
                  style={{ height: `${altoTotal}px` }}
                >
                  <div
                    className="w-full rounded-t-[5px] bg-ok transition-[height] duration-500"
                    style={{ height: `${altoVerde}px` }}
                  />
                </div>
              </div>

              <div
                className={`flex w-full max-w-[36px] flex-col items-center ${
                  actual ? "border-b-2 border-ink pb-0.5" : "pb-1.5"
                }`}
              >
                <span
                  className={`text-[11px] ${actual ? "font-semibold text-ink" : "text-ink-4"}`}
                >
                  {DIA3[d.getDay()]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
