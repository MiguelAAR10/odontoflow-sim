import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Centinela del reloj virtual.
 *
 * El reloj es estado de React, no la hora del sistema. Si alguien usa `new Date()`
 * sin argumentos o `Date.now()` en la app, estaría leyendo la hora real y la demo
 * se rompería: adelantar el tiempo ya no cambiaría lo que ese código ve.
 */

const ROOT = join(__dirname, "..", "src");

function archivosTs(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosTs(ruta));
    else if (/\.(ts|tsx)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

describe("nadie lee la hora del sistema", () => {
  const archivos = archivosTs(ROOT);

  it("encuentra archivos que revisar", () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  it.each(archivos.map((f) => [relative(ROOT, f), f]))(
    "%s no usa la hora real",
    (_rel, ruta) => {
      const codigo = readFileSync(ruta, "utf8");
      const sinArgs = /new\s+Date\s*\(\s*\)/g;
      const dateNow = /Date\s*\.\s*now\s*\(/g;
      expect(codigo.match(sinArgs), `new Date() sin argumentos en ${_rel}`).toBeNull();
      expect(codigo.match(dateNow), `Date.now() en ${_rel}`).toBeNull();
    },
  );
});
