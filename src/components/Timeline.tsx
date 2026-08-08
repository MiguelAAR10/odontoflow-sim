import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/runtime/snapshot";
import { DIA3, hhmm } from "./util";

/**
 * Línea de tiempo de la clínica.
 *
 * Arrastrar el pomo mueve el reloj hacia adelante o hacia atrás. Mientras se
 * arrastra solo se mueve la aguja en el cliente: recalcular el mundo en cada
 * píxel dispararía cientos de recálculos. Al soltar se pide el instante final
 * una sola vez.
 *
 * Debajo, cada marca es una cita coloreada por su estado, así se ve de un
 * vistazo dónde está la carga de la semana y qué queda por delante del ahora.
 */

const COLOR: Record<string, string> = {
  confirmada: "var(--color-ok)",
  recordada: "var(--color-wait)",
  vencida: "var(--color-late)",
  programada: "var(--color-ink-4)",
};

export function Timeline({
  snapshot,
  onSeek,
  pulso,
}: {
  snapshot: Snapshot;
  onSeek: (ms: number) => void;
  pulso: boolean;
}) {
  const { inicio, fin, ahora, citas } = snapshot;
  const rango = fin - inicio;
  const pista = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<number | null>(null);

  const visible = arrastre ?? ahora;
  const pct = (ms: number) => ((ms - inicio) / rango) * 100;

  const instanteEn = useCallback(
    (clientX: number) => {
      const caja = pista.current?.getBoundingClientRect();
      if (!caja) return ahora;
      const x = Math.min(1, Math.max(0, (clientX - caja.left) / caja.width));
      return inicio + x * rango;
    },
    [ahora, inicio, rango],
  );

  useEffect(() => {
    if (arrastre === null) return;

    const mover = (e: PointerEvent) => setArrastre(instanteEn(e.clientX));
    const soltar = (e: PointerEvent) => {
      const destino = instanteEn(e.clientX);
      setArrastre(null);
      onSeek(destino);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [arrastre, instanteEn, onSeek]);

  const dias = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    d.setHours(8, 0, 0, 0);
    return d;
  }).filter((d) => d.getTime() >= inicio && d.getTime() <= fin);

  return (
    <div className="flex items-center gap-3 px-4 py-2 sm:px-6">
      <span className="rotulo hidden whitespace-nowrap text-[10px] text-ink-4 sm:block">
        Línea de tiempo
      </span>

      <div
        ref={pista}
        role="slider"
        tabIndex={0}
        aria-label="Mover el tiempo de la clínica"
        aria-valuemin={inicio}
        aria-valuemax={fin}
        aria-valuenow={Math.round(visible)}
        aria-valuetext={`${DIA3[new Date(visible).getDay()]} ${new Date(visible).getDate()}, ${hhmm(visible)}`}
        onPointerDown={(e) => {
          e.preventDefault();
          setArrastre(instanteEn(e.clientX));
        }}
        onKeyDown={(e) => {
          const salto = e.shiftKey ? 24 : 1;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek(ahora + salto * 3_600_000);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek(ahora - salto * 3_600_000);
          }
        }}
        className="relative h-8 flex-1 cursor-ew-resize touch-none select-none"
      >
        {/* raíl */}
        <div className="absolute inset-x-0 top-3.5 h-[3px] rounded-full bg-line" />
        <div
          className="absolute top-3.5 left-0 h-[3px] rounded-full bg-ok transition-[width] duration-300"
          style={{ width: `${pct(visible)}%` }}
        />

        {/* marcas de día */}
        {dias.map((d) => (
          <span
            key={d.getTime()}
            className="absolute top-2 h-3 w-px bg-line-3"
            style={{ left: `${pct(d.getTime())}%` }}
          >
            <b className="tabular absolute top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-normal text-ink-4">
              {DIA3[d.getDay()]}
            </b>
          </span>
        ))}

        {/* cada cita, por estado */}
        {citas.map((c) => (
          <span
            key={c.id}
            className="absolute top-[4px] h-[7px] w-[3px] rounded-[1px] transition-colors duration-300"
            style={{
              left: `${pct(c.startsAt)}%`,
              background: c.activa ? COLOR[c.carril] : "var(--color-line-2)",
              opacity: c.activa ? 1 : 0.6,
            }}
          />
        ))}

        {/* pomo */}
        <span
          className={`absolute top-2 -ml-2 h-4 w-4 rounded-full border-[3px] border-ok bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-transform ${
            arrastre !== null ? "scale-115" : ""
          } ${pulso ? "anim-pulso" : ""}`}
          style={{ left: `${pct(visible)}%` }}
        />
      </div>

      <span className="tabular w-[7rem] text-right text-[13px] whitespace-nowrap text-ink-2">
        {DIA3[new Date(visible).getDay()]} {new Date(visible).getDate()}{" "}
        <b className="font-semibold text-ok-text">{hhmm(visible)}</b>
      </span>
    </div>
  );
}
