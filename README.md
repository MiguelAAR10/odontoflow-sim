# OdontoFlow

Plataforma de automatización operativa para clínicas odontológicas. Toma los
eventos de la clínica —una cita programada, una confirmación, una falta de
respuesta, una cancelación— y los convierte en acciones automáticas y tareas
claras para el equipo.

> App **full frontend**: cero base de datos, cero servidor. Todo corre en el
> browser. Se abre con `npm run dev` y listo.

---

## Qué se ve

La demo está organizada por **dominios**, no por herramientas:

- **Centro de operaciones** — responde «¿qué necesita atención hoy?» con una
  cola de trabajo priorizada: espacios recuperables, pacientes sin respuesta,
  reprogramaciones pendientes, cambios que afectan la agenda de un doctor,
  trabajos de laboratorio próximos a vencer y acciones para recepción. Las
  métricas (agenda confirmada, citas recuperadas, tasa de respuesta, espacios
  disponibles) son secundarias y compactas.
- **Agenda** — tablero por estados (Programada, Recordatorio enviado,
  Confirmada, Plazo vencido, Recuperada, Cancelada). Al seleccionar una cita,
  aparece su conversación y las acciones disponibles, incluida la cancelación.
- **Pacientes** — directorio con teléfono, próxima cita, historial de
  inasistencias y marca de lista de espera.
- **Doctores** — quién atiende hoy, qué días atiende cada doctor, su agenda del
  día y el impacto de cancelaciones sobre su jornada. Destaca a los doctores
  que solo atienden determinados días.
- **Laboratorios** — seguimiento sencillo de trabajos enviados: paciente,
  tratamiento, laboratorio, fecha de envío, fecha prometida, estado,
  responsable y alerta de retraso automática.
- **Configuración** — parámetros del sistema (horas de recordatorio, plazo de
  respuesta, horario de la clínica).

---

## El flujo central: gestión de citas

1. Se programa un recordatorio (24 h antes por defecto).
2. El paciente puede **confirmar**, **reprogramar**, **no responder** o **cancelar**.
3. El sistema reacciona:
   - **Confirmar** → la cita queda confirmada sola.
   - **Reprogramar** → se ofrece horario y se genera una tarea para recepción.
   - **No responder** → segundo intento y, si sigue el silencio, una tarea para
     recepción.
   - **Cancelar** → se libera el espacio, se buscan candidatos en la lista de
     espera, se les envía una oferta y, cuando uno acepta, la cita se
     **recuperada**.

Avanzando el reloj virtual con «Avanzar 24 h» se ve todo esto pasar en vivo.

---

## Qué es real y qué está simulado

Esta distinción importa, así que va primero. Toda la interfaz lleva la etiqueta
visible **«Datos ficticios de demostración»**.

| Pieza | Estado |
|---|---|
| Motor de reglas | **Real.** Función pura con tests, cubre idempotencia y bordes. |
| Estados, alertas y cola de operaciones | **Reales.** Se calculan al reproducir la historia. |
| Cálculo de riesgo | **Real.** Heurística explicable, no un modelo estadístico. |
| Lista de espera y recuperación de huecos | **Real.** Lógica determinista de oferta y aceptación. |
| Línea de tiempo reversible | **Real.** El mundo se reconstruye desde el seed y se reproduce hasta el instante pedido. |
| Datos de pacientes, doctores y citas | **De prueba.** 28 pacientes, 4 doctores y 60 citas inventados. |
| Envío por WhatsApp | **Simulado.** Los mensajes viven en memoria y se muestran en la interfaz; no salen a ningún teléfono. |
| Respuestas de pacientes | **Simuladas.** Cada paciente "responde" al recordatorio de forma determinista, derivada de su id. |
| Aceptación de la lista de espera | **Simulada.** El primer candidato compatible acepta tras un lapso fijo. |
| Datos de laboratorios | **De prueba.** Laboratorios, plazos y responsables inventados. |
| Reloj | **Virtual.** Lo mueves tú desde la línea de tiempo. |

