import { useEffect, useState } from "react";
import type { DiaSemana, Odontologo, Reglas, Tratamiento } from "@/domain/tipos";
import type { ScenarioBehavior, ScenarioMetadata } from "@/domain/scenario";
import { silenceProbabilityOf } from "@/domain/scenario";
import type { ComportamientoConfig } from "@/domain/paciente-sim";
import type { ResultadoEdicion } from "@/store/OdontoStore";
import type { Snapshot } from "@/runtime/snapshot";

/**
 * Parámetros del sistema.
 *
 * Es el argumento de venta hecho pantalla: cambiar el recordatorio de 24 a 48
 * horas y ver cómo cambia toda la semana demuestra que es un sistema que se
 * adapta a la clínica.
 */

type Campos = Reglas;

const CAMPOS: {
  clave: keyof Campos;
  etiqueta: string;
  ayuda: string;
  min: number;
  max: number;
  unidad: string;
}[] = [
  {
    clave: "firstReminderHours",
    etiqueta: "Primer recordatorio",
    ayuda: "Horas antes de la cita en que se envía el primer aviso al paciente.",
    min: 1,
    max: 168,
    unidad: "horas antes",
  },
  {
    clave: "secondReminderHours",
    etiqueta: "Segundo recordatorio",
    ayuda: "Segundo aviso para quienes no respondieron al primero.",
    min: 0,
    max: 48,
    unidad: "horas antes",
  },
  {
    clave: "alertAfterHours",
    etiqueta: "Plazo de respuesta",
    ayuda: "Tiempo de espera antes de derivar el caso a recepción.",
    min: 1,
    max: 72,
    unidad: "horas",
  },
  {
    clave: "clinicOpenHour",
    etiqueta: "Hora de apertura",
    ayuda: "Inicio de la jornada de atención.",
    min: 0,
    max: 23,
    unidad: "h",
  },
  {
    clave: "clinicCloseHour",
    etiqueta: "Hora de cierre",
    ayuda: "Fin de la jornada de atención.",
    min: 1,
    max: 24,
    unidad: "h",
  },
];

