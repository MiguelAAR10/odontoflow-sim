import { getDb } from "@/db";
import { appointments, messages } from "@/db/schema";
import { seed } from "@/db/seed";
import { seekTo } from "@/lib/executor";
import { getNow } from "@/lib/clock";
import { buildSnapshot } from "@/lib/snapshot";
import { Estacion } from "@/components/Estacion";

// El reloj virtual vive en la base: la página no puede cachearse.
export const dynamic = "force-dynamic";

const VISTAS = ["ingresos", "flujo", "pendientes", "reglas"] as const;
type Vista = (typeof VISTAS)[number];

export default async function Page(props: {
  // En Next 16 los searchParams solo se pueden leer de forma asíncrona.
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await props.searchParams;
  const vistaInicial: Vista = VISTAS.includes(vista as Vista) ? (vista as Vista) : "ingresos";

  const db = await getDb();

  // Primera visita sobre una base vacía: sembrar en vez de mostrar una pantalla
  // rota. Evita que la demo dependa de acordarse de correr `npm run db:seed`.
  const hayDatos = (await db.select().from(appointments).limit(1).all()).length > 0;
  if (!hayDatos) await seed(db);

  // El seed deja las citas tal cual se agendaron, sin pasar por el motor. Si la
  // demo abriera así, las citas de hoy aparecerían como "fuera de la ventana de
  // recordatorio" cuando en realidad ya tocaba avisarles. Se corre el motor una
  // vez sobre el instante actual para que el punto de partida sea coherente.
  const sinProcesar = (await db.select().from(messages).limit(1).all()).length === 0;
  if (sinProcesar) await seekTo(db, await getNow(db));

  const snapshot = await buildSnapshot(db);
  return <Estacion snapshot={snapshot} vistaInicial={vistaInicial} />;
}
