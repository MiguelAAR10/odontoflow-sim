import type { Snapshot } from "@/runtime/snapshot";
import { fechaCorta, hhmm } from "./util";

/**
 * Seguimiento de laboratorios.
 *
 * Módulo operativo sencillo: qué trabajo está en cada laboratorio, cuándo se
 * envió, cuándo se prometió, su estado y responsable. La alerta de retraso se
 * calcula sola comparando la fecha prometida con el reloj virtual.
 *
 * No intenta ser un software de gestión dental completo.
 */

const ESTADO_LABEL: Record<string, { etiqueta: string; clase: string }> = {
  en_proceso: { etiqueta: "En proceso", clase: "text-wait-text bg-wait-soft" },
  recibido: { etiqueta: "Recibido", clase: "text-ok-text bg-ok-soft" },
  ajuste: { etiqueta: "En ajuste", clase: "text-wait-text bg-wait-soft" },
  entregado: { etiqueta: "Entregado", clase: "text-ink-3 bg-panel-3" },
};

export function VistaLaboratorios({ snapshot }: { snapshot: Snapshot }) {
  const trabajos = [...snapshot.trabajosLab].sort((a, b) => {
    // primero los vencidos, luego los próximos a vencer, luego por fecha
    if ((a.retrasoHoras ?? -1) !== (b.retrasoHoras ?? -1)) {
      return (b.retrasoHoras ?? -1) - (a.retrasoHoras ?? -1);
    }
    return a.prometidoEn - b.prometidoEn;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [snapshot.trabajosLab.filter((t) => t.retrasoHoras !== null).length, "Vencidos", "text-late"],
          [
            snapshot.trabajosLab.filter(
              (t) =>
                t.retrasoHoras === null &&
                t.estado !== "entregado" &&
                t.estado !== "recibido" &&
                t.prometidoEn - snapshot.ahora > 0 &&
                t.prometidoEn - snapshot.ahora < 24 * 3_600_000,
            ).length,
            "Vencen en 24 h",
            "text-wait-text",
          ],
          [snapshot.trabajosLab.filter((t) => t.estado === "en_proceso").length, "En proceso", "text-ink-2"],
          [snapshot.trabajosLab.filter((t) => t.estado === "recibido" || t.estado === "entregado").length, "Cerrados", "text-ok-text"],
        ].map(([valor, etiqueta, color]) => (
          <div key={String(etiqueta)} className="rounded-xl border border-line bg-panel px-4 py-3">
            <div className={`tabular display text-[24px] font-bold tracking-[-0.02em] ${color}`}>{valor}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{etiqueta}</div>
          </div>
        ))}
      </div>

      {/* tabla de seguimiento */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Trabajos en seguimiento</h2>
          <span className="tabular ml-auto text-[12.5px] text-ink-3">{trabajos.length} trabajos</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-left">
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Paciente</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Trabajo</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Laboratorio</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Enviado</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Prometido</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Estado</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Responsable</th>
                <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {trabajos.map((t) => {
                const est = ESTADO_LABEL[t.estado] ?? { etiqueta: t.estado, clase: "text-ink-3 bg-panel-3" };
                const vencePronto =
                  t.retrasoHoras === null &&
                  t.estado !== "entregado" &&
                  t.estado !== "recibido" &&
                  t.prometidoEn - snapshot.ahora > 0 &&
                  t.prometidoEn - snapshot.ahora < 24 * 3_600_000;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-line transition last:border-b-0 hover:bg-panel-2 ${
                      t.retrasoHoras !== null ? "bg-late-soft/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">{t.paciente}</td>
                    <td className="px-4 py-2.5 text-ink-2">{t.tratamiento.toLowerCase()}</td>
                    <td className="px-4 py-2.5 text-ink-2">{t.laboratorio}</td>
                    <td className="tabular px-4 py-2.5 text-ink-3">{fechaCorta(t.enviadoEn)} {hhmm(t.enviadoEn)}</td>
                    <td className="tabular px-4 py-2.5">
                      <span className={t.retrasoHoras !== null ? "font-semibold text-late" : "text-ink-2"}>
                        {fechaCorta(t.prometidoEn)} {hhmm(t.prometidoEn)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${est.clase}`}>
                        {est.etiqueta}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{t.responsable}</td>
                    <td className="px-4 py-2.5">
                      {t.retrasoHoras !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-late px-2 py-0.5 text-[11px] font-semibold text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          {Math.round(t.retrasoHoras)} h de retraso
                        </span>
                      ) : vencePronto ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wait-soft px-2 py-0.5 text-[11px] font-semibold text-wait-text">
                          <span className="h-1.5 w-1.5 rounded-full bg-wait" />
                          Por vencer
                        </span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11.5px] text-ink-4">
        Seguimiento operativo de laboratorios. Los plazos y responsables son datos ficticios de demostración.
      </p>
    </div>
  );
}