export function VistaReglas({
  snapshot,
  onGuardar,
  escenarioId,
  escenarios,
  comportamiento,
  doctores,
  tratamientos,
  onSeleccionarEscenario,
  onGuardarComportamiento,
  onGuardarDoctores,
  onGuardarTratamientos,
}: {
  snapshot: Snapshot;
  onGuardar: (valores: Campos) => void;
  /** V2.2 — Scenario Configuration. */
  escenarioId: string;
  escenarios: ScenarioMetadata[];
  comportamiento: ComportamientoConfig;
  doctores: Odontologo[];
  tratamientos: Tratamiento[];
  onSeleccionarEscenario: (id: string) => void;
  onGuardarComportamiento: (b: ScenarioBehavior) => ResultadoEdicion;
  onGuardarDoctores: (docs: Odontologo[]) => ResultadoEdicion;
  onGuardarTratamientos: (tts: Tratamiento[]) => ResultadoEdicion;
}) {
  const [valores, setValores] = useState<Campos>(snapshot.reglas);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});

  useEffect(() => {
    setValores(snapshot.reglas);
    setErrores({});
  }, [snapshot.reglas]);

  const validar = (clave: keyof Campos, valor: number): string | null => {
    const def = CAMPOS.find((c) => c.clave === clave)!;
    if (Number.isNaN(valor)) return "Escriba un número válido.";
    if (valor < def.min || valor > def.max)
      return `Debe estar entre ${def.min} y ${def.max}.`;
    if (clave === "clinicCloseHour" && valor <= valores.clinicOpenHour)
      return "El cierre debe ser posterior a la apertura.";
    if (clave === "clinicOpenHour" && valor >= valores.clinicCloseHour)
      return "La apertura debe ser anterior al cierre.";
    if (clave === "secondReminderHours" && valor >= valores.firstReminderHours)
      return "El segundo aviso debe ir más cerca de la cita que el primero.";
    return null;
  };

  const hayErrores = Object.values(errores).some(Boolean);
  const sinCambios = CAMPOS.every((c) => valores[c.clave] === snapshot.reglas[c.clave]);

  return (
    <div className="flex flex-col gap-4">
      {/*
       * V2.2 — Scenario Configuration. Extiende esta misma pantalla de
       * configuración en vez de crear una segunda app de administración: la
       * selección de escenario y las secciones editables van ARRIBA de los
       * parámetros de siempre, que quedan intactos abajo.
       */}
      <SelectorEscenario escenarioId={escenarioId} escenarios={escenarios} onSeleccionar={onSeleccionarEscenario} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,540px)_1fr]">
        <SeccionComportamiento comportamiento={comportamiento} onGuardar={onGuardarComportamiento} />
        <SeccionDoctores doctores={doctores} onGuardar={onGuardarDoctores} />
      </div>

      <SeccionTratamientos tratamientos={tratamientos} onGuardar={onGuardarTratamientos} />

    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,540px)_1fr]">
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Parámetros del sistema</h2>
        </header>

        <div className="flex flex-col gap-5 p-5">
          {CAMPOS.map((campo) => (
            <div key={campo.clave}>
              <label htmlFor={campo.clave} className="block text-[14px] font-semibold tracking-[-0.01em]">
                {campo.etiqueta}
              </label>
              <p className="mt-0.5 text-[13px] text-ink-3">{campo.ayuda}</p>
              <div className="mt-2 flex items-center gap-2.5">
                <input
                  id={campo.clave}
                  type="number"
                  min={campo.min}
                  max={campo.max}
                  value={valores[campo.clave]}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [campo.clave]: Number(e.target.value) }))
                  }
                  onBlur={(e) => {
                    const err = validar(campo.clave, Number(e.target.value));
                    setErrores((x) => ({ ...x, [campo.clave]: err ?? undefined }));
                  }}
                  className={`tabular w-28 rounded-lg border px-3 py-2 text-[15px] outline-none focus:border-ok ${
                    errores[campo.clave] ? "border-late bg-late-soft" : "border-line-2 bg-panel"
                  }`}
                />
                <span className="text-[13px] text-ink-3">{campo.unidad}</span>
              </div>
              {errores[campo.clave] && (
                <p className="mt-1.5 text-[12.5px] font-semibold text-late">{errores[campo.clave]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-4">
          <button
            disabled={hayErrores || sinCambios}
            onClick={() => onGuardar(valores)}
            className="rounded-lg bg-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar cambios
          </button>
          <button
            disabled={sinCambios}
            onClick={() => {
              setValores(snapshot.reglas);
              setErrores({});
            }}
            className="rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 transition hover:bg-panel-2 disabled:opacity-40"
          >
            Descartar
          </button>
          {!sinCambios && !hayErrores && (
            <span className="text-[12.5px] text-ink-3">
              Se recalcula toda la semana con los nuevos parámetros.
            </span>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="rotulo text-[11px] text-ink-2">Efecto de los parámetros</h2>
        </header>
        <div className="flex flex-col gap-3.5 p-5 text-[13.5px] leading-relaxed text-ink-2">
          <p>
            Con la configuración actual, el paciente recibe el aviso{" "}
            <b className="font-semibold text-ink">{snapshot.reglas.firstReminderHours} horas antes</b>{" "}
            de la cita. Recepción interviene únicamente si pasan{" "}
            <b className="font-semibold text-ink">{snapshot.reglas.alertAfterHours} horas</b> sin
            respuesta.
          </p>
          <p>
            Aumentar el primer recordatorio da más margen para rellenar un hueco, pero avisar muy
            temprano hace que el paciente lo olvide. Reducir el plazo de respuesta detecta antes los
            silencios, pero genera más alertas para el mostrador.
          </p>
          <p className="text-ink-3">
            Al guardar, la semana completa se recalcula desde el inicio con los nuevos parámetros,
            incluyendo las acciones ya registradas.
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}

// ===========================================================================
// V2.2 — Scenario Configuration. Secciones nuevas, mismo patrón visual y de
// interacción que el panel de arriba: valores locales, validar, deshabilitar
// hasta que sea válido y haya cambios, botón de descartar.
// ===========================================================================

function SelectorEscenario({
  escenarioId,
  escenarios,
  onSeleccionar,
}: {
  escenarioId: string;
  escenarios: ScenarioMetadata[];
  onSeleccionar: (id: string) => void;
}) {
  const actual = escenarios.find((e) => e.id === escenarioId);
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Escenario</h2>
      </header>
      <div className="flex flex-col gap-2.5 p-5">
        <label htmlFor="escenario" className="block text-[14px] font-semibold tracking-[-0.01em]">
          Clínica sintética activa
        </label>
        <select
          id="escenario"
          value={escenarioId}
          onChange={(e) => onSeleccionar(e.target.value)}
          className="w-full max-w-md rounded-lg border border-line-2 bg-panel px-3 py-2.5 text-[14px] outline-none focus:border-ok sm:w-auto"
        >
          {escenarios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {actual && <p className="max-w-2xl text-[13px] text-ink-3">{actual.description}</p>}
        <p className="text-[12.5px] font-semibold text-late">
          Cambiar de escenario reconstruye la semana completa desde el inicio.
        </p>
      </div>
    </section>
  );
}

const PCT = (n: number) => Math.round(n * 100);

function SeccionComportamiento({
  comportamiento,
  onGuardar,
}: {
  comportamiento: ComportamientoConfig;
  onGuardar: (b: ScenarioBehavior) => ResultadoEdicion;
}) {
  const [confirma, setConfirma] = useState(PCT(comportamiento.confirmProbability));
  const [reprograma, setReprograma] = useState(PCT(comportamiento.rescheduleProbability));
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    setConfirma(PCT(comportamiento.confirmProbability));
    setReprograma(PCT(comportamiento.rescheduleProbability));
    setErrores([]);
  }, [comportamiento]);

  const silencio = silenceProbabilityOf({
    confirmProbability: confirma / 100,
    rescheduleProbability: reprograma / 100,
    previousNoShowInfluence: comportamiento.previousNoShowInfluence,
    scriptedRoles: comportamiento.scriptedRoles,
  });

  const invalido = confirma < 0 || reprograma < 0 || confirma + reprograma > 100;
  const sinCambios =
    confirma === PCT(comportamiento.confirmProbability) && reprograma === PCT(comportamiento.rescheduleProbability);

  const guardar = () => {
    const resultado = onGuardar({
      confirmProbability: confirma / 100,
      rescheduleProbability: reprograma / 100,
      previousNoShowInfluence: comportamiento.previousNoShowInfluence,
      scriptedRoles: comportamiento.scriptedRoles,
    });
    setErrores(resultado.ok ? [] : resultado.errores);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Comportamiento simulado de los pacientes</h2>
      </header>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-[12.5px] font-semibold text-late">
          SUPOSICIÓN sintética, no un dato medido — ver README.
        </p>
        <div>
          <label htmlFor="confirma" className="block text-[14px] font-semibold tracking-[-0.01em]">
            Confirma al recordatorio
          </label>
          <div className="mt-2 flex items-center gap-2.5">
            <input
              id="confirma"
              type="number"
              min={0}
              max={100}
              value={confirma}
              onChange={(e) => setConfirma(Number(e.target.value))}
              className="tabular w-24 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[15px] outline-none focus:border-ok"
            />
            <span className="text-[13px] text-ink-3">%</span>
          </div>
        </div>
        <div>
          <label htmlFor="reprograma" className="block text-[14px] font-semibold tracking-[-0.01em]">
            Pide otro horario
          </label>
          <div className="mt-2 flex items-center gap-2.5">
            <input
              id="reprograma"
              type="number"
              min={0}
              max={100}
              value={reprograma}
              onChange={(e) => setReprograma(Number(e.target.value))}
              className="tabular w-24 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[15px] outline-none focus:border-ok"
            />
            <span className="text-[13px] text-ink-3">%</span>
          </div>
        </div>
        <p className="text-[13px] text-ink-3">
          No responde (resto derivado):{" "}
          <b className={`tabular font-semibold ${invalido ? "text-late" : "text-ink"}`}>
            {invalido ? "—" : `${Math.round(silencio * 100)}%`}
          </b>
        </p>
        {invalido && (
          <p className="text-[12.5px] font-semibold text-late">
            Confirma + pide otro horario no puede superar 100%.
          </p>
        )}
        {errores.map((e) => (
          <p key={e} className="text-[12.5px] font-semibold text-late">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-4">
        <button
          disabled={invalido || sinCambios}
          onClick={guardar}
          className="rounded-lg bg-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar cambios
        </button>
        <button
          disabled={sinCambios}
          onClick={() => {
            setConfirma(PCT(comportamiento.confirmProbability));
            setReprograma(PCT(comportamiento.rescheduleProbability));
            setErrores([]);
          }}
          className="rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 transition hover:bg-panel-2 disabled:opacity-40"
        >
          Descartar
        </button>
      </div>
    </section>
  );
}

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const TODOS_LOS_DIAS: DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

function SeccionDoctores({
  doctores,
  onGuardar,
}: {
  doctores: Odontologo[];
  onGuardar: (docs: Odontologo[]) => ResultadoEdicion;
}) {
  const [edicion, setEdicion] = useState<Odontologo[]>(doctores);
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    setEdicion(doctores);
    setErrores([]);
  }, [doctores]);

  const sinCambios = JSON.stringify(edicion) === JSON.stringify(doctores);

  const actualizar = (id: string, cambios: Partial<Odontologo>) =>
    setEdicion((docs) => docs.map((d) => (d.id === id ? { ...d, ...cambios } : d)));

  const alternarDia = (id: string, dia: DiaSemana) =>
    setEdicion((docs) =>
      docs.map((d) =>
        d.id === id
          ? {
              ...d,
              diasAtiende: d.diasAtiende.includes(dia)
                ? d.diasAtiende.filter((x) => x !== dia)
                : [...d.diasAtiende, dia].sort(),
            }
          : d,
      ),
    );

  const guardar = () => {
    const resultado = onGuardar(edicion);
    setErrores(resultado.ok ? [] : resultado.errores);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Doctores</h2>
      </header>
      <div className="flex flex-col gap-5 p-5">
        {edicion.map((d) => (
          <div key={d.id} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
            <div className="flex flex-wrap gap-2.5">
              <input
                aria-label={`Nombre de ${d.id}`}
                value={d.fullName}
                onChange={(e) => actualizar(d.id, { fullName: e.target.value })}
                className="min-w-[180px] flex-1 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[14px] outline-none focus:border-ok"
              />
              <input
                aria-label={`Especialidad de ${d.id}`}
                value={d.specialty}
                onChange={(e) => actualizar(d.id, { specialty: e.target.value })}
                className="min-w-[160px] flex-1 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[14px] outline-none focus:border-ok"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TODOS_LOS_DIAS.map((dia) => (
                <label
                  key={dia}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition ${
                    d.diasAtiende.includes(dia)
                      ? "border-ok-line bg-ok-soft text-ok-text"
                      : "border-line-2 bg-panel text-ink-3"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={d.diasAtiende.includes(dia)}
                    onChange={() => alternarDia(d.id, dia)}
                  />
                  {DIAS_CORTO[dia]}
                </label>
              ))}
            </div>
            <p className="text-[12px] text-ink-3">Vacío = atiende todos los días hábiles de la clínica.</p>
          </div>
        ))}
        {errores.map((e) => (
          <p key={e} className="text-[12.5px] font-semibold text-late">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-4">
        <button
          disabled={sinCambios}
          onClick={guardar}
          className="rounded-lg bg-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar doctores
        </button>
        <button
          disabled={sinCambios}
          onClick={() => {
            setEdicion(doctores);
            setErrores([]);
          }}
          className="rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 transition hover:bg-panel-2 disabled:opacity-40"
        >
          Descartar
        </button>
      </div>
    </section>
  );
}

function SeccionTratamientos({
  tratamientos,
  onGuardar,
}: {
  tratamientos: Tratamiento[];
  onGuardar: (tts: Tratamiento[]) => ResultadoEdicion;
}) {
  const [edicion, setEdicion] = useState<Tratamiento[]>(tratamientos);
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    setEdicion(tratamientos);
    setErrores([]);
  }, [tratamientos]);

  const sinCambios = JSON.stringify(edicion) === JSON.stringify(tratamientos);

  const actualizar = (id: string, cambios: Partial<Tratamiento>) =>
    setEdicion((tts) => tts.map((t) => (t.id === id ? { ...t, ...cambios } : t)));

  const guardar = () => {
    const resultado = onGuardar(edicion);
    setErrores(resultado.ok ? [] : resultado.errores);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="border-b border-line bg-panel-2 px-4 py-3">
        <h2 className="rotulo text-[11px] text-ink-2">Tratamientos</h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-3">
              <th className="px-5 py-2.5 font-semibold">Nombre</th>
              <th className="px-5 py-2.5 font-semibold">Duración (min)</th>
              <th className="px-5 py-2.5 font-semibold">Precio sintético (S/)</th>
            </tr>
          </thead>
          <tbody>
            {edicion.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5">
                  <input
                    aria-label={`Nombre de ${t.id}`}
                    value={t.name}
                    onChange={(e) => actualizar(t.id, { name: e.target.value })}
                    className="w-full min-w-[140px] rounded-lg border border-line-2 bg-panel px-2.5 py-1.5 outline-none focus:border-ok"
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    aria-label={`Duración de ${t.id}`}
                    type="number"
                    min={1}
                    value={t.durationMin}
                    onChange={(e) => actualizar(t.id, { durationMin: Number(e.target.value) })}
                    className="tabular w-24 rounded-lg border border-line-2 bg-panel px-2.5 py-1.5 outline-none focus:border-ok"
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    aria-label={`Precio de ${t.id}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={(t.priceCents / 100).toFixed(2)}
                    onChange={(e) => actualizar(t.id, { priceCents: Math.round(Number(e.target.value) * 100) })}
                    className="tabular w-28 rounded-lg border border-line-2 bg-panel px-2.5 py-1.5 outline-none focus:border-ok"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 px-5 py-3">
        {errores.map((e) => (
          <p key={e} className="text-[12.5px] font-semibold text-late">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-4">
        <button
          disabled={sinCambios}
          onClick={guardar}
          className="rounded-lg bg-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar tratamientos
        </button>
        <button
          disabled={sinCambios}
          onClick={() => {
            setEdicion(tratamientos);
            setErrores([]);
          }}
          className="rounded-lg border border-line-2 bg-panel px-3.5 py-2.5 text-[13px] text-ink-2 transition hover:bg-panel-2 disabled:opacity-40"
        >
          Descartar
        </button>
      </div>
    </section>
  );
}
