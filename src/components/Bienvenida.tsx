import { Diente, Doctores, Flujo, Laboratorio, Pacientes, Reloj } from "./Icons";

/**
 * Pantalla de inicio.
 *
 * En pocos segundos, el cliente tiene que entender qué es OdontoFlow: una
 * plataforma que toma los eventos de la clínica (una cita, una cancelación, una
 * falta de respuesta) y los convierte en acciones automáticas y tareas claras
 * para el equipo. Sin esto, la interfaz es un tablero sin contexto.
 */

const DOMINIOS = [
  { Icono: Reloj, titulo: "Centro de operaciones", texto: "Qué necesita atención hoy, priorizado." },
  { Icono: Flujo, titulo: "Agenda", texto: "Confirmaciones, reprogramaciones y recuperaciones en vivo." },
  { Icono: Pacientes, titulo: "Pacientes", texto: "Directorio con historial de inasistencias y lista de espera." },
  { Icono: Doctores, titulo: "Doctores", texto: "Disponibilidad por día e impacto de cancelaciones sobre su agenda." },
  { Icono: Laboratorio, titulo: "Laboratorios", texto: "Seguimiento de trabajos con alerta de retraso." },
] as const;

export function Bienvenida({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <div className="anim-arriba mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-azul text-white">
          <Diente size={22} />
        </span>
        <div>
          <div className="rotulo text-[12px] text-ink-3">OdontoFlow</div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Operaciones para clínicas dentales</div>
        </div>
      </div>

      <h1 className="display mt-9 leading-[1.05] tracking-[-0.03em]" style={{ fontSize: "clamp(32px,5.4vw,50px)" }}>
        Cada evento de la clínica
        <br />
        <span className="text-azul-text">se vuelve una acción automática.</span>
      </h1>
      <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-ink-2">
        OdontoFlow envía recordatorios, confirma citas y, cuando alguien cancela, ofrece el hueco a la
        lista de espera hasta recuperarlo. El equipo solo decide lo importante: el sistema hace el resto.
        Esta es una demostración con datos ficticios.
      </p>

      <h2 className="rotulo mt-9 text-[11px] text-ink-3">Qué vas a ver</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {DOMINIOS.map(({ Icono, titulo, texto }) => (
          <li key={titulo} className="flex gap-3 rounded-xl border border-line bg-panel px-3.5 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azul-soft text-azul-text">
              <Icono size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold tracking-[-0.01em]">{titulo}</div>
              <div className="text-[12.5px] leading-relaxed text-ink-3">{texto}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button
          onClick={onEmpezar}
          className="w-full rounded-xl bg-azul px-6 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90 sm:w-auto"
        >
          Iniciar demostración
        </button>
        <span className="text-[13px] text-ink-3">
          Las respuestas de los pacientes y las aceptaciones de la lista de espera están simuladas.
        </span>
      </div>
    </div>
  );
}
