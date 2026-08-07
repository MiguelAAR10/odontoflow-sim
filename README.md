# OdontoFlow

Confirmación automática de citas para clínicas odontológicas pequeñas.

El sistema envía los recordatorios, interpreta la respuesta del paciente, mueve el
estado de la cita y solo interrumpe a recepción cuando alguien deja de responder.

---

## Qué es real y qué está simulado

Esta distinción importa, así que va primero.

| Pieza | Estado |
|---|---|
| Motor de reglas | **Real.** Función pura con 20 tests, cubre idempotencia y bordes. |
| Base de datos | **Real.** SQLite con esquema completo y transiciones validadas. |
| Estados y alertas | **Reales.** Se calculan y persisten. |
| Cálculo de riesgo | **Real.** Heurística explicable, no un modelo estadístico. |
| Datos de pacientes | **De prueba.** 28 pacientes y 60 citas inventados. |
| Envío por WhatsApp | **Simulado.** Los mensajes se escriben en la base y se muestran en la interfaz; no salen a ningún teléfono. |
| Reloj | **Virtual.** Lo mueves tú desde la línea de tiempo. |

El canal de mensajería está detrás de una interfaz (`src/lib/channel.ts`). El día
que la clínica tenga número de WhatsApp Business, se implementa otro adaptador y
no se toca ni el motor ni el ejecutor.

---

## Arrancar

```bash
npm install
npm run db:seed     # crea odontoflow.db con la clínica de prueba
npm run dev         # http://localhost:3001
```

Si abres la aplicación sobre una base vacía, se siembra sola.

### Otros comandos

```bash
npm test            # 70 tests
npm run build       # build de producción
npm run db:reset    # borra la base y vuelve a sembrar
npm run reloj -- 30 # mueve el reloj a 30 h desde el inicio de la demo
npm run reloj -- reset
```

---

## La demo en seis pasos

1. **Abre la aplicación.** El reloj marca el miércoles 12 de agosto, 09:15. Arriba,
   la plata en juego esta semana.
2. **Arrastra la línea de tiempo** hacia la derecha, o pulsa `Avanzar 24 h` (tecla `T`).
   Los recordatorios salen solos, los montos cuentan hacia arriba.
3. **Entra a Flujo.** Las tarjetas se han deslizado de "Programada" a "Recordada".
   Nadie llamó a nadie.
4. **Avanza otras 6 horas.** Quien no respondió cae en "Venció plazo" y aparece en
   Pendientes.
5. **Entra a Pendientes.** Una decisión en pantalla, con la conversación real al
   lado. Pulsa `1` para responder como el paciente: la cita queda confirmada.
6. **Entra a Reglas**, cambia el primer recordatorio de 24 a 48 horas y guarda. La
   semana entera se recalcula. Es lo que demuestra que se adapta a cada clínica.

Arrastrar la línea de tiempo **hacia atrás** también funciona: el mundo se
reconstruye y se llega al mismo estado.

---

## Cómo está hecho

Tres piezas, en orden de importancia.

**El motor de reglas** (`src/lib/engine.ts`) es una función pura: recibe el estado
del mundo y devuelve qué acciones tocan. No toca la base, no envía nada, no lee la
hora del sistema. Ahí vive el valor del producto y por eso es lo único con
cobertura exigida.

**El reloj virtual** (`src/lib/clock.ts`) es una fila en la base. Ninguna otra
parte del código construye una fecha a partir de la hora real. Un test centinela
recorre `src/` y falla si aparece `new Date()` sin argumentos fuera de los dos
archivos autorizados. Sin esa regla, adelantar el tiempo dejaría de tener efecto y
no habría demo.

**El ejecutor** (`src/lib/executor.ts`) convierte decisiones en hechos. Su parte
interesante es `seekTo`: como la línea de tiempo va en ambos sentidos, no se
"deshace" nada. Se reconstruye el mundo desde el seed y se reproduce la historia
—el motor más las acciones del recepcionista, guardadas en `user_events`— hasta el
instante pedido. Por eso pasar dos veces por el mismo momento da el mismo estado.

### Estados de una cita

```
scheduled → reminded → confirmed → completed
                    ↘ reschedule_requested → scheduled
                    ↘ no_response → confirmed | no_show
```

Las transiciones no contempladas lanzan error en vez de corromper datos en
silencio (`src/lib/transitions.ts`).

### Stack

Next.js 16 · React 19 · TypeScript estricto · Tailwind 4 · Drizzle ORM sobre
SQLite (libsql) · Zod · Vitest.

> El driver es libsql y no better-sqlite3: este último no tiene binario compatible
> con Node 23 y provoca un segfault al abrir la conexión.

---

## Diseño

Estación de trabajo, no página web: la ventana no hace scroll en escritorio, la
barra de estado con los cuatro montos es persistente y solo cambia el área de
trabajo.

La paleta de estado está validada para contraste y daltonismo (separación ΔE 17.9
en el par más difícil). El ámbar queda por debajo de 3:1 contra el fondo claro, así
que nunca aparece solo: siempre lleva su etiqueta escrita. El verde es el único
acento y se reserva para la acción principal y el elemento activo.

Los iconos dentales siguen el estilo de [Healthicons](https://healthicons.org)
(CC0). Todo dato numérico va en monospace para que las columnas alineen.

---

## Fuera de alcance

Facturación, historia clínica, inventario, compras, proveedores, autenticación,
roles y permisos, pagos y subida de archivos. Este proyecto es el módulo de citas.
