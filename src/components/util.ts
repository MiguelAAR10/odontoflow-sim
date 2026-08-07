"use client";

import { useEffect, useRef, useState } from "react";

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIA3 = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const fechaCorta = (ms: number) => {
  const d = new Date(ms);
  return `${DIA3[d.getDay()]} ${d.getDate()}`;
};

export const soles = (n: number) => `S/ ${Math.round(n).toLocaleString("es-PE")}`;

/** "20 min", "3 h", "2 días" — para decir cuánto falta sin escribir una frase. */
export const duracion = (horas: number) => {
  const h = Math.max(0, horas);
  if (h >= 48) return `${Math.round(h / 24)} días`;
  if (h >= 24) return "1 día";
  // Por debajo de una hora, redondear a horas diría "0 h" con la cita encima.
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h.toFixed(0)} h`;
};

/**
 * Anima un número hacia su nuevo valor.
 *
 * No es decoración: ver el monto subir dice cuánto cambió, no solo cuál es el
 * valor nuevo. Es la diferencia entre enterarte de que algo pasó y verlo pasar.
 */
export function useContador(valor: number, ms = 420) {
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const desde = anterior.current;
    anterior.current = valor;
    if (desde === valor) {
      setMostrado(valor);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMostrado(valor);
      return;
    }

    const t0 = performance.now();
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setMostrado(desde + (valor - desde) * e);
      if (p < 1) raf.current = requestAnimationFrame(paso);
    };
    raf.current = requestAnimationFrame(paso);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [valor, ms]);

  return mostrado;
}

/**
 * FLIP: anima las tarjetas cuando cambian de carril.
 *
 * Mide dónde estaba cada una antes del repintado y la desliza desde ahí. Es lo
 * que hace visible que el sistema movió la cita, en vez de que aparezca ya
 * movida en otra columna.
 */
export function useFlip(clave: string, selector = "[data-flip]") {
  const posiciones = useRef(new Map<string, DOMRect>());
  const primera = useRef(true);

  useEffect(() => {
    const nodos = Array.from(document.querySelectorAll<HTMLElement>(selector));

    if (!primera.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const nodo of nodos) {
        const id = nodo.dataset.flip!;
        const antes = posiciones.current.get(id);
        if (!antes) continue;
        const ahora = nodo.getBoundingClientRect();
        const dx = antes.left - ahora.left;
        const dy = antes.top - ahora.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        nodo.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.75 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 520, easing: "cubic-bezier(.2,.9,.3,1)" },
        );
      }
    }

    primera.current = false;
    const mapa = new Map<string, DOMRect>();
    for (const nodo of nodos) mapa.set(nodo.dataset.flip!, nodo.getBoundingClientRect());
    posiciones.current = mapa;
  }, [clave, selector]);
}

/** Vale `true` un instante cuando el número sube. Para el latido del contador. */
export function useSubida(valor: number) {
  const [subio, setSubio] = useState(false);
  const anterior = useRef(valor);
  useEffect(() => {
    if (valor > anterior.current) {
      setSubio(true);
      const t = setTimeout(() => setSubio(false), 520);
      anterior.current = valor;
      return () => clearTimeout(t);
    }
    anterior.current = valor;
  }, [valor]);
  return subio;
}
