import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BandaSintetica, TEXTO_BANDA_SINTETICA } from "@/components/BandaSintetica";
import { Estacion } from "@/components/Estacion";
import { OdontoProvider } from "@/store/OdontoStore";

/**
 * Frontera de datos sintéticos — la propiedad, no solo el render de hoy.
 *
 * Escrito con la misma intención que `reloj-sentinel.test.ts`: no basta con
 * comprobar que la banda aparece ahora. Lo que hay que proteger es que **no se
 * pueda quitar sin que algo falle**, porque eso es justo lo que pasó una vez
 * (el commit `b57f7bc` borró las etiquetas y el README quedó afirmando algo
 * falso, sin que ningún test se quejara).
 *
 * Por eso hay tres capas:
 *   1. la banda dice lo que tiene que decir;
 *   2. el shell la monta, fuera del switch de vistas;
 *   3. nadie le pone un botón de cerrar ni la esconde por breakpoint.
 */

const html = (nodo: React.ReactElement) => renderToStaticMarkup(nodo);

describe("la banda dice explícitamente qué es este dato", () => {
  it("nombra las tres cosas: sintética, simulada, y que no es real", () => {
    const salida = html(<BandaSintetica />);

    // El significado es el contrato, no el estilo.
    expect(salida).toContain("CLÍNICA SINTÉTICA");
    expect(salida).toContain("DATOS SIMULADOS");
    expect(salida).toContain("NO SON DATOS REALES");
    expect(salida).toContain(TEXTO_BANDA_SINTETICA);
  });

  it("se anuncia a lectores de pantalla, no solo visualmente", () => {
    const salida = html(<BandaSintetica />);
    expect(salida).toContain('role="note"');
    expect(salida).toContain("aria-label");
    // El aria-label tiene que ser explícito, no un "aviso" genérico.
    expect(salida).toMatch(/aria-label="[^"]*sintética[^"]*"/i);
  });

  it("NO se puede cerrar: no expone ningún control", () => {
    const salida = html(<BandaSintetica />);
    expect(salida).not.toContain("<button");
    expect(salida).not.toContain("onClick");
    expect(salida).not.toContain("aria-expanded");
  });

  it("no depende del ancho de pantalla: un solo texto, sin variantes responsive", () => {
    const salida = html(<BandaSintetica />);

    // `hidden sm:flex` / `sm:hidden` fue el patrón de las etiquetas originales,
    // y es exactamente cómo se pierde una en un breakpoint. Acá no se usa.
    // Se inspeccionan SOLO los atributos class: `aria-hidden` en el punto
    // decorativo es legítimo y no tiene nada que ver con visibilidad responsive.
    const clases = [...salida.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
    expect(clases.length).toBeGreaterThan(0);
    for (const clase of clases) {
      expect(clase, `clase con conmutador de display: "${clase}"`).not.toMatch(
        /(^|\s)(hidden|(sm|md|lg|xl):(hidden|flex|block|inline))(\s|$)/,
      );
    }
    // El texto aparece UNA sola vez: no hay copia de escritorio y copia móvil
    // que puedan divergir.
    const veces = salida.split("CLÍNICA SINTÉTICA").length - 1;
    expect(veces).toBe(1);
  });
});

describe("el shell la monta, así que está en toda vista", () => {
  it("<Estacion/> la renderiza", () => {
    const salida = html(
      <OdontoProvider>
        <Estacion onSalir={() => {}} />
      </OdontoProvider>,
    );
    expect(salida).toContain('data-testid="banda-sintetica"');
    expect(salida).toContain(TEXTO_BANDA_SINTETICA);
  });

  it("la monta una sola vez, no una por vista", () => {
    const salida = html(
      <OdontoProvider>
        <Estacion onSalir={() => {}} />
      </OdontoProvider>,
    );
    const veces = salida.split('data-testid="banda-sintetica"').length - 1;
    expect(veces).toBe(1);
  });
});

describe("centinela: la banda no puede volverse opcional", () => {
  const fuente = readFileSync(
    join(process.cwd(), "src/components/Estacion.tsx"),
    "utf8",
  );

  it("se monta FUERA del switch de vistas", () => {
    const enBanda = fuente.indexOf("<BandaSintetica />");
    const primeraVista = fuente.indexOf('vista === "operacion"');

    expect(enBanda).toBeGreaterThan(-1);
    expect(primeraVista).toBeGreaterThan(-1);
    // Si alguien la mueve dentro de una vista, deja de estar en las otras seis.
    expect(enBanda).toBeLessThan(primeraVista);
  });

  it("no se monta bajo ninguna condición", () => {
    const linea = fuente
      .split("\n")
      .find((l) => l.includes("<BandaSintetica />"));

    expect(linea).toBeDefined();
    // Nada de `{algo && <BandaSintetica/>}` ni ternarios: se renderiza siempre.
    expect(linea).not.toContain("&&");
    expect(linea).not.toContain("?");
    expect(linea).not.toContain("||");
  });

  it("vive en el header sticky, para que el scroll no se la lleve", () => {
    const enHeader = fuente.indexOf('className="sticky top-0');
    const enBanda = fuente.indexOf("<BandaSintetica />");
    const cierreHeader = fuente.indexOf("</header>");

    expect(enHeader).toBeGreaterThan(-1);
    expect(enBanda).toBeGreaterThan(enHeader);
    expect(enBanda).toBeLessThan(cierreHeader);
  });

  it("ninguna vista del simulador se pinta fuera de Estacion", () => {
    // Si apareciera un shell alternativo, la banda dejaría de cubrir todo.
    // Este test obliga a que cualquier shell nuevo pase por acá primero.
    const vistas = readdirSync(join(process.cwd(), "src/components"))
      .filter((f) => f.startsWith("Vista") && f.endsWith(".tsx"))
      .map((f) => f.replace(".tsx", ""));

    expect(vistas.length).toBeGreaterThan(0);
    for (const vista of vistas) {
      expect(
        fuente.includes(`<${vista}`),
        `${vista} no se monta en Estacion.tsx: o es huérfana, o hay un shell paralelo sin banda sintética`,
      ).toBe(true);
    }
  });
});
