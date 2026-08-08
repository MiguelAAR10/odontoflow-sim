import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/App";
import { VistaOperacion } from "@/components/VistaOperacion";
import { VistaAgenda } from "@/components/VistaAgenda";
import { VistaDoctores } from "@/components/VistaDoctores";
import { VistaLaboratorios } from "@/components/VistaLaboratorios";
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
    expect(html).toContain("Cada evento de la clínica");
    expect(html).toContain("aceptaciones de la lista de espera están simuladas");
  });

  it("VistaOperación a 48 h muestra la cola y no revienta", () => {
    const mundo = reproducir(cat, [], reglas, new Date(DEMO_START.getTime() + 48 * H));
    const snapshot = buildSnapshot(mundo, cat, reglas);
    const html = renderToStaticMarkup(
      <VistaOperacion
        snapshot={snapshot}
        onAbrir={() => {}}
        onEvento={() => {}}
        onIrA={() => {}}
      />,
    );
    expect(html).toContain("Cola de atención");
  });

  it("VistaAgenda monta con los carriles nuevos (incluida recuperada)", () => {
    const mundo = reproducir(cat, [], reglas, new Date(DEMO_START.getTime() + 48 * H));
    const snapshot = buildSnapshot(mundo, cat, reglas);
    const html = renderToStaticMarkup(
      <VistaAgenda snapshot={snapshot} seleccion={null} onAbrir={() => {}} onEvento={() => {}} />,
    );
    expect(html).toContain("Recuperada");
  });

  it("VistaDoctores muestra los doctores con sus días", () => {
    const mundo = reproducir(cat, [], reglas, new Date(DEMO_START.getTime() + 24 * H));
    const snapshot = buildSnapshot(mundo, cat, reglas);
    const html = renderToStaticMarkup(<VistaDoctores snapshot={snapshot} onAbrir={() => {}} />);
    expect(html).toContain("Dra. Quispe");
    expect(html).toContain("Días que atiende");
  });

  it("VistaLaboratorios muestra los trabajos y la alerta de retraso", () => {
    const mundo = reproducir(cat, [], reglas, new Date(DEMO_START.getTime() + 24 * H));
    const snapshot = buildSnapshot(mundo, cat, reglas);
    const html = renderToStaticMarkup(<VistaLaboratorios snapshot={snapshot} />);
    expect(html).toContain("Trabajos en seguimiento");
    expect(html).toContain("Laboratorio");
  });
});
