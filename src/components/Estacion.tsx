import { useCallback, useEffect, useState } from "react";
import { useOdonto } from "@/store/OdontoStore";
import type { Carril } from "@/runtime/snapshot";
import type { UserEventKind } from "@/domain/tipos";
import { Timeline } from "./Timeline";
import { VistaIngresos } from "./VistaIngresos";
import { VistaFlujo } from "./VistaFlujo";
import { VistaPendientes } from "./VistaPendientes";
import { VistaReglas } from "./VistaReglas";
import { Toast } from "./Toast";
import { Diente, Flujo, Ingresos, Pendientes, Reglas, Reloj } from "./Icons";
import { DIA3, hhmm, usePulso } from "./util";

/**
 * Estación de recepción.
 *
 * Shell de aplicación: barra superior con navegación (sticky) y controles de
 * tiempo (sticky); debajo, la línea de tiempo y el área de trabajo. Cada vista
 * explica por sí sola qué hacer en ella. Un toast confirma cada acción.
 */

type Vista = "resumen" | "flujo" | "acciones" | "config";

const ORDEN: Vista[] = ["resumen", "flujo", "acciones", "config"];
const VISTAS_VALIDAS = new Set(ORDEN);

const FILTROS: Record<string, { etiqueta: string; carriles: Carril[] }> = {
  confirmada: { etiqueta: "confirmadas", carriles: ["confirmada"] },
  esperando: { etiqueta: "por confirmar", carriles: ["programada", "recordada"] },
  vencida: { etiqueta: "con plazo vencido", carriles: ["vencida"] },
};

const MENSAJE_EVENTO: Record<UserEventKind, string> = {
  apply_suggestion: "Acción registrada",
  snooze: "Cita pospuesta",
  patient_confirm: "Confirmación registrada",
  patient_reschedule: "Reagendamiento registrado",
};

const vistaInicialDeUrl = (): Vista => {
  if (typeof window === "undefined") return "resumen";
  const v = new URLSearchParams(window.location.search).get("vista");
  return v && VISTAS_VALIDAS.has(v as Vista) ? (v as Vista) : "resumen";
};

