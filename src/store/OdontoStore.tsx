import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Odontologo, Reglas, Tratamiento, UserEvent, UserEventKind } from "@/domain/tipos";
import type { ComportamientoConfig } from "@/domain/paciente-sim";
import type { ScenarioBehavior, ScenarioMetadata } from "@/domain/scenario";
import { validateScenario } from "@/domain/scenario";
import { applyScenarioOverrides, compileComportamiento, compileScenario, type ScenarioOverrides } from "@/domain/scenario-compiler";
import { DEFAULT_SCENARIO_ID, getScenario, listScenarios } from "@/domain/scenarios";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot, type Snapshot } from "@/runtime/snapshot";
import { siguienteEvento } from "@/runtime/siguiente-evento";
import { clampReloj, dentroDeHorario } from "@/runtime/horario";

/**
 * Estado de la clínica en el browser.
 *
 * No hay servidor ni base de datos: el reloj, las acciones del recepcionista y
 * las reglas viven acá. El mundo se reproduce desde cero (función pura) cada vez
 * que alguno de los tres cambia, y la interfaz solo lee el snapshot resultante.
 *
 * Se persiste en localStorage para que recargar no pierda el estado de la demo:
 * uno prepara la clínica en un punto, la enseña y al volver sigue ahí.
 */

const HOUR = 3_600_000;
const CLAVE = "odontoflow:v1";

/**
 * Resultado de un intento de edición de escenario (V2.2 — Scenario
 * Configuration). Nunca lanza: el llamador (la UI) decide qué mostrar ante
 * `ok: false`, igual que ya hacía `VistaReglas` con sus propios errores de
 * campo.
 */
export type ResultadoEdicion = { ok: true } | { ok: false; errores: string[] };

interface EventoSer {
  atMs: number;
  appointmentId: string;
  kind: UserEventKind;
  seq: number;
}

interface Estado {
  escenarioId: string;
  /** Reemplazo TOTAL por sección, nunca fusión parcial — ver ScenarioOverrides. */
  overrides: ScenarioOverrides;
  nowMs: number;
  eventos: EventoSer[];
  reglas: Reglas;
}

/**
 * La demo arranca 24 h adelantada dentro de la ventana del escenario: ya hay
 * citas confirmadas, rescatadas y vencidas, así la primera vista se ve viva en
 * vez de vacía. La línea de tiempo permite retroceder al inicio para ver el
 * estado incipiente.
 */
function inicioDe(escenarioId: string): { nowMs: number; reglas: Reglas } {
  const escenario = getScenario(escenarioId);
  return {
    nowMs: escenario.calendar.start.getTime() + 24 * HOUR,
    reglas: { ...escenario.rules },
  };
}

function estadoInicialDe(escenarioId: string): Estado {
  const { nowMs, reglas } = inicioDe(escenarioId);
  return { escenarioId, overrides: {}, nowMs, eventos: [], reglas };
}

const estadoInicial: Estado = estadoInicialDe(DEFAULT_SCENARIO_ID);

function cargar(): Estado {
  if (typeof localStorage === "undefined") return estadoInicial;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoInicial;
    const parsed = JSON.parse(crudo) as Partial<Estado>;
    const escenarioId = typeof parsed.escenarioId === "string" ? parsed.escenarioId : DEFAULT_SCENARIO_ID;
    const base = estadoInicialDe(escenarioId);
    return {
      escenarioId,
      overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
      nowMs: typeof parsed.nowMs === "number" ? parsed.nowMs : base.nowMs,
      eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
      reglas: { ...base.reglas, ...(parsed.reglas ?? {}) },
    };
  } catch {
    return estadoInicial;
  }
}

export interface OdontoAPI {
  snapshot: Snapshot;
  nowMs: number;
  /** sube con cada acción; sirve para disparar feedback visual (el latido del reloj) */
  version: number;
  /** próximo instante (ms) en que el mundo cambia, o null si no hay más eventos */
  proximoEventoMs: number | null;
  moverReloj: (ms: number) => void;
  avanzarHoras: (h: number) => void;
  irASiguienteEvento: () => void;
  registrarEvento: (citaId: string, kind: UserEventKind) => void;
  reiniciar: () => void;
  guardarReglas: (r: Reglas) => void;

  // --- V2.2 — Scenario Configuration ---
  escenarioId: string;
  escenarios: ScenarioMetadata[];
  comportamiento: ComportamientoConfig;
  doctores: Odontologo[];
  tratamientos: Tratamiento[];
  seleccionarEscenario: (id: string) => void;
  guardarComportamiento: (b: ScenarioBehavior) => ResultadoEdicion;
  guardarDoctores: (docs: Odontologo[]) => ResultadoEdicion;
  guardarTratamientos: (tts: Tratamiento[]) => ResultadoEdicion;
}

const Ctx = createContext<OdontoAPI | null>(null);

