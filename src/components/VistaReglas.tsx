"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/snapshot";

/**
 * Reglas del motor.
 *
 * Es el argumento de venta hecho pantalla: cambiar el recordatorio de 24 a 48
 * horas y ver cómo cambia toda la semana demuestra que es un producto que se
 * adapta a la clínica, no un video grabado.
 *
 * Validación en el momento de salir del campo, etiquetas siempre visibles y
 * errores que dicen qué hacer.
 */

type Campos = Snapshot["reglas"];

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
    ayuda: "Cuántas horas antes de la cita se avisa al paciente.",
    min: 1,
    max: 168,
    unidad: "horas antes",
  },
  {
    clave: "secondReminderHours",
    etiqueta: "Segundo recordatorio",
    ayuda: "Aviso final para quien no respondió al primero.",
    min: 0,
    max: 48,
    unidad: "horas antes",
  },
  {
    clave: "alertAfterHours",
    etiqueta: "Plazo de respuesta",
    ayuda: "Tiempo de espera antes de pedir que recepción intervenga.",
    min: 1,
    max: 72,
    unidad: "horas",
  },
  {
    clave: "clinicOpenHour",
    etiqueta: "Apertura",
    ayuda: "Hora en que la clínica empieza a atender.",
    min: 0,
    max: 23,
    unidad: "h",
  },
  {
    clave: "clinicCloseHour",
    etiqueta: "Cierre",
    ayuda: "Hora en que la clínica deja de atender.",
    min: 1,
    max: 24,
    unidad: "h",
  },
];

export function VistaReglas({
  snapshot,
  onGuardar,
  ocupado,
}: {
  snapshot: Snapshot;
  onGuardar: (valores: Campos) => void;
  ocupado: boolean;
}) {
  const [valores, setValores] = useState<Campos>(snapshot.reglas);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});

  const validar = (clave: keyof Campos, valor: number): string | null => {
    const def = CAMPOS.find((c) => c.clave === clave)!;
    if (Number.isNaN(valor)) return "Escribe un número.";
    if (valor < def.min || valor > def.max)
      return `Tiene que estar entre ${def.min} y ${def.max}.`;
    if (clave === "clinicCloseHour" && valor <= valores.clinicOpenHour)
      return "El cierre tiene que ser posterior a la apertura.";
    if (clave === "clinicOpenHour" && valor >= valores.clinicCloseHour)
      return "La apertura tiene que ser anterior al cierre.";
    if (clave === "secondReminderHours" && valor >= valores.firstReminderHours)
      return "El segundo aviso va más cerca de la cita que el primero.";
    return null;
  };

  const hayErrores = Object.values(errores).some(Boolean);
  const sinCambios = CAMPOS.every((c) => valores[c.clave] === snapshot.reglas[c.clave]);

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,520px)_1fr]">
      <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
        <header className="border-b border-line bg-panel-2 px-3 py-2.5">
          <h2 className="rotulo text-[10px] text-ink-2">Reglas del motor</h2>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {CAMPOS.map((campo) => (
            <div key={campo.clave}>
              <label
                htmlFor={campo.clave}
                className="block text-[12px] font-semibold tracking-[-0.01em]"
              >
                {campo.etiqueta}
              </label>
              <p className="mt-0.5 text-[11px] text-ink-3">{campo.ayuda}</p>
              <div className="mt-1.5 flex items-center gap-2">
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
                  className={`tabular w-24 rounded-md border px-2.5 py-1.5 text-[13px] ${
                    errores[campo.clave] ? "border-late bg-late-soft" : "border-line-2 bg-panel"
                  }`}
                />
                <span className="text-[11.5px] text-ink-3">{campo.unidad}</span>
              </div>
              {errores[campo.clave] && (
                <p className="mt-1 text-[11px] font-semibold text-late">{errores[campo.clave]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <button
            disabled={ocupado || hayErrores || sinCambios}
            onClick={() => onGuardar(valores)}
            className="rounded-md border border-dark bg-dark px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-88 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar reglas
          </button>
          <button
            disabled={ocupado || sinCambios}
            onClick={() => {
              setValores(snapshot.reglas);
              setErrores({});
            }}
            className="rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 transition hover:bg-panel-2 disabled:opacity-40"
          >
            Descartar
          </button>
          {!sinCambios && !hayErrores && (
            <span className="text-[11px] text-ink-3">
              Se recalcula toda la semana con las reglas nuevas.
            </span>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[9px] border border-line bg-panel">
        <header className="border-b border-line bg-panel-2 px-3 py-2.5">
          <h2 className="rotulo text-[10px] text-ink-2">Qué cambia</h2>
        </header>
        <div className="flex flex-col gap-3 p-4 text-[12px] leading-relaxed text-ink-2">
          <p>
            Con las reglas actuales, el paciente recibe su aviso{" "}
            <b className="font-semibold text-ink">
              {snapshot.reglas.firstReminderHours} horas antes
            </b>{" "}
            de la cita y recepción solo interviene si pasan{" "}
            <b className="font-semibold text-ink">{snapshot.reglas.alertAfterHours} horas</b> sin
            respuesta.
          </p>
          <p>
            Subir el primer recordatorio da más margen para rellenar el hueco, pero avisar
            demasiado pronto hace que el paciente lo olvide. Bajar el plazo de respuesta detecta
            antes los silencios y a la vez genera más avisos para el mostrador.
          </p>
          <p className="text-ink-3">
            Al guardar, la semana entera se vuelve a calcular desde el inicio con los nuevos
            parámetros, incluidas las respuestas que ya diste.
          </p>
        </div>
      </section>
    </div>
  );
}
