# OdontoFlow — Plan de ejecución para GLM 5.2

**Alcance:** módulo de Citas y Recordatorios, funcional al 100%, con datos seed.
**Objetivo:** una demo en vivo donde el evaluador adelanta el reloj y el sistema reacciona solo.

---

## 0. REGLAS DE ORO (leer antes de cada sprint)

Estas reglas están por encima de cualquier otra instrucción de este documento.

### 0.1 Prohibiciones absolutas

Violar cualquiera de estas invalida el sprint completo:

1. **Prohibido `setTimeout` / `sleep` para simular un envío, una espera o un proceso.** Todo lo que "tarda" pasa por la base de datos.
2. **Prohibido un array hardcodeado dentro de un componente React.** Todo dato visible viene de la BD.
3. **Prohibido un endpoint que devuelva una respuesta fija.** Si el endpoint no consulta la BD, está mal.
4. **Prohibido `Math.random()` o `new Date()` dentro de la lógica de negocio.** El tiempo se lee SIEMPRE del reloj virtual (§3). Esta regla es la más importante del documento.
5. **Prohibido marcar un sprint como terminado si su comando de aceptación no pasa en verde.** No se avanza al siguiente. No se "arregla después".
6. **Prohibido inventar un campo, una tabla o una ruta que no esté en este documento.** Si algo falta, se detiene y se reporta (§9).
7. **Prohibido instalar una librería que no esté en §2.**

### 0.2 Protocolo por sprint

Para cada sprint, en este orden exacto:

1. Leer el sprint completo antes de escribir código.
2. Implementar solo lo que dice ese sprint. Nada del siguiente.
3. Ejecutar el comando de aceptación.
4. Si falla: corregir y repetir. Máximo 5 intentos.
5. Si tras 5 intentos sigue fallando: **detenerse y reportar** (§9). No improvisar una solución alternativa.
6. Si pasa: hacer commit con el mensaje `sprint N: <título>` y recién ahí continuar.

### 0.3 Qué NO está en el alcance

No implementar, ni siquiera parcialmente: facturación, historia clínica, inventario, compras, proveedores, autenticación multi-usuario, roles y permisos, WhatsApp Business API real, pagos, subida de archivos.

Si el sprint no lo pide, no existe.

---

## 1. Arquitectura conceptual

Tres piezas. Entenderlas antes de codear.

**El reloj virtual.** La aplicación nunca lee la hora del sistema. Lee un valor guardado en la BD que el usuario puede adelantar desde la UI. Esto es lo que hace posible la demo: adelantas 24 horas y ves dispararse los recordatorios de mañana. Sin esto no hay demo.

**El motor de reglas.** Una función pura que recibe el estado del mundo (citas + hora virtual) y devuelve la lista de acciones a ejecutar. No envía nada, no escribe nada: decide. Se testea sola, sin BD y sin UI. Es el corazón del producto.

**El canal de mensajería.** Una interfaz con dos implementaciones. La del demo escribe el mensaje en una tabla y lo muestra en un panel tipo bandeja de WhatsApp donde tú puedes responder. La real (que NO se implementa ahora) hablaría con Meta. El resto del sistema no sabe cuál está usando.

Flujo completo:

```
reloj virtual avanza
   ↓
motor de reglas evalúa citas → decide "esta cita necesita recordatorio"
   ↓
se crea un Mensaje en la BD (estado: enviado)
   ↓
aparece en la bandeja simulada
   ↓
el paciente responde "1" (confirmar) o "2" (reprogramar)
   ↓
el motor procesa la respuesta → cambia el estado de la Cita
   ↓
la agenda se actualiza en vivo
```

---

## 2. Stack — fijo, no negociable

| Capa | Elección | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| React | React | 19.x |
| Lenguaje | TypeScript, `strict: true` | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes | shadcn/ui | última |
| Animación | Motion (`motion/react`) | última |
| Base de datos | PostgreSQL vía Docker Compose | 16 |
| ORM | Drizzle ORM + drizzle-kit | última |
| Validación | Zod | 4.x |
| Fechas | date-fns | 4.x |
| Tests | Vitest | 3.x |
| Iconos | lucide-react | última |

Nada más. Sin librería de estado global (los datos vienen del servidor). Sin auth. Sin ORM alternativo.

**Postgres corre en Docker**, no instalado en el sistema. `docker-compose.yml` en la raíz, puerto **5433** (el 5432 puede estar ocupado).

