import type { Snapshot } from "@/runtime/snapshot";
import { fechaCorta, hhmm } from "./util";

/**
 * Directorio de pacientes.
 *
 * Tabla, no tarjetas: es operativo, alguien busca un nombre o un teléfono.
 * Muestra la próxima cita, el historial de inasistencias (que alimenta el
 * cálculo de riesgo) y si el paciente está en lista de espera.
 */

export function VistaPacientes({ snapshot }: { snapshot: Snapshot }) {
  const pac = snapshot.pacientes;
  const hoy = snapshot.ahora;

  const ordenados = [...pac].sort((a, b) => {
    // primero los que tienen próxima cita más cercana
    const ta = a.proximaCita?.startsAt ?? Infinity;
    const tb = b.proximaCita?.startsAt ?? Infinity;
    if (ta !== tb) return ta - tb;
    return a.fullName.localeCompare(b.fullName);
  });

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Pacientes</h2>
        <span className="tabular ml-auto text-[12.5px] text-ink-3">
          {pac.length} registrados · {snapshot.listaEspera.length} en lista de espera
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line bg-panel-2 text-left">
              <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Paciente</th>
              <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Teléfono</th>
              <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Próxima cita</th>
              <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Inasistencias</th>
              <th className="rotulo px-4 py-2.5 text-[10px] font-semibold text-ink-3">Lista de espera</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((p) => {
              const proximaFutura = p.proximaCita && p.proximaCita.startsAt >= hoy;
              return (
                <tr key={p.id} className="border-b border-line transition last:border-b-0 hover:bg-panel-2">
                  <td className="px-4 py-2.5 font-medium text-ink">{p.fullName}</td>
                  <td className="tabular px-4 py-2.5 text-ink-2">{p.phone}</td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {proximaFutura ? (
                      <span>
                        {p.proximaCita!.tratamiento.toLowerCase()} ·{" "}
                        <span className="tabular">
                          {fechaCorta(p.proximaCita!.startsAt)} {hhmm(p.proximaCita!.startsAt)}
                        </span>{" "}
                        · {p.proximaCita!.odontologo}
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="tabular px-4 py-2.5">
                    {p.inasistenciasPrevias > 0 ? (
                      <span className="font-semibold text-late">{p.inasistenciasPrevias}</span>
                    ) : (
                      <span className="text-ink-4">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.enListaEspera ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-azul-soft px-2 py-0.5 text-[11px] font-semibold text-azul-text">
                        <span className="h-1.5 w-1.5 rounded-full bg-azul" />
                        En lista
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
  );
}
