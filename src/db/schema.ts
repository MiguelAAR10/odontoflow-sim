import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Reloj virtual. Una sola fila (id = 1).
 * Ninguna parte de la app lee la hora del sistema: lee esto.
 */
export const clock = sqliteTable("clock", {
  id: integer("id").primaryKey(),
  now: integer("now", { mode: "timestamp_ms" }).notNull(),
});

/** Parámetros del motor. Una sola fila (id = 1), editable desde la pantalla de Reglas. */
export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey(),
  firstReminderHours: integer("first_reminder_hours").notNull().default(24),
  secondReminderHours: integer("second_reminder_hours").notNull().default(2),
  alertAfterHours: integer("alert_after_hours").notNull().default(6),
  clinicOpenHour: integer("clinic_open_hour").notNull().default(8),
  clinicCloseHour: integer("clinic_close_hour").notNull().default(20),
});

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  /** inasistencias históricas: alimenta el cálculo de riesgo */
  previousNoShows: integer("previous_no_shows").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const dentists = sqliteTable("dentists", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  specialty: text("specialty").notNull(),
  color: text("color").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const treatments = sqliteTable("treatments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  /** en céntimos de sol, para no arrastrar errores de coma flotante */
  priceCents: integer("price_cents").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  dentistId: text("dentist_id")
    .notNull()
    .references(() => dentists.id),
  treatmentId: text("treatment_id")
    .notNull()
    .references(() => treatments.id),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  /** scheduled · reminded · confirmed · reschedule_requested · no_response · completed · no_show · cancelled */
  status: text("status").notNull().default("scheduled"),
  /** instante del primer recordatorio; el motor mide el plazo de respuesta desde acá */
  remindedAt: integer("reminded_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id")
    .notNull()
    .references(() => appointments.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  /** outbound = clínica → paciente · inbound = paciente → clínica */
  direction: text("direction").notNull(),
  body: text("body").notNull(),
  /** hora VIRTUAL, nunca la del sistema */
  sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  kind: text("kind").notNull(),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id")
    .notNull()
    .references(() => appointments.id),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
});

/**
 * Acciones del recepcionista, con el instante virtual en que ocurrieron.
 *
 * Es lo que permite mover la línea de tiempo hacia atrás: el estado del mundo
 * se reconstruye desde el seed y se reproducen estos eventos hasta el instante
 * pedido. Sin esto el tiempo solo podría avanzar.
 */
export const userEvents = sqliteTable("user_events", {
  id: text("id").primaryKey(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  appointmentId: text("appointment_id").notNull(),
  /** patient_confirm · patient_reschedule · apply_suggestion · snooze */
  kind: text("kind").notNull(),
  /** orden estable cuando dos eventos comparten instante */
  seq: real("seq").notNull(),
});