---

## 3. El reloj virtual — especificación exacta

Tabla `clock`, fila única con `id = 1`, campo `now: timestamp`.

Se expone **una sola función** y toda la aplicación la usa:

```ts
// src/lib/clock.ts
export async function getNow(): Promise<Date>
export async function advanceClock(minutes: number): Promise<Date>
export async function resetClock(): Promise<Date>
```

Regla de verificación mecánica: fuera de `src/lib/clock.ts` y de los archivos de seed, **no puede existir ni una sola aparición de `new Date()` sin argumentos ni de `Date.now()`**. Esto se verifica con un test automatizado en el Sprint 1 que hace grep sobre el código fuente. Si ese test falla, el sprint falla.

`resetClock()` deja el reloj en el instante inicial del seed, para poder repetir la demo desde cero.

---

## 4. Esquema de base de datos — literal

No agregar campos. No quitar campos. No renombrar.

```ts
// src/db/schema.ts

clock
  id            integer PK  (siempre 1)
  now           timestamp NOT NULL

patients
  id            uuid PK
  fullName      text NOT NULL
  phone         text NOT NULL UNIQUE
  email         text
  notes         text
  createdAt     timestamp NOT NULL

dentists
  id            uuid PK
  fullName      text NOT NULL
  specialty     text NOT NULL
  color         text NOT NULL          // hex, para la agenda
  active        boolean NOT NULL DEFAULT true

treatments
  id            uuid PK
  name          text NOT NULL
  durationMin   integer NOT NULL
  priceCents    integer NOT NULL

appointments
  id            uuid PK
  patientId     uuid FK → patients
  dentistId     uuid FK → dentists
  treatmentId   uuid FK → treatments
  startsAt      timestamp NOT NULL
  endsAt        timestamp NOT NULL
  status        enum NOT NULL          // ver abajo
  createdAt     timestamp NOT NULL
  updatedAt     timestamp NOT NULL

messages
  id            uuid PK
  appointmentId uuid FK → appointments
  patientId     uuid FK → patients
  direction     enum NOT NULL          // 'outbound' | 'inbound'
  body          text NOT NULL
  sentAt        timestamp NOT NULL     // hora VIRTUAL
  kind          text NOT NULL          // 'reminder_24h' | 'reminder_2h' | 'confirmation_ack' | 'reschedule_ack' | 'patient_reply' | 'no_response_alert'

alerts
  id            uuid PK
  appointmentId uuid FK → appointments
  kind          text NOT NULL          // 'no_response' | 'overbooked'
  message       text NOT NULL
  createdAt     timestamp NOT NULL     // hora VIRTUAL
  resolvedAt    timestamp

rules
  id            integer PK  (siempre 1)
  firstReminderHours   integer NOT NULL DEFAULT 24
  secondReminderHours  integer NOT NULL DEFAULT 2
  alertAfterHours      integer NOT NULL DEFAULT 6   // sin respuesta tras el 1er recordatorio
  clinicOpenHour       integer NOT NULL DEFAULT 8
  clinicCloseHour      integer NOT NULL DEFAULT 20
```

### Estados de una cita (máquina de estados)

```
scheduled  → reminded    (se envió el 1er recordatorio)
reminded   → confirmed   (el paciente respondió confirmando)
reminded   → reschedule_requested  (el paciente pidió cambio)
reminded   → no_response (pasó alertAfterHours sin respuesta)
confirmed  → completed   (pasó la hora de fin, manual o automático)
confirmed  → no_show     (pasó la hora de fin sin marcar asistencia)
cualquiera → cancelled
reschedule_requested → scheduled  (recepción reagenda)
```

Transiciones no listadas: **prohibidas**. La función que cambia el estado debe rechazarlas y lanzar error. Esto se testea.

---

## 5. Sprints

### Sprint 0 — Fundaciones y design system

**Entregable:** proyecto que levanta, BD que conecta, tokens de diseño definidos.

- `create-next-app` con TypeScript, Tailwind 4, App Router.
- `docker-compose.yml` con Postgres 16 en puerto 5433.
- Drizzle configurado, conexión verificada.
- Vitest configurado.
- shadcn/ui inicializado.
- Tokens de diseño en CSS (§6). Este paso no es opcional ni decorativo: **todo el resto del proyecto usa estos tokens y ninguno inventa colores nuevos.**
- Fuentes cargadas vía `next/font`.

