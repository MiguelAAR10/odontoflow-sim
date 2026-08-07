import { describe, it, expect, beforeAll } from "vitest";
import { memoryDb, type Db } from "@/db";
import { appointments, patients, dentists, treatments, clock, rules } from "@/db/schema";
import { seed } from "@/db/seed";
import { DEMO_START } from "@/lib/clock";

describe("seed de la clínica", () => {
  let db: Db;
  let citas: Awaited<ReturnType<typeof cargarCitas>>;

  const cargarCitas = (d: Db) => d.select().from(appointments).all();

  beforeAll(async () => {
    db = await memoryDb();
    await seed(db);
    citas = await cargarCitas(db);
  });

  it("siembra 60 citas", () => {
    expect(citas).toHaveLength(60);
  });

  it("siembra 28 pacientes, 4 odontólogos y 10 tratamientos", async () => {
    expect(await db.select().from(patients).all()).toHaveLength(28);
    expect(await db.select().from(dentists).all()).toHaveLength(4);
    expect(await db.select().from(treatments).all()).toHaveLength(10);
  });

  it("deja el reloj en el instante inicial de la demo", async () => {
    const row = (await db.select().from(clock).all())[0];
    expect(row.now.getTime()).toBe(DEMO_START.getTime());
  });

  it("deja las reglas por defecto", async () => {
    const r = (await db.select().from(rules).all())[0];
    expect(r.firstReminderHours).toBe(24);
    expect(r.secondReminderHours).toBe(2);
    expect(r.alertAfterHours).toBe(6);
  });

  it("no tiene teléfonos repetidos", async () => {
    const tels = (await db.select().from(patients).all()).map((p) => p.phone);
    expect(new Set(tels).size).toBe(tels.length);
  });

  it("ninguna cita se solapa con otra del mismo odontólogo", () => {
    const porDentista = new Map<string, typeof citas>();
    for (const c of citas) {
      const lista = porDentista.get(c.dentistId) ?? [];
      lista.push(c);
      porDentista.set(c.dentistId, lista);
    }
    const choques: string[] = [];
    for (const [dentista, lista] of porDentista) {
      const ordenadas = [...lista].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i].startsAt.getTime() < ordenadas[i - 1].endsAt.getTime()) {
          choques.push(`${dentista}: ${ordenadas[i - 1].id} choca con ${ordenadas[i].id}`);
        }
      }
    }
    expect(choques).toEqual([]);
  });

  it("todas las citas caen dentro del horario de la clínica", () => {
    const fuera = citas.filter((c) => {
      const ini = c.startsAt.getHours() + c.startsAt.getMinutes() / 60;
      const fin = c.endsAt.getHours() + c.endsAt.getMinutes() / 60;
      return ini < 8 || fin > 20;
    });
    expect(fuera.map((c) => c.id)).toEqual([]);
  });

  it("toda cita termina después de empezar", () => {
    const malas = citas.filter((c) => c.endsAt.getTime() <= c.startsAt.getTime());
    expect(malas.map((c) => c.id)).toEqual([]);
  });

  it("las citas ya terminadas están cerradas", () => {
    const terminadas = citas.filter((c) => c.endsAt <= DEMO_START);
    expect(terminadas.length).toBeGreaterThanOrEqual(12);
    const abiertas = terminadas.filter(
      (c) => c.status !== "completed" && c.status !== "no_show",
    );
    expect(abiertas.map((c) => c.id)).toEqual([]);
  });

  it("hay citas futuras suficientes para la demo", () => {
    const futuras = citas.filter((c) => c.startsAt > DEMO_START);
    expect(futuras.length).toBeGreaterThanOrEqual(30);
    // en las próximas 24 h tiene que haber algo, si no la demo abre vacía
    const enVentana = futuras.filter(
      (c) => c.startsAt.getTime() - DEMO_START.getTime() <= 24 * 3_600_000,
    );
    expect(enVentana.length).toBeGreaterThanOrEqual(4);
  });

  it("es determinista: dos siembras dan exactamente lo mismo", async () => {
    const a = await memoryDb();
    const b = await memoryDb();
    await seed(a);
    await seed(b);
    const huella = async (d: Db) =>
      JSON.stringify(
        (await d.select().from(appointments).all()).map((c) => [
          c.id,
          c.startsAt.getTime(),
          c.status,
        ]),
      );
    expect(await huella(a)).toBe(await huella(b));
  });
});
