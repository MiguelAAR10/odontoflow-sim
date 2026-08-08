import type { PendienteVista, Snapshot } from "@/runtime/snapshot";
import type { UserEventKind } from "@/domain/tipos";
import { BadgeEstado } from "./BadgeEstado";
import { ActividadReciente } from "./ActividadReciente";
import { fechaCorta, hhmm, soles } from "./util";

/**
 * Centro de operaciones.
 *
 * Responde a la pregunta que abre cada jornada: «¿qué necesita atención hoy?».
 * Prioriza acciones, no métricas decorativas. Arriba va la cola de trabajo
 * (espacios recuperables, pacientes sin respuesta, reprogramaciones, cambios
 * que afectan agenda, labos próximos a vencer, acciones para recepción). Abajo,
 * como apoyo, métricas operativas compactas.
 */

const CLASE_LABEL: Record<PendienteVista["clase"], { etiqueta: string; color: string; punto: string }> = {
  sin_respuesta: { etiqueta: "Pacientes sin respuesta", color: "text-late", punto: "bg-late" },
  reprogramacion: { etiqueta: "Reprogramaciones", color: "text-wait-text", punto: "bg-wait" },
  hueco_libre: { etiqueta: "Espacios recuperables", color: "text-azul-text", punto: "bg-azul" },
  retraso_lab: { etiqueta: "Laboratorio", color: "text-late", punto: "bg-late" },
  cancelacion: { etiqueta: "Cancelaciones", color: "text-ink-3", punto: "bg-cancel" },
};

