import { useCallback, useEffect, useState } from "react";
import { useOdonto } from "@/store/OdontoStore";
import type { Carril } from "@/runtime/snapshot";
import type { UserEventKind } from "@/domain/tipos";
import { Timeline } from "./Timeline";
import { VistaIngresos } from "./VistaIngresos";
import { VistaFlujo } from "./VistaFlujo";
import { VistaPendientes } from "./VistaPendientes";
import { VistaReglas } from "./VistaReglas";
import { Diente, Flujo, Ingresos, Pendientes, Reglas, Reloj } from "./Icons";
import { DIA3, hhmm, soles, useContador, usePulso, useSubida } from "./util";

/**
 * Estación de recepción.
 *
 * Chrome de aplicación, no página web: la ventana no hace scroll, la barra de
 * estado con los cuatro montos es persistente y solo cambia el área de trabajo.
 * En un sistema clínico el contexto no puede perderse al navegar.
 */

type Vista = "ingresos" | "flujo" | "pendientes" | "reglas";

const ORDEN: Vista[] = ["ingresos", "flujo", "pendientes", "reglas"];
const VISTAS_VALIDAS = new Set(ORDEN);

const FILTROS: Record<string, { etiqueta: string; carriles: Carril[] }> = {
  confirmada: { etiqueta: "confirmadas", carriles: ["confirmada"] },
  esperando: { etiqueta: "esperando respuesta", carriles: ["programada", "recordada"] },
  vencida: { etiqueta: "venció el plazo", carriles: ["vencida"] },
};

const vistaInicialDeUrl = (): Vista => {
  if (typeof window === "undefined") return "ingresos";
  const v = new URLSearchParams(window.location.search).get("vista");
  return v && VISTAS_VALIDAS.has(v as Vista) ? (v as Vista) : "ingresos";
};

function Metrica({
  rotulo,
  valor,
  nota,
  tono,
}: {
  rotulo: string;
  valor: number;
  nota: string;
  tono?: "ok" | "late";
}) {
  const animado = useContador(valor);
  return (
    <div className="min-w-0 border-r border-line px-3 py-2.5 last:border-r-0 sm:px-4">
      <div className="rotulo truncate text-[9px] text-ink-3">{rotulo}</div>
      <div
        className={`tabular text-[21px] leading-tight font-semibold tracking-[-0.045em] sm:text-[27px] ${
          tono === "ok" ? "text-ok" : tono === "late" ? "text-late" : ""
        }`}
      >
        {soles(animado)}
      </div>
      <div className="truncate text-[10.5px] text-ink-3">{nota}</div>
    </div>
  );
}

