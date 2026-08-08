import { useState } from "react";
import type { Snapshot } from "@/runtime/snapshot";
import { ActividadReciente } from "./ActividadReciente";

/**
 * Pantalla de Actividad.
 *
 * El registro cronológico completo de lo que el sistema hizo: cada recordatorio,
 * cada respuesta, cada alerta, cada hueco, cada oferta y cada aceptación. Es la
 * prueba narrativa de que la automatización funciona y el eje central del relato
 * de la demo. Filtrable por tipo de evento para enfocar la explicación.
 */

type Filtro = "todas" | "recordatorio" | "respuesta" | "alerta" | "hueco" | "oferta" | "reprograma";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todo" },
  { clave: "recordatorio", etiqueta: "Recordatorios" },
  { clave: "respuesta", etiqueta: "Respuestas" },
  { clave: "alerta", etiqueta: "Alertas / tareas" },
  { clave: "reprograma", etiqueta: "Reprogramaciones" },
  { clave: "hueco", etiqueta: "Huecos y cancelaciones" },
  { clave: "oferta", etiqueta: "Ofertas y recuperaciones" },
];

const CLASE_DE_FILTRO: Record<Exclude<Filtro, "todas">, string[]> = {
  recordatorio: ["recordatorio"],
  respuesta: ["respuesta", "completada", "aceptacion"],
  alerta: ["alerta"],
  reprograma: ["reprograma"],
  hueco: ["hueco"],
  oferta: ["oferta", "aceptacion"],
};

export function VistaActividad({ snapshot }: { snapshot: Snapshot }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const filtradas =
    filtro === "todas"
      ? snapshot.actividad
      : snapshot.actividad.filter((a) => CLASE_DE_FILTRO[filtro].includes(a.clase));

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_280px]">
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Actividad reciente</h2>
          <span className="tabular ml-auto text-[12px] text-ink-3">
            {snapshot.actividad.length} eventos registrados
          </span>
        </header>
        <div className="max-h-[70vh] overflow-y-auto">
          <ActividadReciente actividad={filtradas} limite={120} />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="border-b border-line bg-panel-2 px-4 py-3">
            <h2 className="rotulo text-[11px] text-ink-2">Filtrar</h2>
          </header>
          <div className="flex flex-col p-2">
            {FILTROS.map((f) => (
              <button
                key={f.clave}
                onClick={() => setFiltro(f.clave)}
                className={`rounded-lg px-3 py-2 text-left text-[12.5px] transition ${
                  filtro === f.clave
                    ? "bg-azul-soft font-semibold text-azul-text"
                    : "text-ink-2 hover:bg-panel-2"
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-azul-line bg-azul-soft/60 px-4 py-3">
          <p className="text-[12px] leading-relaxed text-ink-2">
            Esta línea de tiempo es <b>determinista</b>: los mismos pacientes siempre hacen lo mismo.
            <b> Diego Manrique</b> confirma, <b>Valeria Ochoa</b> reprograma, <b>Raúl Ticona</b> no responde
            y <b>Mónica Arrieta</b> cancela — para que otro paciente tome su lugar desde la lista de espera.
          </p>
          <p className="mt-2 text-[11px] text-ink-3">Datos ficticios de demostración.</p>
        </section>
      </div>
    </div>
  );
}
