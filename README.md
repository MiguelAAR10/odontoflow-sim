# OdontoFlow

Confirmación automática de citas para clínicas odontológicas pequeñas.

El sistema envía los recordatorios, interpreta la respuesta del paciente, mueve el
estado de la cita y solo interrumpe a recepción cuando alguien deja de responder.

> App **full frontend**: cero base de datos, cero servidor. Todo corre en el
> browser. Se abre con `npm run dev` y listo.

---

## Qué es real y qué está simulado

Esta distinción importa, así que va primero.

| Pieza | Estado |
|---|---|
| Motor de reglas | **Real.** Función pura con tests, cubre idempotencia y bordes. |
| Estados y alertas | **Reales.** Se calculan al reproducir la historia. |
| Cálculo de riesgo | **Real.** Heurística explicable, no un modelo estadístico. |
| Línea de tiempo reversible | **Real.** El mundo se reconstruye desde el seed y se reproduce hasta el instante pedido. |
| Datos de pacientes | **De prueba.** 28 pacientes y 60 citas inventados. |
| Envío por WhatsApp | **Simulado.** Los mensajes viven en memoria y se muestran en la interfaz; no salen a ningún teléfono. |
| Respuestas de pacientes | **Simuladas.** Cada paciente "responde" al recordatorio de forma determinista, derivada de su id, para que la demo cuente la historia completa. |
| Reloj | **Virtual.** Lo mueves tú desde la línea de tiempo. |

La simulación de respuestas es una suposición razonable (62 % confirma, 13 % pide
cambio, 25 % no responde), no un dato medido. La interfaz lo dice con esas palabras.

---

## Arrancar

```bash
npm install
npm run dev         # http://localhost:4321
```

El estado de la demo se guarda en el navegador (localStorage): puedes preparar la
clínica en un punto, recargar y sigue ahí. `Reiniciar` la devuelve al inicio.

### Otros comandos

```bash
npm test            # 58 tests del dominio y el runtime
npm run build       # build de producción (typecheck + Vite)
npm run verificar   # recorrido de la demo de punta a punta, en consola
npm run typecheck   # solo TypeScript
```

---

## La demo en seis pasos

1. **Abre la aplicación.** El reloj marca el miércoles 12 de agosto, 09:15. Arriba,
   la plata en riesgo real.
2. **Arrastra la línea de tiempo** hacia la derecha, o pulsa `Avanzar 24 h` (tecla `T`).
   Los recordatorios salen solos y los pacientes empiezan a confirmar: el verde crece.
3. **Entra a Flujo.** Las tarjetas se deslizan de "Programada" a "Recordada" y a
   "Confirmada". Nadie llamó a nadie.
4. **Avanza otras 6 horas.** Quien no respondió cae en "Venció plazo" y aparece en
   Pendientes.
5. **Entra a Pendientes.** Una decisión en pantalla, con la conversación al lado.
   Pulsa `1` para responder como el paciente: la cita queda confirmada.
6. **Entra a Reglas**, cambia el primer recordatorio de 24 a 48 horas y guarda. La
   semana entera se recalcula. Es lo que demuestra que se adapta a cada clínica.

Arrastrar la línea de tiempo **hacia atrás** también funciona: el mundo se
reconstruye y se llega al mismo estado.

---

## Cómo está hecho

Capas, en orden de importancia, todas pururas menos la última.

**El motor** (`src/domain/engine.ts`) es una función pura: recibe el estado del
mundo y devuelve qué acciones tocan. No tiene efectos, no lee la hora. Ahí vive el
valor del producto y por eso es lo más testeado.

**El runtime** (`src/runtime/`) reproduce el mundo y arma el snapshot:
- `mundo.ts` — `reproducir(cat, eventos, reglas, target)`: reconstruye desde el seed
  y aplica el motor, las acciones del recepcionista y las respuestas simuladas hasta
  el instante pedido. Determinista: pasar dos veces por el mismo momento da el mismo
  estado.
- `snapshot.ts` — `buildSnapshot(mundo, cat, reglas)`: el estado listo para pintar.
- `horario.ts` — el reloj no cae fuera del horario de atención al avanzar.

**El dominio** (`src/domain/`): motor, riesgo, transiciones, redacción de mensajes,
el seed determinista y la simulación de pacientes.

**La interfaz** (`src/store/` + `src/components/`): el estado vive en React
(`OdontoStore`), persistido en localStorage. El mundo y el snapshot se derivan con
`useMemo`. Los componentes solo dibujan.

### Estados de una cita

```
scheduled → reminded → confirmed → completed
                    ↘ reschedule_requested → scheduled
                    ↘ no_response → confirmed | no_show
```

Las transiciones no contempladas lanzan error en vez de corromper datos
(`src/domain/transitions.ts`).

### Stack

Vite · React 19 · TypeScript estricto · Tailwind 4 · Vitest. Tipografía Space
Grotesk (display), DM Sans (cuerpo) y JetBrains Mono (datos).

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
