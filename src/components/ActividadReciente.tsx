import type { ActividadVista } from "@/runtime/snapshot";
import { fechaCorta, hhmm } from "./util";

/**
 * Registro de actividad (feed cronológico).
 *
 * Muestra, en orden descendente, cada hito automatizado que el sistema ejecutó:
 * recordatorios enviados, respuestas de pacientes, alertas, huecos detectados,
 * ofertas a la lista de espera, aceptaciones y citas completadas. Es la prueba
 * visible de que «OdontoFlow está haciendo trabajo» — no solo moviendo tarjetas.
 *
 * Las líneas marcadas como acción humana (tarea para recepción) se resaltan.
 */

const ESTILO: Record<ActividadVista["clase"], { punto: string; texto: string }> = {
  recordatorio: { punto: "bg-wait", texto: "text-ink-2" },
  respuesta: { punto: "bg-ok", texto: "text-ink-2" },
  alerta: { punto: "bg-late", texto: "text-ink-2" },
  hueco: { punto: "bg-cancel", texto: "text-ink-2" },
  oferta: { punto: "bg-azul", texto: "text-ink-2" },
  aceptacion: { punto: "bg-azul", texto: "text-azul-text" },
  reprograma: { punto: "bg-wait", texto: "text-wait-text" },
  completada: { punto: "bg-ink-3", texto: "text-ink-3" },
  lab: { punto: "bg-late", texto: "text-ink-2" },
};

export function ActividadReciente({
  actividad,
  limite = 40,
  compacto = false,
}: {
  actividad: ActividadVista[];
  limite?: number;
  compacto?: boolean;
}) {
  const items = actividad.slice(0, limite);

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[13px] text-ink-3">
          Aún no hay actividad registrada. Avance el reloj para que el sistema procese recordatorios y respuestas.
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-line">
      {items.map((a) => {
        const est = ESTILO[a.clase];
        return (
          <li
            key={a.id}
            className={`anim-cae flex items-start gap-3 px-4 py-2.5 ${a.accionHumana ? "bg-azul-soft/40" : ""}`}
          >
            <span className="tabular mt-0.5 w-[58px] shrink-0 text-[11px] text-ink-4">
              {fechaCorta(a.at)} {hhmm(a.at)}
            </span>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${est.punto}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] leading-snug ${est.texto}`}>
                {a.texto}
                {a.accionHumana && !compacto && (
                  <span className="ml-2 rounded bg-azul/15 px-1.5 py-0.5 text-[10px] font-semibold text-azul-text">
                    tarea recepción
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
