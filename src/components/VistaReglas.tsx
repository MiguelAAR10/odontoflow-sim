import { useEffect, useState } from "react";
import type { Reglas } from "@/domain/tipos";
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
}: {
  snapshot: Snapshot;
  onGuardar: (valores: Campos) => void;
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
  );
}
