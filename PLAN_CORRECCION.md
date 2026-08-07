# OdontoFlow — Plan de corrección para GLM 5.2

El proyecto ya está construido y funciona. Este documento es para **arreglarlo**,
no para rehacerlo. Hay un fallo de fondo que hace que la demo cuente la historia
equivocada, y varios problemas de interfaz.

---

## 0 · REGLAS DE ORO

Están por encima de cualquier otra cosa en este documento.

### 0.1 Prohibiciones absolutas

1. **Prohibido `new Date()` sin argumentos y `Date.now()`** en cualquier archivo
   de `src/` que no sea `src/lib/clock.ts` o `src/db/seed.ts`. Hay un test
   centinela (`tests/clock-sentinel.test.ts`) que lo verifica y falla el build.
   El tiempo se lee SIEMPRE del reloj virtual.
2. **Prohibido `Math.random()`** en cualquier parte del código de negocio. Todo
   tiene que ser determinista: la línea de tiempo va hacia atrás y el mismo
   instante debe producir siempre el mismo estado. Si necesitas variedad, deriva
   un número del `id` de la cita (hay una receta en la Tarea 1).
3. **Prohibido romper los tests que ya pasan.** Son 70 y están todos en verde.
   Si un cambio los invalida legítimamente, **actualiza el test y explica por qué
   en el mensaje de commit**; no lo borres ni lo marques `skip`.
4. **Prohibido reescribir desde cero** cualquier archivo. Son ediciones
   quirúrgicas sobre código que ya funciona.
5. **Prohibido tocar** `src/lib/engine.ts` salvo donde la Tarea 1 lo indique
   explícitamente. Es el núcleo y tiene 20 tests encima.
6. **Prohibido instalar dependencias nuevas.** Todo se hace con lo que ya hay.
7. **Prohibido dar una tarea por terminada si su comando de aceptación no pasa.**

### 0.2 Protocolo por tarea

1. Lee la tarea entera antes de escribir código.
2. Implementa solo esa tarea.
3. Ejecuta su comando de aceptación.
4. Si falla: corrige y repite, máximo 5 intentos.
5. Si tras 5 intentos sigue fallando: **detente y escribe en `BLOQUEOS.md`** qué
   intentaste, el error exacto y dos opciones de salida. No improvises otra cosa.
6. Si pasa: `git add -A && git commit -m "fix(N): <título>"` y sigue.

### 0.3 Honestidad del producto

Esto es una demo que se le va a enseñar a dueños de clínicas. **Nada puede
aparentar ser un dato real cuando es una suposición.** La Tarea 1 introduce
pacientes que responden solos: eso es una simulación y la interfaz tiene que
decirlo con esas palabras. No se puede insinuar que el 65 % de confirmación es un
resultado medido.

---

## 1 · Cómo arrancar y verificar

```bash
cd ~/Desktop/PROYECTOS_2026/OdontoFlow
npm install
npm run db:reset      # borra la base y siembra la clínica de prueba
npm run dev           # http://localhost:3001
```

| Comando | Para qué |
|---|---|
| `npm test` | 70 tests. Tienen que quedar todos en verde. |
| `npm run build` | Build de producción. Sin errores ni avisos de TypeScript. |
| `npm run verificar` | Recorrido de la demo de punta a punta contra la base. |
| `npm run reloj -- 30` | Mueve el reloj a 30 h desde el inicio, sin usar la interfaz. |
| `npm run reloj -- reset` | Vuelve al inicio y borra la historia. |

### Mapa del código

```
src/lib/engine.ts       Motor de reglas. Función pura evaluate(). NO TOCAR salvo Tarea 1.
src/lib/executor.ts     Aplica las decisiones. Aquí vive reproducir() y seekTo().
src/lib/clock.ts        Reloj virtual. DEMO_START y DEMO_END.
src/lib/snapshot.ts     Arma el estado que consume la interfaz. buildSnapshot().
src/lib/risk.ts         Cálculo de riesgo y su explicación en texto.
src/lib/channel.ts      Canal simulado y redacción de los mensajes.
src/db/seed.ts          Clínica de prueba: 60 citas, 28 pacientes.
src/components/         Interfaz. Estacion.tsx es el chrome; Vista*.tsx cada pantalla.
tests/                  70 tests.
```

**Cómo funciona el tiempo (leer antes de tocar `executor.ts`):** la línea de
tiempo se arrastra en ambos sentidos. Para lograrlo no se deshace nada: se
reconstruye el mundo desde el seed y se reproduce la historia hasta el instante
pedido, en pasos de 30 minutos (`STEP_MS`). Las acciones del usuario se guardan en
la tabla `user_events` con su instante y se re-aplican en cada reconstrucción. Por
eso **todo tiene que ser determinista**.