**Criterio de aceptación:**
```bash
docker compose up -d && npm run db:push && npm run build && npm test
```
Los cuatro pasos en verde. `npm test` debe correr al menos un test trivial que confirme conexión a la BD.

---

### Sprint 1 — Reloj virtual

**Entregable:** el tiempo de la aplicación es controlable.

- Tabla `clock` + `src/lib/clock.ts` con las tres funciones de §3.
- Server actions: `advanceClock(minutes)`, `resetClock()`.
- Test que verifica que avanzar 90 minutos deja el reloj 90 minutos adelante.
- **Test centinela**: recorre `src/**/*.ts(x)` excluyendo `src/lib/clock.ts` y `src/db/seed.ts`, y falla si encuentra `new Date()` sin argumentos o `Date.now()`.

**Criterio de aceptación:**
```bash
npm test
```
Ambos tests en verde, incluido el centinela.

---

### Sprint 2 — Esquema completo y seed realista

**Entregable:** una clínica creíble dentro de la BD.

- Todas las tablas de §4.
- Seed con: **4 odontólogos**, **28 pacientes con nombres peruanos reales** (no "Paciente 1"), **10 tratamientos** con duraciones y precios coherentes en soles, y **60 citas** distribuidas así respecto del instante inicial del reloj:
  - 12 en el pasado, ya `completed`
  - 3 en el pasado, `no_show`
  - 8 en las próximas 24 horas (algunas ya `confirmed`, otras `scheduled`)
  - 20 entre 24 y 72 horas (todas `scheduled`, listas para disparar recordatorios)
  - 17 repartidas en las 2 semanas siguientes
- Las citas respetan el horario de la clínica y no se solapan por odontólogo.
- `npm run db:seed` es idempotente: borra y recrea.

**Criterio de aceptación:**
```bash
npm run db:seed && npm test
```
Test que valida: 60 citas exactas, cero solapamientos por odontólogo, cero citas fuera del horario, todos los teléfonos únicos.

---

### Sprint 3 — Motor de reglas (el núcleo)

**Entregable:** una función pura, sin BD y sin UI, exhaustivamente testeada.

```ts
// src/lib/engine.ts
export function evaluate(input: {
  now: Date
  appointments: AppointmentView[]
  rules: Rules
  sentMessages: { appointmentId: string; kind: string }[]
}): Action[]
```

`Action` es un union type: `SendReminder`, `RaiseAlert`, `MarkNoShow`, `MarkCompleted`.

Reglas que debe implementar:
- Cita en `scheduled` cuya hora está a ≤ `firstReminderHours` → `SendReminder(reminder_24h)`.
- Cita en `reminded` cuya hora está a ≤ `secondReminderHours` → `SendReminder(reminder_2h)`.
- Cita en `reminded` que lleva ≥ `alertAfterHours` sin respuesta → `RaiseAlert(no_response)`.
- Cita `confirmed` cuyo `endsAt` ya pasó → `MarkCompleted`.
- Cita `reminded` o `no_response` cuyo `endsAt` ya pasó → `MarkNoShow`.

**Propiedad crítica — idempotencia:** llamar `evaluate` dos veces con el mismo input debe producir el mismo resultado, y una acción ya ejecutada (presente en `sentMessages`) nunca se vuelve a emitir. Un recordatorio duplicado al paciente es el peor bug posible de este producto.

**Criterio de aceptación:**
```bash
npm test
```
Mínimo **15 tests unitarios** sobre `evaluate`, cubriendo: cada regla, la idempotencia, los bordes exactos (cita a 24h y 1 minuto vs 23h y 59 min), y una cita cancelada que no genera ninguna acción. Cobertura de `engine.ts` ≥ 90%.

---

### Sprint 4 — Ejecutor y canal de mensajería

**Entregable:** las decisiones del motor se materializan en la BD.

- `src/lib/channel.ts` con la interfaz `MessageChannel` y la implementación `SimulatedChannel` (escribe en `messages`).
- `src/lib/executor.ts`: lee estado → llama `evaluate` → ejecuta cada acción en una **transacción**.
- Los mensajes se redactan en español neutro peruano, con nombre del paciente, tratamiento, fecha, hora y odontólogo, y con instrucciones claras: responder **1** para confirmar, **2** para reprogramar.
- `processInboundMessage(phone, body)`: interpreta la respuesta del paciente, cambia el estado de la cita y responde con un acuse.
- El ejecutor se dispara automáticamente después de cada avance del reloj.
- Validador de transiciones de estado (§4), que lanza error ante transiciones ilegales.

