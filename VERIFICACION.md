# Verificación

Qué se comprobó, cómo, y qué quedó pendiente. Todo reproducible con los comandos
que aparecen aquí.

> Tras el rewrite full-frontend (sin base de datos ni servidor), los comandos y los
> números de abajo reemplazan a los de la versión original.

---

## 1 · Automática

```bash
npm test && npm run build
```

**Resultado: 58 tests en verde, build sin errores ni avisos de TypeScript (77 KB JS gzip).**

| Suite | Qué cubre |
|---|---|
| `engine.test.ts` (13) | Las reglas, idempotencia, bordes exactos, citas cerradas que no generan acciones. |
| `mundo.test.ts` (8) | Reproducción: recordatorios solos, pacientes que confirman solos, determinismo al ir y volver, el humano manda sobre la sim. |
| `paciente-sim.test.ts` (4) | Determinismo del id, reparto 62/13/25 (±10), más silencio con inasistencias previas, `trasHoras` en [0.5, 5]. |
| `horario.test.ts` (5) | El reloj nunca cae fuera del horario al avanzar; acota al rango de la demo. |
| `seed.test.ts` (5) | 60 citas, horario respetado, teléfonos únicos, citas pasadas cerradas, determinismo. |
| `reloj-sentinel.test.ts` (23) | Ningún archivo de `src/` lee la hora real del sistema (`new Date()` sin args o `Date.now()`). |

El centinela del reloj sigue siendo la prueba más importante: si alguien usa la
hora real, adelantar el reloj deja de tener efecto y la demo se rompe en silencio.

---

## 2 · Recorrido de la demo

```bash
npm run verificar
```

Ejecuta contra el runtime puro lo mismo que hará el evaluador en vivo:

```
1 · Punto de partida        45 citas vivas · S/ 13,080 agendados
2 · Avanzar 24 horas        14 recordatorios · 6 confirmadas · S/ 1,310 rescatado
3 · Avanzar 6 horas más     1 pide decisión · S/ 180 en riesgo
4 · Responder como paciente  Rocío Chumpitaz quedó confirmada, con acuse
5 · Retroceder en el tiempo  el pasado vuelve a su estado original e ir y volver reproduce el mismo mundo
6 · No hay duplicados        ningún recordatorio se envió dos veces
```

**Resultado: recorrido completo sin fallos.**

---

## 3 · Correcciones de la segunda pasada

La versión original tenía un fallo de fondo: al avanzar el reloj **ningún paciente
respondía solo**, así que todo iba hacia el rojo y "Recuperado por el sistema" era
cero. La demo contaba la historia equivocada. Esta pasada lo corrige y limpia la
interfaz.

| Métrica a 24 h (sin tocar nada) | Antes | Después |
|---|---|---|
| Confirmado | S/ 0 | **S/ 1,310** |
| Recuperado por el sistema | S/ 0 | **S/ 1,310** (6 citas) |
| En riesgo real (titular nuevo) | — | S/ 3,243 (menor que el agendado S/ 11,250) |

Cambios concretos:

- **Pacientes que responden solos.** Simulación determinista derivada del id de cada
  cita (62 % confirma, 13 % pide cambio, 25 % silencio; más silencio si ya faltó).
  Al avanzar el reloj el verde crece solo. La interfaz lo declara: "respuestas
  simuladas".
- **Titular "En riesgo real".** Antes la cifra grande repetía el agendado. Ahora
  muestra la suma de soles × riesgo: lo que de verdad puede caerse.
- **El reloj respeta el horario.** Avanzar con los botones nunca deja el reloj a
  medianoche; lo acerca a la próxima apertura.
- **Lista de riesgo solo accionable.** Fuera las citas que aún no entraron en la
  ventana de recordatorio. Si no queda nada, un estado vacío invita a mover el reloj.
- **Panel "Cómo va la semana".** Cinco barras, una por día, con el confirmado contra
  lo agendado. Aprovecha el espacio que sobraba abajo a la derecha.

---

## 4 · Interfaz, mirada de verdad

Pendiente: capturas a 1440 px (las cuatro vistas) y a 390 px (Ingresos) para
incluir acá. Mientras tanto, lo verificado manualmente:

| Vista | Qué se confirma |
|---|---|
| **Ingresos** | Cifra "En riesgo real" menor que el agendado, lista de riesgo solo con accionables, composición filtrable, recuperado con disclaimer de simulación, panel de la semana. |
| **Flujo** | Cuatro carriles, las tarjetas se deslizan (FLIP) al cambiar de estado, barra de espera hacia el plazo. |
| **Pendientes** | Una decisión por pantalla, sugerencia del sistema, atajos 1/2/E/Enter y la conversación al lado. |
| **Reglas** | Etiquetas visibles, validación al salir del campo, guardar inhabilitado sin cambios. |
| **390 px** | Sin scroll horizontal; el nav se vuelve fila y la barra de estado pasa a 2 × 2. |

---

## Limitaciones conocidas

- **El móvil es secundario.** Es una herramienta de mostrador, pensada para pantalla
  grande. Abajo de 390 px se ve, pero no se pulió al mismo nivel que el escritorio.
- **Sin autenticación.** Cualquiera con la URL ve y opera todo. Deliberado para la
  demo, bloqueante para producción.
- **Sin adaptador real de WhatsApp.** Los mensajes son simulados; la capa de
  redacción ya está, falta el envío real contra WhatsApp Business.
- **Persistencia ligera.** El estado vive en localStorage, no en una base. Suficiente
  para una demo; un producto real necesitaría backend.

---

## Qué falta para que esto sea un producto

1. Autenticación y roles (recepción, odontólogo, gerencia).
2. Adaptador real de WhatsApp Business.
3. Importar los pacientes y la agenda reales de la clínica.
4. Backend de persistencia y, si el volumen crece, dejar de reconstruir la historia
   completa en cada movimiento del reloj.
