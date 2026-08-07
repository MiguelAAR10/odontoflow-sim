import type { Catalogo, Cita, Odontologo, Paciente, Reglas, Tratamiento } from "./tipos";

/**
 * Seed determinista de la clínica de demo.
 *
 * Determinista es un requisito, no un detalle: la línea de tiempo se puede
 * arrastrar hacia atrás, y para eso el mundo se reconstruye desde este catálogo
 * y se reproduce la historia. Si el seed variara entre corridas, el pasado
 * cambiaría cada vez que se retrocede.
 *
 * Los mismos 28 pacientes y 60 citas del seed original, ahora como objetos en
 * memoria en vez de filas en SQLite.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Miércoles 12 de agosto de 2026, 09:15. Instante en que arranca la demo. */
export const DEMO_START = new Date(2026, 7, 12, 9, 15, 0, 0);

/** Domingo 16 de agosto, 20:00. Fin del rango que cubre la línea de tiempo. */
export const DEMO_END = new Date(2026, 7, 16, 20, 0, 0, 0);

export const REGLAS_BASE: Reglas = {
  firstReminderHours: 24,
  secondReminderHours: 2,
  alertAfterHours: 6,
  clinicOpenHour: 8,
  clinicCloseHour: 20,
};

export const DENTISTS: Odontologo[] = [
  { id: "d1", fullName: "Dra. Quispe", specialty: "Odontología general", color: "#12876A" },
  { id: "d2", fullName: "Dr. Salazar", specialty: "Endodoncia", color: "#2C6E9B" },
  { id: "d3", fullName: "Dra. Loayza", specialty: "Ortodoncia", color: "#8A5FA8" },
  { id: "d4", fullName: "Dr. Mendoza", specialty: "Implantología", color: "#B06A2C" },
];

export const TREATMENTS: Tratamiento[] = [
  { id: "t1", name: "Limpieza dental", durationMin: 60, priceCents: 12_000 },
  { id: "t2", name: "Endodoncia", durationMin: 90, priceCents: 45_000 },
  { id: "t3", name: "Control de brackets", durationMin: 60, priceCents: 9_000 },
  { id: "t4", name: "Resina", durationMin: 60, priceCents: 18_000 },
  { id: "t5", name: "Corona", durationMin: 120, priceCents: 78_000 },
  { id: "t6", name: "Implante", durationMin: 120, priceCents: 89_000 },
  { id: "t7", name: "Extracción", durationMin: 60, priceCents: 21_000 },
  { id: "t8", name: "Blanqueamiento", durationMin: 60, priceCents: 32_000 },
  { id: "t9", name: "Consulta de evaluación", durationMin: 30, priceCents: 6_000 },
  { id: "t10", name: "Profilaxis y flúor", durationMin: 45, priceCents: 15_000 },
];

const NOMBRES = [
  "Rosa Ccahuana", "Julio Pariona", "Milagros Ríos", "Andrés Vílchez", "Carmen Zapata",
  "Luis Ampuero", "Gabriela Ítalo", "Óscar Trelles", "Fiorella Rojas", "Diego Manrique",
  "Patricia Nolasco", "Renzo Bustamante", "Ana Lucía Prado", "Martín Cornejo", "Sofía Huamán",
  "Jorge Escalante", "Valeria Ochoa", "César Alcántara", "Norma Villegas", "Pedro Yamamoto",
  "Claudia Bejarano", "Elena Quintanilla", "Raúl Ticona", "Mónica Arrieta", "Iván Cabrejos",
  "Lucía Paredes", "Tomás Barrantes", "Rocío Chumpitaz",
];

/** Inasistencias previas por índice de paciente. Fijo, para que el riesgo sea reproducible. */
const NO_SHOWS: Record<number, number> = { 3: 1, 6: 1, 8: 2, 12: 1, 13: 2, 17: 1, 22: 1, 25: 2 };

type ApptSpec = {
  day: number;
  hour: number;
  patient: number;
  treatment: string;
  dentist: string;
  status: Cita["status"];
};

/**
 * 60 citas repartidas alrededor del instante inicial (miércoles 12, 09:15):
 * 15 en el pasado ya cerradas, 8 en las próximas 24 h, 20 entre 24 y 72 h
 * y el resto en la semana siguiente.
 */