---

## 2 · Diagnóstico: qué está mal

### 🔴 Problema 1 — La demo demuestra el problema, nunca la solución

**Este es el fallo grave.** Con el reloj avanzado, la pantalla muestra:

```
Agendado S/ 11,250   Confirmado S/ 0   Esperando S/ 9,020   Venció el plazo S/ 2,230
Recuperado por el sistema: S/ 0
```

15 recordatorios enviados y **cero confirmaciones**. La barra de composición es
ámbar y rojo, sin nada de verde.

La causa: **en la simulación ningún paciente responde por su cuenta**. Solo hay
confirmación si el operador entra a Pendientes y pulsa `1` a mano. El flujo
natural es entonces `programada → recordada → venció el plazo`, en un solo sentido,
hacia el rojo. Cuanto más avanzas el reloj, peor se ve todo.

Pero el valor del producto es justamente que **la gente contesta el WhatsApp sin
que nadie llame**. Eso es lo que falta simular. Sin ello, un dueño de clínica
mirando la demo concluye que el sistema molesta a los pacientes y no sirve.

### 🟠 Problema 2 — El titular no discrimina

"Agendado S/ 11,250" y "En juego S/ 11,250" son el mismo número, y ese mismo
número aparece una tercera vez en la barra superior. Si el 100 % está siempre en
juego, el indicador no informa de nada.

### 🟠 Problema 3 — El reloj cae fuera del horario de la clínica

En la captura marca **23:32 de un miércoles**. La clínica cierra a las 20:00. Se
está viendo una estación de recepción a medianoche con siete alertas encima.

### 🟡 Problema 4 — La lista de riesgo tiene ruido

Aparecen citas como "Iván Cabrejos · lunes 17 · aún fuera de la ventana de
recordatorio" con un solo pip de riesgo. No hay nada que decidir sobre ellas. Una
lista de acción solo debe contener lo accionable.

### 🟡 Problema 5 — Composición vacía y espacio desperdiciado

La mitad inferior derecha de la pantalla queda vacía mientras la tabla de la
izquierda se estira. Los paneles "Composición" y "Recuperado" ocupan poco y dejan
un hueco grande.

---

## 3 · Tareas

### Tarea 1 · Pacientes que responden solos 🔴

**Objetivo:** que al avanzar el reloj el verde crezca solo, sin que nadie toque
nada, y que "Recuperado por el sistema" deje de ser cero.

Crea **`src/lib/paciente-sim.ts`**:

```ts
/**
 * Simulación del comportamiento del paciente.
 *
 * En la clínica real, buena parte de la gente contesta el recordatorio sin que
 * nadie llame — y eso es justamente el valor del producto. Esta simulación
 * reproduce ese comportamiento para que la demo cuente la historia completa.
 *
 * Es una SUPOSICIÓN, no un dato medido, y la interfaz lo dice con esas palabras.
 *
 * Determinista a propósito: la respuesta de cada paciente se deriva de su id, no
 * de un azar. La línea de tiempo se puede arrastrar hacia atrás y el mismo
 * instante tiene que producir siempre el mismo mundo.
 */

/** Entero estable a partir de un texto. Mismo id → mismo número, siempre. */
function semilla(id: string): number { /* hash simple tipo FNV o djb2 */ }

export type RespuestaSimulada =
  | { tipo: "confirma"; trasHoras: number }
  | { tipo: "reprograma"; trasHoras: number }
  | { tipo: "silencio" };

/**
 * Qué hará este paciente cuando reciba su recordatorio.
 * Reparto aproximado: 62 % confirma, 13 % pide otro horario, 25 % no responde.
 * Quien ya faltó antes tiene más probabilidad de quedarse callado.
 */
export function respuestaDe(
  appointmentId: string,
  inasistenciasPrevias: number,
): RespuestaSimulada { /* ... */ }
```

Requisitos:

- **Determinismo total.** `respuestaDe("a12", 0)` devuelve siempre lo mismo. Nada
  de `Math.random()`, nada de fechas.
- **`trasHoras` entre 0.5 y 5**, derivado también de la semilla, para que las
  respuestas lleguen espaciadas y no todas de golpe.
- **Los pacientes con inasistencias previas responden menos.** Con
  `inasistenciasPrevias >= 2`, el silencio debe ser claramente más probable. Esto
  hace que el riesgo que ya calcula `risk.ts` se corresponda con lo que pasa.
- El reparto global debe quedar cerca de 62/13/25 sobre los 28 pacientes del seed.

**Integración en `src/lib/executor.ts`:**

