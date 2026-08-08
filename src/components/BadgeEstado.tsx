import type { AppointmentStatus } from "@/domain/engine";

/**
 * Badge de estado de cita.
 *
 * Un único lugar donde se decide color y etiqueta de cada estado. Así los
 * estados reconocibles (confirmado, pendiente, riesgo, cancelado, recuperado)
 * se ven igual en toda la interfaz y nunca se mezclan con el acento azul.
 */

const ESTADO: Record<
  AppointmentStatus,
  { etiqueta: string; clase: string; punto: string }
> = {
  scheduled: { etiqueta: "Programada", clase: "text-ink-3 bg-panel-3", punto: "bg-line-3" },
  reminded: { etiqueta: "Pendiente", clase: "text-wait-text bg-wait-soft", punto: "bg-wait" },
  confirmed: { etiqueta: "Confirmada", clase: "text-ok-text bg-ok-soft", punto: "bg-ok" },
  reschedule_requested: { etiqueta: "Reprogramación", clase: "text-wait-text bg-wait-soft", punto: "bg-wait" },
  no_response: { etiqueta: "Sin respuesta", clase: "text-late bg-late-soft", punto: "bg-late" },
  completed: { etiqueta: "Atendida", clase: "text-ink-3 bg-panel-3", punto: "bg-line-3" },
  no_show: { etiqueta: "Ausencia", clase: "text-late bg-late-soft", punto: "bg-late" },
  cancelled: { etiqueta: "Cancelada", clase: "text-ink-3 bg-cancel-soft", punto: "bg-cancel" },
  recovered: { etiqueta: "Recuperada", clase: "text-azul-text bg-azul-soft", punto: "bg-azul" },
};

export function BadgeEstado({ status, size = "sm" }: { status: AppointmentStatus; size?: "sm" | "xs" }) {
  const e = ESTADO[status];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad} ${e.clase}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} />
      {e.etiqueta}
    </span>
  );
}

export function etiquetaEstado(status: AppointmentStatus): string {
  return ESTADO[status].etiqueta;
}
