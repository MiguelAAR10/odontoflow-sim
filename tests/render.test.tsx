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
  it("<App/> monta en el estado inicial y pinta la pantalla de inicio", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("OdontoFlow");
    expect(html).toContain("Iniciar demostración");
    expect(html).toContain("Las citas se confirman solas");
    expect(html).toContain("respuestas de los pacientes están simuladas");
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
    expect(html).toContain("Monto en riesgo");
    expect(html).toContain("Avance de la semana");
  });
});