No se afirma conocer procesos internos de ninguna clínica real. Los procesos y
porcentajes son suposiciones razonables para la demo, no datos medidos.

---

## Arrancar

```bash
npm install
npm run dev         # http://localhost:4321
```

El estado de la demo se guarda en el navegador (localStorage): puedes preparar
la clínica en un punto, recargar y seguir ahí. `Reiniciar` la devuelve al inicio.

### Otros comandos

```bash
npm test            # tests del dominio y el runtime
npm run build       # build de producción (typecheck + Vite)
npm run verificar   # recorrido de la demo de punta a punta, en consola
npm run typecheck   # solo TypeScript
```

---

## La demo en cinco pasos

1. **Abre la aplicación.** Lee la pantalla de inicio: qué hace OdontoFlow y qué
   vas a ver.
2. **Entra al Centro de operaciones.** Al inicio la cola está vacía: nada
   requiere atención.
3. **Pulsa «Avanzar 24 h».** Los recordatorios salen solos y los pacientes
   empiezan a confirmar. La cola de operaciones se carga con lo que necesita
   atención.
4. **Entra a la Agenda**, selecciona una cita confirmada y pulsa «Cancelar
   cita». El sistema libera el espacio y ofrece el hueco a la lista de espera.
   Avanza 1-2 h: la cita queda **recuperada**.
5. **Entra a Doctores** para ver el impacto de la cancelación sobre la jornada,
   y a **Laboratorios** para ver los trabajos próximos a vencer.

Arrastrar la línea de tiempo **hacia atrás** también funciona: el mundo se
reconstruye y se llega al mismo estado.

---

## Cómo está hecho

Capas, en orden de importancia, todas puras menos la última.

**El motor** (`src/domain/engine.ts`) es una función pura: recibe el estado del
mundo y devuelve qué acciones tocan. No tiene efectos, no lee la hora.

**El dominio** (`src/domain/`): motor, riesgo, transiciones, redacción de
mensajes, lista de espera, el seed determinista y la simulación de pacientes.

**El runtime** (`src/runtime/`): reproduce el mundo y arma el snapshot.
- `mundo.ts` — `reproducir(cat, eventos, reglas, target)`: reconstruye desde el
  seed y aplica el motor, las acciones del recepcionista, las cancelaciones con
  recuperación y las respuestas simuladas hasta el instante pedido.
- `snapshot.ts` — `buildSnapshot(mundo, cat, reglas)`: el estado listo para
  pintar, incluidos doctores, pacientes, lista de espera y laboratorios.
- `horario.ts` — el reloj no cae fuera del horario de atención al avanzar.

**La interfaz** (`src/store/` + `src/components/`): el estado vive en React
(`OdontoStore`), persistido en localStorage. El mundo y el snapshot se derivan
con `useMemo`. Los componentes solo dibujan.

### Estados de una cita

```
scheduled → reminded → confirmed → completed
                    ↘ reschedule_requested → scheduled
                    ↘ no_response → confirmed | no_show
cualquier activo → cancelled → recovered → completed
```

Las transiciones no contempladas lanzan error en vez de corromper datos
(`src/domain/transitions.ts`).

### Stack

Vite · React 19 · TypeScript estricto · Tailwind 4 · Vitest. Tipografía Plus
Jakarta Sans (display/cuerpo) y JetBrains Mono (datos).

---

## Diseño

Estación de trabajo empresarial, no landing: fondo carbón en la cabecera y la
navegación, superficies claras en el área de trabajo. Azul como acento
funcional (CTA principal, nav activo, foco, citas recuperadas). Estados
reconibles con etiqueta escrita: confirmado (verde), pendiente (ámbar), riesgo
(vino), cancelado (gris) y recuperado (azul).

Todo dato numérico va en monospace para que las columnas alineen.

---

## Fuera de alcance

Historia clínica, facturación, inventario, compras, proveedores, autenticación,
roles y permisos, pagos y subida de archivos. La gestión clínica real no está
en el alcance de esta demo.