En la función `reproducir()`, dentro del bucle de pasos y **después** de
`pasoMotor(ahora)`, aplica las respuestas que ya vencieron: para cada cita en
estado `reminded` cuyo `remindedAt` esté a más de `trasHoras` del instante actual,
aplica su respuesta simulada exactamente igual que si el usuario hubiera pulsado
`1` o `2` (reutiliza la lógica de `aplicarEvento`, no la dupliques).

Detalles que importan:

- Una respuesta simulada **no** se guarda en `user_events`: se recalcula sola en
  cada reconstrucción. `user_events` es solo para lo que hace la persona.
- Si el usuario ya actuó sobre esa cita, **manda el usuario**: no la pises.
- El paciente responde **antes** de que venza el plazo si su `trasHoras` es menor
  que `alertAfterHours`; si es mayor, primero salta la alerta y luego responde.
  Ambas cosas tienen que funcionar.
- Los mensajes entrantes simulados van a la tabla `messages` como cualquier otro,
  para que aparezcan en la conversación.

**En la interfaz** (`src/components/Estacion.tsx`, pie de la barra lateral): junto
a "canal simulado" añade **"respuestas simuladas"** con el mismo tratamiento
visual discreto. Y en el panel "Recuperado por el sistema"
(`src/components/VistaIngresos.tsx`) añade una línea pequeña en `text-ink-3`:
*"Las respuestas de los pacientes están simuladas para la demo."*

**Tests que hay que actualizar:** varios de `tests/executor.test.ts` asumen que
nadie confirma solo (por ejemplo el que busca una cita en estado `reminded` tras
avanzar 24 h). Actualízalos para que sigan comprobando lo mismo bajo el nuevo
comportamiento. **No los debilites**: si un test comprobaba que no hay duplicados,
tiene que seguir comprobándolo.

**Tests nuevos obligatorios** en `tests/paciente-sim.test.ts`:

1. `respuestaDe` devuelve lo mismo llamada mil veces con el mismo id.
2. El reparto sobre los 60 ids del seed cae en 62/13/25 con ±10 puntos.
3. Quien tiene 2 inasistencias previas guarda silencio más que quien tiene 0.
4. `trasHoras` siempre entre 0.5 y 5.

Y en `tests/executor.test.ts`:

5. Avanzar 48 h produce **al menos una cita confirmada sin ninguna acción del
   usuario**, y `totales.rescatado > 0`.
6. Ir a 48 h, volver a `DEMO_START` y volver a 48 h da **exactamente el mismo
   estado** (misma huella de estados y mismo número de mensajes).

**Aceptación:**
```bash
npm test && npm run verificar
```
Todos en verde, y en `npm run verificar` el paso 2 debe reportar confirmaciones
automáticas. Además, a ojo en `http://localhost:3001`: avanza 48 h y comprueba que
**"Confirmado" y "Recuperado por el sistema" ya no son cero** y que la barra de
composición tiene verde.

---

### Tarea 2 · Arreglar el titular 🟠

En `src/lib/snapshot.ts`, dentro de `buildSnapshot`, añade a `totales`:

```ts
/** Plata de las citas que de verdad pueden caerse: suma de soles × riesgo. */
enRiesgo: number;
```

Se calcula sumando `c.soles * c.riesgo` sobre las citas activas (la función
`riskOf` ya existe en `src/lib/risk.ts` y `c.riesgo` ya viene calculado en
`CitaVista`). Redondea a entero.

En `src/components/VistaIngresos.tsx`, la cifra dominante pasa a mostrar
`totales.enRiesgo` con el rótulo **"En riesgo real"**, y el texto de al lado
explica la composición en una sola frase: cuánto está confirmado y cuánto venció
el plazo.

El KPI "Agendado" de la barra de estado se queda como está: ese sí debe ser el
total.

**Aceptación:** `npm run build` sin errores y, en pantalla, la cifra grande es
**menor** que "Agendado" en cualquier momento de la línea de tiempo.

---

### Tarea 3 · El reloj respeta el horario de la clínica 🟠

En `src/lib/clock.ts`, añade y exporta:

```ts
/**
 * Acerca un instante al horario de atención.
 *
 * Si cae de madrugada, lo mueve a la apertura del día siguiente; si cae después
 * del cierre, a la apertura del día siguiente también. Una estación de recepción
 * a las 23:32 no tiene sentido: nadie está ahí.
 */
export function dentroDeHorario(t: Date, abre: number, cierra: number): Date
```

Úsala en `seekTo` (`src/lib/executor.ts`) **solo cuando el movimiento venga de los
botones de avance** (`avanzarHoras` en `src/app/actions.ts`), no cuando venga de
arrastrar la línea de tiempo — ahí el usuario está eligiendo un instante concreto
y hay que respetarlo.

