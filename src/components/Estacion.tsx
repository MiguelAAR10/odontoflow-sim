import { useCallback, useEffect, useState } from "react";
import { useOdonto } from "@/store/OdontoStore";
import type { UserEventKind } from "@/domain/tipos";
import { Timeline } from "./Timeline";
import { VistaOperacion } from "./VistaOperacion";
import { VistaAgenda } from "./VistaAgenda";
import { VistaPacientes } from "./VistaPacientes";
import { VistaDoctores } from "./VistaDoctores";
import { VistaLaboratorios } from "./VistaLaboratorios";
import { VistaActividad } from "./VistaActividad";
import { VistaReglas } from "./VistaReglas";
import { Toast } from "./Toast";
import {
  Actividad as IconoActividad,
  Diente,
  Doctores,
  Flujo,
  Ingresos,
  Laboratorio,
  Pacientes,
  Reglas,
  Reloj,
} from "./Icons";
import { DIA3, hhmm, usePulso } from "./util";

/**
 * Estación de recepción.
 *
 * Shell de aplicación: barra superior carbón con navegación por dominios
 * (Operación, Agenda, Pacientes, Doctores, Laboratorios) y controles de tiempo
 * persistentes. La navegación se basa en dominios, no en herramientas.
 */

type Vista = "operacion" | "agenda" | "actividad" | "pacientes" | "doctores" | "laboratorios" | "config";

const ORDEN: Vista[] = ["operacion", "agenda", "actividad", "pacientes", "doctores", "laboratorios", "config"];
const VISTAS_VALIDAS = new Set(ORDEN);

const MENSAJE_EVENTO: Record<UserEventKind, string> = {
  apply_suggestion: "Acción registrada",
  snooze: "Cita pospuesta",
  patient_confirm: "Confirmación registrada",
  patient_reschedule: "Reagendamiento registrado",
  patient_cancel: "Cancelación registrada · espacio liberado",
  offer_waitlist: "Oferta enviada a la lista de espera",
  recover_slot: "Cita recuperada desde la lista de espera",
};

const vistaInicialDeUrl = (): Vista => {
  if (typeof window === "undefined") return "operacion";
  const v = new URLSearchParams(window.location.search).get("vista");
  return v && VISTAS_VALIDAS.has(v as Vista) ? (v as Vista) : "operacion";
};

