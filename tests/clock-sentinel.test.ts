import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Centinela del reloj virtual.
 *
 * Si este test falla, alguien leyó la hora real del sistema en vez del reloj de
 * la clínica, y la demo deja de funcionar: adelantar el tiempo ya no cambiaría
 * lo que ese código ve. Es la única regla del proyecto que se defiende sola.
 */

const ROOT = join(__dirname, "..", "src");

/** Únicos archivos autorizados a construir la hora real. */
const EXENTOS = ["lib/clock.ts", "db/seed.ts"];

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
  const archivos = archivosTs(ROOT).filter(
    (f) => !EXENTOS.includes(relative(ROOT, f).split("\\").join("/")),
  );

  it("encuentra archivos que revisar", () => {
    expect(archivos.length).toBeGreaterThan(3);
  });

  it.each(archivos.map((f) => [relative(ROOT, f), f]))("%s no usa la hora real", (_rel, ruta) => {
    const codigo = readFileSync(ruta, "utf8");

    // new Date() sin argumentos
    const sinArgs = /new\s+Date\s*\(\s*\)/g;
    // Date.now()
    const dateNow = /Date\s*\.\s*now\s*\(/g;

    expect(codigo.match(sinArgs), `new Date() sin argumentos en ${_rel}`).toBeNull();
    expect(codigo.match(dateNow), `Date.now() en ${_rel}`).toBeNull();
  });
});
