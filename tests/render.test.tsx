import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/App";
import { VistaIngresos } from "@/components/VistaIngresos";
import { catalogoBase, DEMO_START } from "@/domain/seed";
import { reproducir } from "@/runtime/mundo";
import { buildSnapshot } from "@/runtime/snapshot";
import type { Reglas } from "@/domain/tipos";

/**
 * Smoke test: confirma que el árbol entero monta y renderiza sin romperse.
 * El `curl` al dev server solo devuelve el shell vacío; acá ejercemos el render
 * real de React con datos.
 */

const cat = catalogoBase();
const reglas: Reglas = { ...cat.reglas };
const H = 3_600_000;

describe("render del árbol", () => {
  it("<App/> monta en el estado inicial y pinta lo esencial", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Odontoflow");
    expect(html).toContain("En riesgo real");
    expect(html).toContain("Avanzar 24 h");
    expect(html).toContain("canal simulado");
    expect(html).toContain("respuestas simuladas");
  });

  it("VistaIngresos a 48 h muestra el disclaimer y no revienta", () => {
    const mundo = reproducir(cat, [], reglas, new Date(DEMO_START.getTime() + 48 * H));
    const snapshot = buildSnapshot(mundo, cat, reglas);
    const html = renderToStaticMarkup(
      <VistaIngresos
        snapshot={snapshot}
        onAbrir={() => {}}
        onFiltrar={() => {}}
      />,
    );
    expect(html).toContain("Las respuestas de los pacientes están simuladas");
    expect(html).toContain("Cómo va la semana");
  });
});