export function Estacion({ onSalir }: { onSalir: () => void }) {
  const {
    snapshot,
    nowMs,
    version,
    moverReloj,
    avanzarHoras,
    registrarEvento,
    reiniciar,
    guardarReglas,
  } = useOdonto();

  const [vista, setVista] = useState<Vista>(vistaInicialDeUrl);
  const [filtro, setFiltro] = useState<keyof typeof FILTROS | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<"derecha" | "izquierda">("derecha");
  const [confirmando, setConfirmando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cola = snapshot.pendientes.length;
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
      irA("acciones");
    },
    [irA],
  );

  const filtrar = useCallback(
    (seg: keyof typeof FILTROS) => {
      setFiltro(seg);
      irA("flujo");
    },
    [irA],
  );

  const guardarConToast = useCallback(
    (r: Parameters<typeof guardarReglas>[0]) => {
      guardarReglas(r);
      setToast("Parámetros guardados");
    },
    [guardarReglas],
  );

  // Atajos: T avanza un día, 1-4 navega, Escape sube de nivel.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        avanzar(24);
      }
      const navIndex = ["1", "2", "3", "4"].indexOf(e.key);
      if (navIndex >= 0) {
        e.preventDefault();
        irA(ORDEN[navIndex]);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (seleccion) setSeleccion(null);
        else if (filtro) setFiltro(null);
        else irA("resumen");
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [avanzar, filtro, irA, seleccion]);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 3400);
    return () => clearTimeout(t);
  }, [confirmando]);

  const enFoco = filtro ? FILTROS[filtro].carriles : null;

  const nav: { clave: Vista; texto: string; textoCorto: string; Icono: typeof Ingresos; contador?: number }[] = [
    { clave: "resumen", texto: "Resumen", textoCorto: "Resumen", Icono: Ingresos },
    { clave: "flujo", texto: "Flujo", textoCorto: "Flujo", Icono: Flujo },
    { clave: "acciones", texto: "Acciones", textoCorto: "Acción", Icono: Pendientes, contador: cola },
    { clave: "config", texto: "Configuración", textoCorto: "Ajustes", Icono: Reglas },
  ];

  const titulos: Record<Vista, string> = {
    resumen: "Resumen de la clínica",
    flujo: "Flujo de confirmación",
    acciones: "Acciones requeridas",
    config: "Configuración del sistema",
  };

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:overflow-hidden">
      {/* barra superior */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <button
            onClick={onSalir}
            className="flex shrink-0 items-center gap-2.5 text-left transition hover:opacity-80"
            aria-label="Volver al inicio"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-dark text-[#e8efec]">
              <Diente size={16} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="rotulo block text-[10px] leading-none text-ink-3">OdontoFlow</span>
              <span className="block text-[12.5px] font-semibold tracking-[-0.01em]">San Borja</span>
            </span>
          </button>

          <nav className="mx-auto flex items-center gap-0.5 overflow-x-auto rounded-xl bg-panel-2 p-1 sm:gap-1">
            {nav.map(({ clave, texto, textoCorto, Icono, contador }) => {
              const activo = vista === clave;
              return (
                <button
                  key={clave}
                  onClick={() => irA(clave)}
                  aria-current={activo ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition sm:px-3 ${
                    activo
                      ? "bg-panel text-ink shadow-sm"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  <Icono className={activo ? "opacity-100" : "opacity-70"} size={15} />
                  <span className="hidden sm:inline">{texto}</span>
                  <span className="sm:hidden">{textoCorto}</span>
                  {contador !== undefined && contador > 0 && (
                    <span className="tabular rounded-full bg-late px-1.5 text-[11px] font-semibold text-white">
                      {contador}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5 border-l border-line pl-3">
            <Reloj className="text-ink-4" />
            <span className="leading-tight">
              <span
                className={`tabular block text-[14px] font-semibold transition-colors duration-300 ${
                  pulso ? "text-ok-text" : ""
                }`}
              >
                {hhmm(nowMs)}
              </span>
              <span className="block text-[11px] text-ink-3">
                {DIA3[new Date(nowMs).getDay()]} {new Date(nowMs).getDate()} ago
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* controles de tiempo */}
      <div className="sticky top-[57px] z-10 shrink-0 border-b border-line bg-panel-2/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <button
            onClick={() => avanzar(24)}
            className="flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90"
          >
            Avanzar 24 h
            <kbd className="tabular rounded border border-white/30 px-1 text-[10px] opacity-70">T</kbd>
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

          {filtro && (
            <span className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel py-1 pr-1 pl-2.5 text-[12.5px] font-medium">
              Filtro: {FILTROS[filtro].etiqueta}
              <button
                onClick={() => setFiltro(null)}
                aria-label="Quitar filtro"
                className="tabular rounded px-1 text-ink-3 hover:bg-late-soft hover:text-late"
              >
                ✕
              </button>
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {confirmando ? (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setConfirmando(false);
                    setFiltro(null);
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
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <h1 className="display mb-5 text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">
            {titulos[vista]}
          </h1>
          <div key={vista} className={direccion === "derecha" ? "anim-derecha" : "anim-izquierda"}>
            {vista === "resumen" && (
              <VistaIngresos snapshot={snapshot} onAbrir={abrir} onFiltrar={filtrar} />
            )}
            {vista === "flujo" && (
              <VistaFlujo snapshot={snapshot} filtro={enFoco} onAbrir={abrir} />
            )}
            {vista === "acciones" && (
              <VistaPendientes
                snapshot={snapshot}
                seleccion={seleccion}
                onEvento={evento}
                onIrA={irA}
              />
            )}
            {vista === "config" && (
              <VistaReglas snapshot={snapshot} onGuardar={guardarConToast} />
            )}
          </div>
        </div>
      </main>

      <Toast mensaje={toast} onCerrar={() => setToast(null)} />
    </div>
  );
}