export function VistaOperacion({
  snapshot,
  onAbrir,
  onEvento,
  onIrA,
}: {
  snapshot: Snapshot;
  onAbrir: (id: string) => void;
  onEvento: (id: string, kind: UserEventKind) => void;
  onIrA: (vista: "agenda" | "laboratorios" | "actividad") => void;
}) {
  const ops = snapshot.operaciones;

  // Agrupado por clase para el resumen lateral.
  const porClase = (clase: PendienteVista["clase"]) => ops.filter((o) => o.clase === clase);
  const sinRespuesta = porClase("sin_respuesta").length;
  const reprogramaciones = porClase("reprogramacion").length;
  const huecos = porClase("hueco_libre").length;
  const labos = porClase("retraso_lab").length;

  const metricas = [
    { valor: snapshot.totales.confirmado, etiqueta: "Agenda confirmada", sub: `${snapshot.totales.confirmadasSinLlamar} citas`, tipo: "soles" as const },
    { valor: snapshot.totales.valorRecuperado, etiqueta: "Valor de agenda recuperada", sub: `${snapshot.totales.recuperado > 0 ? "recuperado hoy" : "sin recuperos aún"}`, tipo: "soles" as const },
    { valor: snapshot.totales.valorPendiente, etiqueta: "Valor de citas pendientes", sub: "sin confirmar todavía", tipo: "soles" as const },
    { valor: snapshot.totales.completadas, etiqueta: "Citas atendidas", sub: `${snapshot.totales.citasVivas} activas en agenda`, tipo: "numero" as const },
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_300px]">
      {/* cola de trabajo */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Cola de atención</h2>
          <span className="tabular ml-auto text-[12.5px] text-ink-3">
            {ops.length > 0 ? `${ops.length} acciones requieren atención` : "todo bajo control"}
          </span>
        </header>

        {ops.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="display text-[18px] font-semibold text-ok">No hay nada que requiera atención</p>
            <p className="mt-2 text-[13.5px] text-ink-3">
              Avance el reloj con «Avanzar 24 h» para que el sistema procese recordatorios y respuestas,
              o cancele una cita desde la Agenda para ver la recuperación en acción.
            </p>
            <button
              onClick={() => onIrA("agenda")}
              className="mt-4 rounded-lg bg-azul px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
            >
              Ir a la Agenda
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {ops.map((o) => {
              const c = snapshot.citas.find((x) => x.id === o.citaId);
              const esLab = o.clase === "retraso_lab";
              const meta = CLASE_LABEL[o.clase];
              const citaStatus = c?.status;
              return (
                <li key={`${o.clase}-${o.citaId}`} className="anim-cae flex items-center gap-3 px-4 py-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${meta.punto}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                        {o.motivo.split("·")[0].trim() || o.motivo}
                      </span>
                      {citaStatus && <BadgeEstado status={citaStatus} size="xs" />}
                    </div>
                    {c && (
                      <div className="tabular mt-0.5 truncate text-[12px] text-ink-3">
                        {fechaCorta(c.startsAt)} {hhmm(c.startsAt)} · {c.odontologo}
                        {c.soles > 0 && <> · {soles(c.soles)}</>}
                      </div>
                    )}
                    {esLab && (
                      <div className="tabular mt-0.5 text-[12px] text-ink-3">
                        Vence {fechaCorta(o.desde)} {hhmm(o.desde)}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {esLab ? (
                      <button
                        onClick={() => onIrA("laboratorios")}
                        className="rounded-lg border border-line-2 bg-panel px-3 py-1.5 text-[12px] text-ink-2 transition hover:bg-panel-3"
                      >
                        Ver
                      </button>
                    ) : c ? (
                      <>
                        {c.status === "cancelled" ? (
                          <button
                            onClick={() => onEvento(c.id, "recover_slot")}
                            className="rounded-lg bg-azul px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                          >
                            Recuperar
                          </button>
                        ) : c.status === "reschedule_requested" ? (
                          <button
                            onClick={() => onEvento(c.id, "patient_confirm")}
                            className="rounded-lg bg-ok px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                          >
                            Reagendar
                          </button>
                        ) : (
                          <button
                            onClick={() => onEvento(c.id, "patient_confirm")}
                            className="rounded-lg border border-ok-line bg-ok-soft px-3 py-1.5 text-[12px] font-semibold text-ok-text transition hover:bg-ok hover:text-white"
                          >
                            Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => onAbrir(c.id)}
                          className="rounded-lg border border-line-2 bg-panel px-2.5 py-1.5 text-[12px] text-ink-3 transition hover:bg-panel-3"
                          aria-label="Abrir conversación"
                        >
                          ↗
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* barra lateral: tipos de atención + métricas */}
      <div className="flex flex-col gap-4">
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="border-b border-line bg-panel-2 px-4 py-3">
            <h2 className="rotulo text-[11px] text-ink-2">Tipos de atención</h2>
          </header>
          <div className="flex flex-col p-2">
            {([
              ["hueco_libre", huecos, "Espacios recuperables"],
              ["sin_respuesta", sinRespuesta, "Pacientes sin respuesta"],
              ["reprogramacion", reprogramaciones, "Reprogramaciones pendientes"],
              ["retraso_lab", labos, "Laboratorios por vencer"],
            ] as const).map(([clase, n, label]) => {
              const meta = CLASE_LABEL[clase];
              return (
                <button
                  key={clase}
                  onClick={() => n > 0 && onIrA(clase === "retraso_lab" ? "laboratorios" : "agenda")}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-panel-2"
                  disabled={n === 0}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.punto}`} />
                  <span className="text-[13px] text-ink-2">{label}</span>
                  <span className={`tabular ml-auto text-[14px] font-semibold ${n > 0 ? meta.color : "text-ink-4"}`}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* métricas operativas, secundarias */}
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="border-b border-line bg-panel-2 px-4 py-3">
            <h2 className="rotulo text-[11px] text-ink-2">Estado operativo</h2>
          </header>
          <div className="grid grid-cols-2 gap-px bg-line">
            {metricas.map((m) => (
              <div key={m.etiqueta} className="bg-panel px-3.5 py-3">
                <div className="tabular display text-[20px] font-bold tracking-[-0.02em]">
                  {m.tipo === "soles" ? soles(m.valor) : m.valor}
                </div>
                <div className="mt-0.5 text-[11.5px] font-medium text-ink-2">{m.etiqueta}</div>
                <div className="text-[11px] text-ink-3">{m.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* feed de actividad compacto — la prueba de que el sistema trabaja */}
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
            <h2 className="rotulo text-[11px] text-ink-2">Actividad reciente</h2>
            <button
              onClick={() => onIrA("actividad")}
              className="ml-auto text-[11px] text-azul-text hover:underline"
            >
              ver todo
            </button>
          </header>
          <div className="max-h-[280px] overflow-y-auto">
            <ActividadReciente actividad={snapshot.actividad} limite={14} compacto />
          </div>
        </section>
      </div>
    </div>
  );
}