**Criterio de aceptación:**
```bash
npm test
```
Test de integración contra la BD real: sembrar → avanzar el reloj 24h → verificar que se crearon exactamente los mensajes esperados → simular respuesta "1" → verificar que la cita quedó `confirmed`. Más un test que confirme que avanzar el reloj dos veces no duplica mensajes. Más tests de transiciones ilegales rechazadas.

---

### Sprint 5 — Interfaz: agenda y panel del día

**Entregable:** la pantalla principal.

Lee §6 completo antes de empezar. Diseño primero, código después.

- Layout con sidebar de navegación (máximo 5 destinos).
- **Panel del día**: métricas reales calculadas desde la BD (citas de hoy, confirmadas, pendientes de respuesta, espacios libres). Nunca valores fijos.
- **Agenda semanal**: columnas por día, bloques por cita, color por odontólogo, estado legible de un vistazo.
- **Control del reloj**, visible y permanente: hora virtual actual + botones `+1h`, `+6h`, `+24h`, `Reiniciar`. Es el elemento que conduce la demo, tiene que estar siempre a mano.
- Los 6 estados de cada pantalla (vacío, cargando, error, éxito, sin resultados, destructivo).
- Responsive real desde 375px.

**Criterio de aceptación:**
```bash
npm run build
```
Build sin errores ni warnings de TypeScript. Además, verificación manual documentada en `VERIFICACION.md`: capturas de la agenda en 375px y en 1440px, y la confirmación de que al pulsar `+24h` la pantalla cambia.

---

### Sprint 6 — Bandeja de mensajes y alertas

**Entregable:** la pieza que vende la demo.

- Vista de conversaciones tipo bandeja: lista de pacientes a la izquierda, hilo a la derecha.
- Los mensajes salientes aparecen automáticamente al avanzar el reloj.
- Campo para responder **como si fueras el paciente** — es un simulador y la interfaz debe decirlo explícitamente, sin ambigüedad.
- Al responder, la agenda se actualiza sin recargar la página.
- Panel de alertas: citas sin respuesta, con acción para resolverlas.
- Aviso visible y honesto de que el canal está simulado.

**Criterio de aceptación:**
```bash
npm run build && npm test
```
Más el recorrido completo documentado en `VERIFICACION.md`: reiniciar reloj → avanzar 24h → aparece un recordatorio en la bandeja → responder "1" → la cita queda confirmada en la agenda. Con capturas de cada paso.

---

### Sprint 7 — Configuración de reglas y cierre

**Entregable:** el producto es configurable, que es el argumento de venta de la presentación.

- Pantalla de reglas: editar las horas de recordatorio, el umbral de alerta y el horario de la clínica. Se guarda en la tabla `rules` y el motor lo respeta de inmediato.
- Validación inline en el formulario (onBlur), labels visibles.
- `README.md` con: cómo levantar el proyecto, cómo correr la demo paso a paso, y qué está simulado y qué es real.
- Revisión final contra el checklist de §7.

**Criterio de aceptación:**
```bash
docker compose down -v && docker compose up -d && npm run db:push && npm run db:seed && npm run build && npm test
```
Todo desde cero, en verde. Es la prueba de que el proyecto se levanta en una máquina limpia.

---

## 6. Design system — obligatorio y literal

**Modo Tool. Light. Dashboard clínico para recepción y gerencia. VARIANCE 3 · MOTION 2 · DENSITY 8.**

Es un instrumento de trabajo que alguien mira ocho horas al día, no una landing.

### Tokens (definir en `globals.css`, usar solo estos)

```css
--bg:          #FBFBFA   /* near-white, nunca #FFFFFF */
--surface:     #FFFFFF
--border:      #E7E5E4
--text:        #1C1917   /* near-black, nunca #000000 */
--text-muted:  #78716C
--accent:      #3352E1   /* cobalto. Solo en CTA principal y estado activo */

/* Semánticos: solo para estado de cita, en ningún otro lugar */
--ok:      #15803D   /* confirmada */
--warn:    #B45309   /* pendiente de respuesta */
--danger:  #B91C1C   /* ausencia / cancelada */
--neutral: #78716C   /* programada */
```