export function Estacion() {
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

  const cola = snapshot.pendientes.length;
  const latido = useSubida(cola);
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
    },
    [registrarEvento],
  );

  const abrir = useCallback(
    (id: string) => {
      setSeleccion(id);
      irA("pendientes");
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

  // Atajos globales: T avanza un día, Escape sube un nivel.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        avanzar(24);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (seleccion) setSeleccion(null);
        else if (filtro) setFiltro(null);
        else irA("ingresos");
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [avanzar, filtro, irA, seleccion]);

  // El confirm de reiniciar se cancela solo si el usuario se arrepiente a tiempo.
  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 3200);
    return () => clearTimeout(t);
  }, [confirmando]);

  const enFoco = filtro ? FILTROS[filtro].carriles : null;
  const alcance = snapshot.citas.filter(
    (c) => c.activa && (!enFoco || enFoco.includes(c.carril)),
  );

  const nav: { clave: Vista; texto: string; Icono: typeof Ingresos; contador?: number }[] = [
    { clave: "ingresos", texto: "Ingresos", Icono: Ingresos, contador: snapshot.totales.citasVivas },
    { clave: "flujo", texto: "Flujo", Icono: Flujo, contador: snapshot.totales.citasVivas },
    { clave: "pendientes", texto: "Pendientes", Icono: Pendientes, contador: cola },
    { clave: "reglas", texto: "Reglas", Icono: Reglas },
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 overflow-x-hidden md:h-screen md:grid-cols-[198px_1fr]">
      {/* barra lateral */}
      <aside className="flex min-h-0 min-w-0 flex-row items-center gap-2 overflow-x-auto bg-dark text-[#e8efec] md:flex-col md:items-stretch md:gap-0 md:overflow-visible">
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e8efec] text-dark">
            <Diente size={14} />
          </span>
          <span className="min-w-0">
            <span className="rotulo block text-[12.5px] whitespace-nowrap">Odontoflow</span>
            <span className="block text-[10px] text-dim-2">San Borja</span>
          </span>
        </div>

        <nav className="flex gap-0.5 px-2 md:flex-col md:pt-1">
          <span className="rotulo hidden px-2 pt-2.5 pb-1.5 text-[9px] text-dim-2 md:block">Citas</span>
          {nav.map(({ clave, texto, Icono, contador }, i) => {
            const activo = vista === clave;
            const esCola = clave === "pendientes";
            return (
              <span key={clave} className="contents">
                {i === 3 && (
                  <span className="rotulo hidden px-2 pt-3 pb-1.5 text-[9px] text-dim-2 md:block">
                    Clínica
                  </span>
                )}
                <button
                  onClick={() => irA(clave)}
                  aria-current={activo ? "page" : undefined}
                  className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition ${
                    activo
                      ? "bg-dark-3 font-semibold text-white"
                      : "text-dim hover:bg-dark-2 hover:text-[#e8efec]"
                  }`}
                >
                  {activo && (
                    <span className="absolute top-1.5 -left-2 bottom-1.5 w-[2.5px] rounded-r-[2px] bg-ok-line" />
                  )}
                  <Icono className={activo ? "opacity-100" : "opacity-60"} />
                  {texto}
                  {contador !== undefined && contador > 0 && (
                    <span
                      className={`tabular ml-auto text-[11px] ${
                        esCola
                          ? `rounded-full bg-late px-1.5 text-white ${latido ? "anim-late" : ""}`
                          : activo
                            ? "text-ok-line"
                            : "text-dim-2"
                      }`}
                    >
                      {contador}
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </nav>

        <div className="ml-auto hidden flex-col gap-1.5 border-t border-dark-3 px-3.5 py-3 md:mt-auto md:ml-0 md:flex">
          <div className="flex items-baseline text-[11px] text-dim-2">
            Odontólogos
            <b className="tabular ml-auto font-semibold text-dim">{snapshot.clinica.odontologos}</b>
          </div>
          <div className="flex items-baseline text-[11px] text-dim-2">
            Pacientes
            <b className="tabular ml-auto font-semibold text-dim">{snapshot.clinica.pacientes}</b>
          </div>
          <div className="flex items-baseline text-[11px] text-dim-2">
            Mensajes del motor
            <b className="tabular ml-auto font-semibold text-dim">{snapshot.mensajes.length}</b>
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-ok-line">
            <i className="h-[5px] w-[5px] rounded-full bg-ok-line" />
            canal simulado
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-dim-2">
            <i className="h-[5px] w-[5px] rounded-full bg-dim-2" />
            respuestas simuladas
          </span>
        </div>
      </aside>

      {/* zona de trabajo */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-panel px-4 py-2 md:h-[50px] md:flex-nowrap md:py-0">
          <h1 className="display text-[15px] font-medium">
            {{
              ingresos: "Ingresos",
              flujo: "Flujo de confirmación",
              pendientes: "Pendientes",
              reglas: "Reglas",
            }[vista]}
          </h1>

          {filtro && vista !== "reglas" && (
            <span className="flex items-center gap-1.5 rounded-md border border-line-2 bg-panel-3 py-0.5 pr-1 pl-2.5 text-[11.5px] font-semibold">
              {FILTROS[filtro].etiqueta}
              <button
                onClick={() => setFiltro(null)}
                aria-label="Quitar filtro"
                className="tabular rounded px-1 text-ink-3 hover:bg-late-soft hover:text-late"
              >
                ✕
              </button>
            </span>
          )}

          {vista !== "reglas" && (
            <span className="tabular hidden text-[11.5px] text-ink-3 sm:inline">
              {alcance.length} citas · {soles(alcance.reduce((s, c) => s + c.soles, 0))}
            </span>
          )}

          <div className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:ml-auto md:w-auto md:overflow-visible md:px-0 md:pb-0 md:gap-2.5">
            <div className="flex items-center gap-2 border-r border-line pr-2.5">
              <Reloj className="text-ink-4" />
              <span className="leading-tight">
                <span
                  className={`tabular block text-[14px] font-semibold transition-colors duration-300 ${
                    pulso ? "text-ok" : ""
                  }`}
                >
                  {hhmm(nowMs)}
                </span>
                <span className="block text-[10.5px] text-ink-3">
                  {DIA3[new Date(nowMs).getDay()]} {new Date(nowMs).getDate()} ago
                </span>
              </span>
            </div>

            <div className="flex overflow-hidden rounded-md border border-line-2">
              {[1, 6].map((h) => (
                <button
                  key={h}
                  onClick={() => avanzar(h)}
                  className="border-r border-line px-2.5 py-1.5 text-[11.5px] text-ink-2 transition last:border-r-0 hover:bg-panel-3"
                >
                  +{h} h
                </button>
              ))}
            </div>

            <button
              onClick={() => avanzar(24)}
              className="flex items-center gap-2 rounded-md bg-dark px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-88"
            >
              Avanzar 24 h
              <kbd className="tabular rounded border border-white/35 px-1 text-[9.5px] opacity-60">T</kbd>
            </button>

            {confirmando ? (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setConfirmando(false);
                    setFiltro(null);
                    setSeleccion(null);
                    reiniciar();
                  }}
                  className="rounded-md border border-late bg-late-soft px-2.5 py-1.5 text-[11.5px] font-semibold text-late transition hover:bg-late hover:text-white"
                >
                  ¿Reiniciar?
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="rounded-md border border-line-2 bg-panel px-2 py-1.5 text-[11.5px] text-ink-3 hover:bg-panel-3"
                  aria-label="Cancelar reinicio"
                >
                  ✕
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmando(true)}
                className="rounded-md border border-line-2 bg-panel px-2.5 py-1.5 text-[11.5px] text-ink-2 transition hover:bg-panel-3"
              >
                Reiniciar
              </button>
            )}
          </div>
        </header>

        <Timeline snapshot={snapshot} onSeek={seek} pulso={pulso} />

        {/* barra de estado persistente */}
        <div className="grid shrink-0 grid-cols-2 border-b border-line bg-panel sm:grid-cols-2 lg:grid-cols-4">
          <Metrica
            rotulo="Agendado"
            valor={snapshot.totales.agendado}
            nota={`${snapshot.totales.citasVivas} citas vivas`}
          />
          <Metrica
            rotulo="Confirmado"
            valor={snapshot.totales.confirmado}
            nota={`${snapshot.totales.confirmadasSinLlamar} sin llamar a nadie`}
            tono="ok"
          />
          <Metrica
            rotulo="Esperando"
            valor={snapshot.totales.esperando}
            nota={`plazo de ${snapshot.reglas.alertAfterHours} h`}
          />
          <Metrica
            rotulo="Venció el plazo"
            valor={snapshot.totales.vencido}
            nota={cola ? `${cola} por decidir` : "nada pendiente"}
            tono="late"
          />
        </div>

        <main
          className={`min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3.5 ${
            direccion === "derecha" ? "anim-derecha" : "anim-izquierda"
          }`}
          key={vista}
        >
          {vista === "ingresos" && (
            <VistaIngresos snapshot={snapshot} onAbrir={abrir} onFiltrar={filtrar} />
          )}
          {vista === "flujo" && (
            <VistaFlujo snapshot={snapshot} filtro={enFoco} onAbrir={abrir} />
          )}
          {vista === "pendientes" && (
            <VistaPendientes
              snapshot={snapshot}
              seleccion={seleccion}
              onEvento={evento}
              onIrA={irA}
            />
          )}
          {vista === "reglas" && (
            <VistaReglas snapshot={snapshot} onGuardar={guardarReglas} />
          )}
        </main>
      </div>
    </div>
  );
}
