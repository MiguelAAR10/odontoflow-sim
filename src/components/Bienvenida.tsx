import { catalogoBase } from "@/domain/seed";
import { Diente, Reloj, Pendientes, Flujo } from "./Icons";

/**
 * Pantalla de inicio.
 *
 * Antes de mostrar el panel, explica qué resuelve OdontoFlow, qué va a hacer
 * quien lo use y la escala de la clínica. Sin esto, la interfaz es un tablero
 * sin contexto.
 */

const cat = catalogoBase();

const STATS = [
  [cat.citas.length, "citas"],
  [cat.pacientes.length, "pacientes"],
  [cat.odontologos.length, "odontólogos"],
  [cat.tratamientos.length, "tratamientos"],
] as const;

function Paso({ n, titulo, texto, Icono }: { n: number; titulo: string; texto: string; Icono: typeof Reloj }) {
  return (
    <li className="flex gap-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-panel text-ok-text">
        <Icono size={17} />
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="rotulo text-[11px] text-ink-3">Paso {n}</div>
        <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em]">{titulo}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{texto}</p>
      </div>
    </li>
  );
}

export function Bienvenida({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <div className="anim-arriba mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-dark text-[#e8efec]">
          <Diente size={22} />
        </span>
        <div>
          <div className="rotulo text-[12px] text-ink-3">OdontoFlow</div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Clínica Dental San Borja</div>
        </div>
      </div>

      <h1 className="display mt-9 leading-[1.05] tracking-[-0.03em]" style={{ fontSize: "clamp(32px,5.4vw,50px)" }}>
        Las citas se confirman solas.
        <br />
        <span className="text-ink-3">Usted solo decide lo importante.</span>
      </h1>
      <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-ink-2">
        El sistema envía recordatorios, confirma a los pacientes y avisa únicamente cuando una
        cita entra en riesgo. Esta es una demostración con datos de prueba.
      </p>

      <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {STATS.map(([valor, etiqueta]) => (
          <div key={etiqueta} className="bg-panel px-4 py-3">
            <dt className="rotulo text-[10px] text-ink-3">{etiqueta}</dt>
            <dd className="tabular display mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-ink">{valor}</dd>
          </div>
        ))}
      </dl>

      <ol className="mt-9 flex flex-col gap-5">
        <Paso
          n={1}
          titulo="Avance el reloj"
          texto="Pulse «Avanzar 24 h» y el sistema procesa los recordatorios y respuestas de la jornada."
          Icono={Reloj}
        />
        <Paso
          n={2}
          titulo="Observe los resultados"
          texto="Las citas se confirman o entran en riesgo según el historial de cada paciente. El monto en riesgo indica cuánto puede perderse."
          Icono={Flujo}
        />
        <Paso
          n={3}
          titulo="Resuelva las acciones pendientes"
          texto="Cuando una cita vence o el paciente pide reagendar, el sistema propone una acción concreta."
          Icono={Pendientes}
        />
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          onClick={onEmpezar}
          className="w-full rounded-xl bg-dark px-6 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90 sm:w-auto"
        >
          Iniciar demostración
        </button>
        <span className="text-[13px] text-ink-3">
          Las respuestas de los pacientes están simuladas.
        </span>
      </div>
    </div>
  );
}
