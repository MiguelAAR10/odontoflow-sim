/**
 * Mueve el reloj de la clínica desde la consola.
 *
 *   npm run reloj -- 30      → 30 horas después del inicio de la demo
 *   npm run reloj -- reset   → vuelve al inicio y borra la historia
 *
 * Sirve para preparar el estado antes de enseñar la demo sin tener que
 * arrastrar la línea de tiempo a mano.
 */
import { createDb } from "@/db";
import { seekTo, resetDemo } from "@/lib/executor";
import { DEMO_START } from "@/lib/clock";

async function main() {
  const arg = process.argv[2] ?? "0";
  const url = process.env.ODONTOFLOW_DB ?? "file:odontoflow.db";
  const db = await createDb(url);

  if (arg === "reset") {
    const t = await resetDemo(db);
    console.log(`Demo reiniciada. Reloj en ${t.toLocaleString("es-PE")}`);
    return;
  }

  const horas = Number(arg);
  if (Number.isNaN(horas)) {
    console.error(`No entiendo "${arg}". Usa un número de horas o "reset".`);
    process.exit(1);
  }
  const t = await seekTo(db, new Date(DEMO_START.getTime() + horas * 3_600_000));
  console.log(`Reloj en ${t.toLocaleString("es-PE")} (+${horas} h desde el inicio)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