export function OdontoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(cargar);
  const [version, setVersion] = useState(0);

  // El escenario EFECTIVO: la definición con nombre + los overrides de edición
  // ya aplicados (reemplazo total por sección, ver ScenarioOverrides). Pura,
  // recalculada solo cuando cambia el id o los overrides — igual de barata que
  // el viejo `useMemo(catalogoBase, [])`, salvo que ahora depende de 2 cosas
  // en vez de ninguna.
  const escenarioEfectivo = useMemo(
    () => applyScenarioOverrides(getScenario(estado.escenarioId), estado.overrides),
    [estado.escenarioId, estado.overrides],
  );
  const cat = useMemo(() => compileScenario(escenarioEfectivo), [escenarioEfectivo]);
  const comportamiento = useMemo(() => compileComportamiento(escenarioEfectivo), [escenarioEfectivo]);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      /* almacenamiento lleno o bloqueado: la demo sigue sin persistir */
    }
  }, [estado]);

  const tocar = useCallback(() => setVersion((v) => v + 1), []);

  const moverReloj = useCallback(
    (ms: number) => {
      setEstado((e) => ({ ...e, nowMs: clampReloj(new Date(ms)).getTime() }));
      tocar();
    },
    [tocar],
  );

  const avanzarHoras = useCallback(
    (h: number) => {
      setEstado((e) => {
        const naive = new Date(e.nowMs + h * HOUR);
        const dentro = dentroDeHorario(naive, e.reglas.clinicOpenHour, e.reglas.clinicCloseHour);
        return { ...e, nowMs: clampReloj(dentro).getTime() };
      });
      tocar();
    },
    [tocar],
  );

  const irASiguienteEvento = useCallback(() => {
    setEstado((e) => {
      const eventosActuales: UserEvent[] = e.eventos.map((ev) => ({
        at: new Date(ev.atMs),
        appointmentId: ev.appointmentId,
        kind: ev.kind,
        seq: ev.seq,
      }));
      const prox = siguienteEvento(cat, eventosActuales, e.reglas, e.nowMs);
      if (prox === null) return e;
      return { ...e, nowMs: clampReloj(new Date(prox)).getTime() };
    });
    tocar();
  }, [cat, tocar]);

  const registrarEvento = useCallback(
    (citaId: string, kind: UserEventKind) => {
      setEstado((e) => ({
        ...e,
        eventos: [
          ...e.eventos,
          { atMs: e.nowMs, appointmentId: citaId, kind, seq: e.eventos.length },
        ],
      }));
      tocar();
    },
    [tocar],
  );

  const reiniciar = useCallback(() => {
    // Reinicia el reloj y los eventos al inicio del escenario ACTUAL — no
    // vuelve a `baseline` por sorpresa. Los overrides de edición (doctores,
    // tratamientos, comportamiento) se conservan: "Reiniciar" es "vuelve al
    // principio de la línea de tiempo", no "descarta mis cambios de config".
    setEstado((e) => {
      const { nowMs, reglas } = inicioDe(e.escenarioId);
      return { ...e, nowMs, eventos: [], reglas };
    });
    tocar();
  }, [tocar]);

  const guardarReglas = useCallback(
    (r: Reglas) => {
      setEstado((e) => ({ ...e, reglas: r }));
      tocar();
    },
    [tocar],
  );

  // --- V2.2 — Scenario Configuration ---

  const seleccionarEscenario = useCallback(
    (id: string) => {
      // Cambiar de escenario es el "edit" más grande posible: se valida
      // (getScenario ya cae a baseline ante un id desconocido, así que esto
      // nunca falla en la práctica) y se reconstruye el mundo desde cero,
      // exactamente como pide el brief: "reset/rebuild the simulated world
      // deterministically".
      const { nowMs, reglas } = inicioDe(id);
      setEstado({ escenarioId: id, overrides: {}, nowMs, eventos: [], reglas });
      tocar();
    },
    [tocar],
  );

  /** Fusiona un override, valida el escenario EFECTIVO resultante, y solo lo
   * guarda si es válido — el mismo patrón "deshabilitado hasta ser válido"
   * que ya usa `VistaReglas` para las reglas. */
  const intentarOverride = useCallback(
    (parcial: ScenarioOverrides): ResultadoEdicion => {
      const propuesto = applyScenarioOverrides(getScenario(estado.escenarioId), {
        ...estado.overrides,
        ...parcial,
      });
      const errores = validateScenario(propuesto);
      if (errores.length > 0) return { ok: false, errores };
      setEstado((e) => ({ ...e, overrides: { ...e.overrides, ...parcial } }));
      tocar();
      return { ok: true };
    },
    [estado.escenarioId, estado.overrides, tocar],
  );

  const guardarComportamiento = useCallback(
    (b: ScenarioBehavior) => intentarOverride({ behavior: b }),
    [intentarOverride],
  );
  const guardarDoctores = useCallback(
    (docs: Odontologo[]) => intentarOverride({ doctors: docs }),
    [intentarOverride],
  );
  const guardarTratamientos = useCallback(
    (tts: Tratamiento[]) => intentarOverride({ treatments: tts }),
    [intentarOverride],
  );

  const eventos: UserEvent[] = useMemo(
    () => estado.eventos.map((e) => ({ at: new Date(e.atMs), appointmentId: e.appointmentId, kind: e.kind, seq: e.seq })),
    [estado.eventos],
  );

  const mundo = useMemo(
    () => reproducir(cat, eventos, estado.reglas, new Date(estado.nowMs), comportamiento),
    [cat, eventos, estado.reglas, estado.nowMs, comportamiento],
  );

  const snapshot = useMemo(() => buildSnapshot(mundo, cat, estado.reglas), [mundo, cat, estado.reglas]);

  const proximoEventoMs = useMemo(
    () => siguienteEvento(cat, eventos, estado.reglas, estado.nowMs),
    [cat, eventos, estado.reglas, estado.nowMs],
  );

  const escenarios = useMemo(() => listScenarios().map((s) => s.metadata), []);

  const api: OdontoAPI = {
    snapshot,
    nowMs: estado.nowMs,
    version,
    proximoEventoMs,
    moverReloj,
    avanzarHoras,
    irASiguienteEvento,
    registrarEvento,
    reiniciar,
    guardarReglas,

    escenarioId: estado.escenarioId,
    escenarios,
    comportamiento,
    doctores: cat.odontologos,
    tratamientos: cat.tratamientos,
    seleccionarEscenario,
    guardarComportamiento,
    guardarDoctores,
    guardarTratamientos,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOdonto(): OdontoAPI {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOdonto tiene que usarse dentro de <OdontoProvider>");
  return v;
}
