import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { catalogoBase, DEMO_START, REGLAS_BASE } from "@/domain/seed";
import type { Reglas, UserEvent, UserEventKind } from "@/domain/tipos";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot, type Snapshot } from "@/runtime/snapshot";
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

interface EventoSer {
  atMs: number;
  appointmentId: string;
  kind: UserEventKind;
  seq: number;
}

interface Estado {
  nowMs: number;
  eventos: EventoSer[];
  reglas: Reglas;
}

const estadoInicial: Estado = {
  nowMs: DEMO_START.getTime(),
  eventos: [],
  reglas: { ...REGLAS_BASE },
};

function cargar(): Estado {
  if (typeof localStorage === "undefined") return estadoInicial;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoInicial;
    const parsed = JSON.parse(crudo) as Partial<Estado>;
    return {
      nowMs: typeof parsed.nowMs === "number" ? parsed.nowMs : estadoInicial.nowMs,
      eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
      reglas: { ...REGLAS_BASE, ...(parsed.reglas ?? {}) },
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
  moverReloj: (ms: number) => void;
  avanzarHoras: (h: number) => void;
  registrarEvento: (citaId: string, kind: UserEventKind) => void;
  reiniciar: () => void;
  guardarReglas: (r: Reglas) => void;
}

const Ctx = createContext<OdontoAPI | null>(null);

export function OdontoProvider({ children }: { children: ReactNode }) {
  const cat = useMemo(catalogoBase, []);
  const [estado, setEstado] = useState<Estado>(cargar);
  const [version, setVersion] = useState(0);

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
    setEstado({ ...estadoInicial, reglas: { ...REGLAS_BASE } });
    tocar();
  }, [tocar]);

  const guardarReglas = useCallback(
    (r: Reglas) => {
      setEstado((e) => ({ ...e, reglas: r }));
      tocar();
    },
    [tocar],
  );

  const eventos: UserEvent[] = useMemo(
    () => estado.eventos.map((e) => ({ at: new Date(e.atMs), appointmentId: e.appointmentId, kind: e.kind, seq: e.seq })),
    [estado.eventos],
  );

  const mundo = useMemo(
    () => reproducir(cat, eventos, estado.reglas, new Date(estado.nowMs)),
    [cat, eventos, estado.reglas, estado.nowMs],
  );

  const snapshot = useMemo(() => buildSnapshot(mundo, cat, estado.reglas), [mundo, cat, estado.reglas]);

  const api: OdontoAPI = {
    snapshot,
    nowMs: estado.nowMs,
    version,
    moverReloj,
    avanzarHoras,
    registrarEvento,
    reiniciar,
    guardarReglas,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOdonto(): OdontoAPI {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOdonto tiene que usarse dentro de <OdontoProvider>");
  return v;
}