export function Estacion({ onSalir }: { onSalir: () => void }) {
  const {
    snapshot,
    nowMs,
    version,
    proximoEventoMs,
    moverReloj,
    avanzarHoras,
    irASiguienteEvento,
    registrarEvento,
    reiniciar,
    guardarReglas,
  } = useOdonto();

  const [vista, setVista] = useState<Vista>(vistaInicialDeUrl);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<"derecha" | "izquierda">("derecha");
  const [confirmando, setConfirmando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cola = snapshot.operaciones.length;
  const pulso = usePulso(version);

  const irA = useCallback(
    (destino: Vista) => {
      setDireccion(ORDEN.indexOf(destino) >= ORDEN.indexOf(vista) ? "derecha" : "izquierda");
      setVista(destino);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("vista", destino);
        window.history.replaceState(null, "", url);
      }
    },
    [vista],
  );

  const seek = useCallback((ms: number) => moverReloj(Math.round(ms)), [moverReloj]);
  const avanzar = useCallback((h: number) => avanzarHoras(h), [avanzarHoras]);
  const siguienteEv = useCallback(() => irASiguienteEvento(), [irASiguienteEvento]);

  const evento = useCallback(
    (id: string, kind: UserEventKind) => {
      setSeleccion(null);
      registrarEvento(id, kind);
      setToast(MENSAJE_EVENTO[kind]);
    },
    [registrarEvento],
  );

  const abrir = useCallback(
    (id: string) => {
      setSeleccion(id);
    },
    [],
  );

  const guardarConToast = useCallback(
    (r: Parameters<typeof guardarReglas>[0]) => {
      guardarReglas(r);
      setToast("Parámetros guardados");
    },
    [guardarReglas],
  );

  // Atajos: T avanza un día, 1-6 navega dominios, Escape limpia selección.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        avanzar(24);
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        siguienteEv();
      }
      const navIndex = ["1", "2", "3", "4", "5", "6", "7"].indexOf(e.key);
      if (navIndex >= 0) {
        e.preventDefault();
        irA(ORDEN[navIndex]);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (seleccion) setSeleccion(null);
        else irA("operacion");
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [avanzar, siguienteEv, irA, seleccion]);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 3400);
    return () => clearTimeout(t);
  }, [confirmando]);

  const nav: { clave: Vista; texto: string; textoCorto: string; Icono: typeof Ingresos; contador?: number }[] = [
    { clave: "operacion", texto: "Operación", textoCorto: "Operación", Icono: Ingresos, contador: cola },
    { clave: "agenda", texto: "Agenda", textoCorto: "Agenda", Icono: Flujo },
    { clave: "actividad", texto: "Actividad", textoCorto: "Actividad", Icono: IconoActividad },
    { clave: "pacientes", texto: "Pacientes", textoCorto: "Pacientes", Icono: Pacientes },
    { clave: "doctores", texto: "Doctores", textoCorto: "Doctores", Icono: Doctores },
    { clave: "laboratorios", texto: "Laboratorios", textoCorto: "Labos", Icono: Laboratorio },
    { clave: "config", texto: "Configuración", textoCorto: "Ajustes", Icono: Reglas },
  ];

  const titulos: Record<Vista, string> = {
    operacion: "Centro de operaciones",
    agenda: "Agenda de citas",
    actividad: "Registro de actividad",
    pacientes: "Pacientes",
    doctores: "Doctores",
    laboratorios: "Laboratorios",
    config: "Configuración del sistema",
  };

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:overflow-hidden">
      {/* barra superior — carbón */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-dark-3 bg-dark text-[#e8efec]">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <button
            onClick={onSalir}
            className="flex shrink-0 items-center gap-2.5 text-left transition hover:opacity-80"
            aria-label="Volver al inicio"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-azul text-white">
              <Diente size={16} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="rotulo block text-[10px] leading-none text-dim">OdontoFlow</span>
              <span className="block text-[12.5px] font-semibold tracking-[-0.01em]">Clínica San Borja</span>
            </span>
          </button>

          <nav className="mx-auto flex items-center gap-0.5 overflow-x-auto rounded-xl bg-dark-2 p-1 sm:gap-1">
            {nav.map(({ clave, texto, textoCorto, Icono, contador }) => {
              const activo = vista === clave;
              return (
                <button
                  key={clave}
                  onClick={() => irA(clave)}
                  aria-current={activo ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition sm:px-3 ${
                    activo
                      ? "bg-azul text-white"
                      : "text-dim hover:text-[#e8efec] hover:bg-dark-3"
                  }`}
                >
                  <Icono className={activo ? "opacity-100" : "opacity-80"} size={15} />
                  <span className="hidden md:inline">{texto}</span>
                  <span className="md:hidden">{textoCorto}</span>
                  {contador !== undefined && contador > 0 && (
                    <span className="tabular rounded-full bg-late px-1.5 text-[11px] font-semibold text-white">
                      {contador}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5 border-l border-dark-3 pl-3">
            <Reloj className="text-dim" />
            <span className="leading-tight">
              <span
                className={`tabular block text-[14px] font-semibold transition-colors duration-300 ${
                  pulso ? "text-ok" : ""
                }`}
              >
                {hhmm(nowMs)}
              </span>
              <span className="block text-[11px] text-dim">
                {DIA3[new Date(nowMs).getDay()]} {new Date(nowMs).getDate()} ago
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* controles de tiempo */}
      <div className="sticky top-[57px] z-10 shrink-0 border-b border-line bg-panel-2/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <button
            onClick={siguienteEv}
            disabled={proximoEventoMs === null}
            className="flex items-center gap-2 rounded-lg bg-azul px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            title="Saltar al próximo instante en que el sistema hace algo (recordatorio, respuesta, alerta, recuperación)"
          >
            Siguiente evento
            <kbd className="tabular rounded border border-white/30 px-1 text-[10px] opacity-70">E</kbd>
          </button>
          <div className="flex overflow-hidden rounded-lg border border-line-2 bg-panel">
            {[1, 6].map((h) => (
              <button
                key={h}
                onClick={() => avanzar(h)}
                className="border-r border-line px-3 py-2 text-[12.5px] text-ink-2 transition last:border-r-0 hover:bg-panel-3"
              >
                +{h} h
              </button>
            ))}
          </div>
          <button
            onClick={() => avanzar(24)}
            className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[12.5px] font-medium text-ink-2 transition hover:bg-panel-3"
          >
            +24 h
            <kbd className="tabular rounded border border-line-3 px-1 text-[10px] opacity-70">T</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {confirmando ? (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setConfirmando(false);
                    setSeleccion(null);
                    reiniciar();
                    setToast("Simulación reiniciada");
                  }}
                  className="rounded-lg border border-late bg-late-soft px-3 py-2 text-[12.5px] font-semibold text-late transition hover:bg-late hover:text-white"
                >
                  ¿Reiniciar simulación?
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="rounded-lg border border-line-2 bg-panel px-2 py-2 text-[12.5px] text-ink-3 hover:bg-panel-3"
                  aria-label="Cancelar reinicio"
                >
                  ✕
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmando(true)}
                className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-[12.5px] text-ink-2 transition hover:bg-panel-3"
              >
                Reiniciar
              </button>
            )}
          </div>
        </div>
        <Timeline snapshot={snapshot} onSeek={seek} pulso={pulso} />
      </div>

      {/* área de trabajo */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h1 className="display text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">
              {titulos[vista]}
            </h1>
          </div>
          <div key={vista} className={direccion === "derecha" ? "anim-derecha" : "anim-izquierda"}>
            {vista === "operacion" && (
              <VistaOperacion snapshot={snapshot} onAbrir={abrir} onEvento={evento} onIrA={irA} />
            )}
            {vista === "agenda" && (
              <VistaAgenda snapshot={snapshot} seleccion={seleccion} onAbrir={abrir} onEvento={evento} />
            )}
            {vista === "actividad" && <VistaActividad snapshot={snapshot} />}
            {vista === "pacientes" && <VistaPacientes snapshot={snapshot} />}
            {vista === "doctores" && <VistaDoctores snapshot={snapshot} onAbrir={abrir} />}
            {vista === "laboratorios" && <VistaLaboratorios snapshot={snapshot} />}
            {vista === "config" && <VistaReglas snapshot={snapshot} onGuardar={guardarConToast} />}
          </div>
        </div>
      </main>

      <Toast mensaje={toast} onCerrar={() => setToast(null)} />
    </div>
  );
}