Las horas de apertura y cierre salen de la tabla `rules` (`clinicOpenHour`,
`clinicCloseHour`), que ya existe y es editable desde la pantalla de Reglas.

**Aceptación:** test nuevo en `tests/executor.test.ts` que comprueba que tras
varios `avanzarHoras` la hora resultante siempre cae entre apertura y cierre.

---

### Tarea 4 · Quitar el ruido de la lista de riesgo 🟡

En `src/components/VistaIngresos.tsx`, la tabla "Riesgo de no ocurrir" solo debe
listar citas **accionables**: las que ya recibieron recordatorio (`reminded`), las
que vencieron el plazo (`no_response`) y las que pidieron cambio
(`reschedule_requested`). Fuera las `scheduled` que aún no entraron en la ventana.

Si tras filtrar no queda ninguna, muestra un estado vacío que **invite a actuar**,
no un mensaje triste: *"Nada en riesgo ahora mismo. Mueve la línea de tiempo para
ver al sistema trabajar."*

Cambia el contador de la cabecera de `{n} de {total}` a algo que se entienda:
`{n} citas requieren seguimiento`.

**Aceptación:** en pantalla, ninguna fila dice "aún fuera de la ventana de
recordatorio".

---

### Tarea 5 · Aprovechar el espacio vacío 🟡

En la vista Ingresos sobra media pantalla abajo a la derecha. Añade ahí un panel
**"Cómo va la semana"** con la evolución del dinero confirmado a lo largo de los
5 días de la demo: una serie de 5 barras, una por día, con la plata confirmada de
ese día contra la agendada.

Reglas de la visualización, no negociables:

- Los datos salen de `snapshot.citas`, agrupados por día. Nada inventado.
- Una sola serie, sin leyenda: el título ya dice qué es.
- Barras finas, esquinas superiores redondeadas 4 px, ancladas a la base.
- Verde `--color-ok` para lo confirmado, `--color-line` para el resto de la barra.
- El día actual, marcado con un borde inferior más grueso.
- Cifras en monospace (clase `.tabular`), como todo dato numérico del proyecto.
- Etiqueta directa solo en el día actual, no en los cinco.
- Si un día no tiene citas, la barra es plana y no desaparece.

**Aceptación:** `npm run build` sin errores, y el panel se ve correcto a 1440 px y
a 1024 px.

---

### Tarea 6 · Revisión final

1. Corre la aplicación y haz el recorrido completo del `README.md` (los seis
   pasos), comprobando que cada uno hace lo que dice.
2. Toma capturas a 1440 px de las cuatro vistas y a 390 px de Ingresos. Guárdalas
   en `docs/` y enlázalas desde `VERIFICACION.md`.
3. Actualiza `VERIFICACION.md`: añade una sección "Correcciones de la segunda
   pasada" explicando qué cambió y por qué, con los números antes y después
   (confirmado y recuperado tras avanzar 48 h).
4. Actualiza `README.md`: en la tabla "Qué es real y qué está simulado" añade la
   fila **"Respuestas de pacientes — Simuladas"**.

**Aceptación final, desde cero:**

```bash
rm -f odontoflow.db* && npm run db:reset && npm test && npm run build && npm run verificar
```

Todo en verde.

---

## 4 · Checklist antes de decir que terminaste

- [ ] Los 70 tests originales siguen pasando (o están actualizados con su razón)
- [ ] Hay tests nuevos para la simulación de pacientes y para el horario
- [ ] Cero `Math.random()` en `src/`
- [ ] Cero `new Date()` sin argumentos fuera de `clock.ts` y `seed.ts`
- [ ] Avanzar 48 h da confirmadas y rescatado mayores que cero, sin tocar nada
- [ ] Ir a 48 h, volver al inicio y volver a 48 h da el mismo estado exacto
- [ ] La cifra dominante es menor que "Agendado"
- [ ] Ninguna hora de la demo cae fuera del horario de la clínica al usar los botones
- [ ] La lista de riesgo solo muestra citas accionables
- [ ] La interfaz dice que las respuestas de pacientes están simuladas
- [ ] `npm run build` sin errores ni avisos de TypeScript
- [ ] `README.md` y `VERIFICACION.md` actualizados

---

## 5 · Si te bloqueas

Escribe en `BLOQUEOS.md`: la tarea, qué intentaste, el error exacto y dos opciones
de salida con tu recomendación. Continúa con las tareas que no dependan de la
bloqueada.

Un bloqueo reportado es un resultado aceptable. Una tarea marcada como hecha que
en realidad no funciona, no.