### Tipografía

- Interfaz: **Geist Sans**.
- Todo número, hora, monto, teléfono o ID: **Geist Mono**. Sin excepción — las horas en la agenda van en monospace para que las columnas alineen.
- Sin serif en ningún lugar.

### Reglas de layout

- Espaciado en múltiplos de 4px. Radios: 6px en controles, 10px en cards.
- Jerarquía por escala y peso. **Nunca** por líneas divisorias decorativas ni por color.
- Una sola acción principal por pantalla.
- El acento cobalto aparece en el CTA principal y en el ítem activo de la navegación. En ningún otro sitio.
- Densidad alta: es una agenda, tiene que caber la semana. Aire entre grupos, no dentro.

### Movimiento (MOTION 2)

- Entrada de listas: `translateY(8px)` + fade, 300ms, `cubic-bezier(0.16,1,0.3,1)`.
- Cambio de estado de una cita: transición de color en 200ms. Esto importa: es lo que el evaluador ve cuando confirma.
- Hover en card: `translateY(-2px)`, 200ms.
- Skeletons, nunca spinners.
- `prefers-reduced-motion` respetado.

### Prohibido (lista anti-slop)

Guion largo en el copy · gradient text · glassmorphism · tres cards idénticas como sección de features · numeritos 01/02/03 decorativos · puntitos animados de "live" · borde lateral de color en las cards · teal o púrpura · iconos de Lucide sin criterio · stock de personas · `rounded-full` en contenedores · containers anidados más de dos niveles.

### Copy

Español neutro peruano. Nunca rioplatense (`ingresa`, no `ingresá`). Sentence case. CTAs con verbo + objeto: "Confirmar cita", "Avanzar 24 horas". Errores que dicen qué pasó y cómo resolverlo. Estados vacíos que invitan a actuar.

---

## 7. Checklist final

Antes de declarar el proyecto terminado, verificar uno por uno:

- [ ] `docker compose down -v` seguido del arranque completo funciona en limpio
- [ ] Cero `new Date()` sin argumentos fuera de `clock.ts` y `seed.ts` (test centinela en verde)
- [ ] Cero arrays de datos hardcodeados en componentes
- [ ] Cobertura de `engine.ts` ≥ 90%
- [ ] Avanzar el reloj dos veces no duplica ningún mensaje
- [ ] Las transiciones de estado ilegales lanzan error
- [ ] Responsive verificado a 375px
- [ ] Contraste de texto ≥ 4.5:1 · foco de teclado visible · targets ≥ 44px
- [ ] Los 6 estados presentes en cada pantalla
- [ ] Cero elementos de la lista anti-slop
- [ ] Sin guiones largos ni rioplatense en el copy
- [ ] El acento cobalto solo en CTA principal y nav activo
- [ ] `README.md` explica qué es real y qué está simulado

---

## 8. Guion de la demo (para lo que se construye)

1. Abrir el panel. Se ve la clínica operando: citas de hoy, semana cargada, métricas reales.
2. Señalar el reloj virtual: "el sistema no depende de la hora real, mira".
3. Pulsar `+24h`. Los recordatorios se disparan solos, el contador de mensajes sube, cambian estados en la agenda.
4. Ir a la bandeja. Los mensajes están escritos con el nombre, el tratamiento y la hora reales de cada paciente.
5. Responder "1" como paciente. La cita pasa a confirmada en vivo.
6. Avanzar otras 6 horas. Un paciente que no respondió genera una alerta para recepción.
7. Entrar a configuración, cambiar el recordatorio de 24h a 48h, volver, reiniciar el reloj y avanzar. El comportamiento cambió.

Ese punto 7 es el cierre: demuestra que es un producto configurable, no un video grabado.

---

## 9. Protocolo de bloqueo

Si algo de este documento es ambiguo, contradictorio o imposible de implementar tal como está escrito:

1. **Detenerse.** No improvisar una solución alternativa.
2. Escribir en `BLOQUEOS.md`: el sprint, qué se intentó, el error exacto, y dos opciones de salida con su recomendación.
3. Continuar únicamente con las partes del sprint que no dependen de lo bloqueado.
4. No marcar el sprint como terminado.

Un bloqueo reportado es un resultado aceptable. Un sprint marcado en verde que en realidad no funciona, no.