function buildSpecs(): ApptSpec[] {
  const s: ApptSpec[] = [];
  const add = (
    day: number,
    hour: number,
    patient: number,
    treatment: string,
    dentist: string,
    status: Cita["status"] = "scheduled",
  ) => s.push({ day, hour, patient, treatment, dentist, status });

  // --- pasado: lunes 10 y martes 11 (12 atendidas, 3 ausencias) ---
  add(0, 8.5, 0, "t1", "d1", "completed");
  add(0, 10, 1, "t2", "d2", "completed");
  add(0, 11.5, 2, "t3", "d3", "completed");
  add(0, 14, 3, "t4", "d1", "no_show");
  add(0, 15.5, 4, "t5", "d4", "completed");
  add(0, 17, 5, "t1", "d1", "completed");
  add(1, 8.5, 6, "t6", "d4", "completed");
  add(1, 10.5, 7, "t7", "d2", "completed");
  add(1, 12, 8, "t8", "d3", "no_show");
  add(1, 14, 9, "t9", "d1", "completed");
  add(1, 15, 10, "t2", "d2", "completed");
  add(1, 17, 11, "t4", "d1", "completed");
  add(2, 8, 12, "t1", "d3", "no_show");
  add(2, 8.5, 13, "t10", "d1", "completed");
  add(2, 9, 14, "t9", "d2", "completed");

  // --- miércoles 12, resto del día (dentro de 24 h) ---
  add(2, 10.5, 15, "t2", "d2", "confirmed");
  add(2, 11.5, 16, "t3", "d3", "confirmed");
  add(2, 13, 17, "t4", "d1", "scheduled");
  add(2, 14.5, 18, "t1", "d1", "scheduled");
  add(2, 16, 19, "t5", "d4", "scheduled");
  add(2, 17.5, 20, "t7", "d2", "scheduled");

  // --- jueves 13 (24 a 48 h) ---
  add(3, 8.5, 21, "t1", "d1");
  add(3, 10, 22, "t6", "d4");
  add(3, 11, 23, "t7", "d2");
  add(3, 12.5, 24, "t9", "d3");
  add(3, 14, 25, "t8", "d3");
  add(3, 15.5, 26, "t2", "d2");
  add(3, 17, 27, "t4", "d1");
  add(3, 18, 0, "t10", "d1");

  // --- viernes 14 (48 a 72 h) ---
  add(4, 8.5, 1, "t2", "d2");
  add(4, 9.5, 2, "t3", "d3");
  add(4, 11, 3, "t4", "d1");
  add(4, 12, 4, "t9", "d4");
  add(4, 14, 5, "t1", "d1");
  add(4, 15, 6, "t5", "d4");
  add(4, 16.5, 7, "t7", "d2");
  add(4, 18, 8, "t10", "d3");

  // --- sábado 15 ---
  add(5, 8.5, 9, "t3", "d3");
  add(5, 9.5, 10, "t1", "d1");
  add(5, 11, 11, "t6", "d4");
  add(5, 13, 12, "t4", "d1");
  add(5, 14.5, 13, "t8", "d3");
  add(5, 16, 14, "t2", "d2");

  // --- domingo 16 ---
  add(6, 9, 15, "t1", "d1");
  add(6, 10.5, 16, "t9", "d2");
  add(6, 12, 17, "t5", "d4");
  add(6, 14, 18, "t3", "d3");
  add(6, 15.5, 19, "t7", "d2");
  add(6, 17, 20, "t10", "d1");

  // --- semana siguiente: lunes 17 a miércoles 19 ---
  add(7, 9, 21, "t1", "d1");
  add(7, 11, 22, "t2", "d2");
  add(7, 14, 23, "t4", "d1");
  add(7, 16, 24, "t6", "d4");
  add(8, 9.5, 25, "t3", "d3");
  add(8, 11.5, 26, "t9", "d2");
  add(8, 14.5, 27, "t8", "d3");
  add(8, 16.5, 0, "t5", "d4");
  add(9, 9, 1, "t7", "d2");
  add(9, 11, 2, "t1", "d1");
  add(9, 15, 3, "t10", "d3");

  return s;
}

/** Lunes 10 de agosto de 2026, 00:00 — origen del calendario del seed. */
const WEEK_START = new Date(2026, 7, 10, 0, 0, 0, 0);

/**
 * Construye el catálogo base de la clínica. Puro y determinista: dos llamadas
 * devuelven objetos distintos pero con exactamente los mismos valores.
 */
export function catalogoBase(): Catalogo {
  const pacientes: Paciente[] = NOMBRES.map((fullName, i) => ({
    id: `p${i + 1}`,
    fullName,
    phone: `+519${String(10_000_000 + i * 137_911).slice(0, 8)}`,
    previousNoShows: NO_SHOWS[i] ?? 0,
  }));

  const porId = new Map(TREATMENTS.map((t) => [t.id, t]));
  const citas: Cita[] = buildSpecs().map((spec, i) => {
    const startsAt = new Date(WEEK_START.getTime() + spec.day * DAY + Math.round(spec.hour * HOUR));
    const dur = porId.get(spec.treatment)!.durationMin;
    return {
      id: `a${i + 1}`,
      pacienteId: `p${spec.patient + 1}`,
      odontologoId: spec.dentist,
      tratamientoId: spec.treatment,
      startsAt,
      endsAt: new Date(startsAt.getTime() + dur * 60_000),
      status: spec.status,
      remindedAt: null,
    };
  });

  return {
    pacientes,
    odontologos: DENTISTS,
    tratamientos: TREATMENTS,
    citas,
    reglas: { ...REGLAS_BASE },
  };
}
