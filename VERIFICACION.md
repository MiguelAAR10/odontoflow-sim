# Verificación

Qué se comprobó, cómo, y qué queda pendiente. Todo reproducible con los comandos
que aparecen aquí.

---

## 1 · Automática

```bash
rm -f odontoflow.db* && npm run db:seed && npm test && npm run build
```

**Resultado: 70 tests en verde, build sin errores ni avisos de TypeScript.**

| Suite | Qué cubre |
|---|---|
| `engine.test.ts` (20) | Las cinco reglas, idempotencia, bordes exactos (23 h 59 vs 24 h 01), citas cerradas que no generan acciones. |
| `executor.test.ts` (19) | Integración contra la base: recordatorios, respuestas, alertas, tiempo hacia atrás, transiciones ilegales. |
| `seed.test.ts` (11) | 60 citas, cero solapamientos por odontólogo, horario respetado, teléfonos únicos, determinismo. |
| `clock-sentinel.test.ts` (20) | Ningún archivo fuera de `clock.ts` y `seed.ts` lee la hora real del sistema. |

El centinela del reloj es el más importante: si alguien usa `new Date()` en la
lógica, adelantar el tiempo deja de tener efecto y la demo se rompe en silencio.

---

## 2 · Recorrido de la demo

```bash
npm run verificar
```

Ejecuta contra la base lo mismo que hará el evaluador en vivo:

```
1 · Punto de partida        45 citas vivas · S/ 13,080 agendados
2 · Avanzar 24 horas        16 recordatorios · S/ 8,870 esperando
3 · Avanzar 6 horas más      4 piden decisión · S/ 1,230 en riesgo
4 · Responder como paciente  Rocío Chumpitaz quedó confirmada, con acuse y alerta resuelta
5 · Retroceder en el tiempo  el pasado vuelve a su estado original e ir y volver reproduce el mismo mundo
6 · No hay duplicados        ningún recordatorio se envió dos veces
```

**Resultado: recorrido completo sin fallos.**

---

## 3 · Interfaz, mirada de verdad

Capturas con Chrome headless sobre la aplicación corriendo.

| Vista | Qué se confirmó |
|---|---|
| **Ingresos** | Cifra dominante, tabla ordenada por riesgo × monto con el motivo de cada una, composición filtrable, recuperado por el sistema. |
| **Flujo** | Cuatro carriles con datos reales, monto por carril, barra de espera hacia el plazo de 6 h. |
| **Pendientes** | Una decisión en pantalla ("decisión 1 de 4"), hechos del caso, sugerencia del sistema, atajos de teclado y la conversación real al lado. |
| **Reglas** | Campos con etiqueta visible y ayuda, botones inhabilitados mientras no hay cambios. |
| **375 / 390 px** | Sin scroll horizontal; barra de estado, cifra y tabla caben y se leen. |

### Dos fallos encontrados y corregidos

**El seed dejaba el mundo sin procesar.** Las citas de hoy aparecían como "aún
fuera de la ventana de recordatorio" cuando ya tocaba avisarles, porque el motor
no había corrido nunca. Ahora la página ejecuta el motor una vez sobre el instante
inicial para que el punto de partida sea coherente.

**Una respuesta tardía rompía el sistema.** Si el paciente contestaba después de
que su cita ya había pasado, la transición `no_show → confirmed` lanzaba error.
Pasa en la vida real. Ahora se ignora la respuesta en vez de reventar, y hay un
test que lo cubre.

---

## Limitaciones conocidas

- **El móvil es secundario.** Por debajo de 390 px la columna de monto de la tabla
  de riesgo queda apretada. La herramienta es de mostrador y se usa en pantalla
  grande; se decidió no seguir invirtiendo ahí.
- **Las tipografías dependen del sistema.** Futura y Avenir Next vienen con macOS.
  En Windows o Linux se cae a los respaldos y el registro cambia. Si el proyecto
  sigue, hay que empaquetar la tipografía como archivo propio.
- **`user_events` crece sin límite.** No importa en una demo, pero un uso real
  necesitaría compactar la historia periódicamente.
- **Sin autenticación.** Cualquiera con acceso a la URL ve y opera todo. Es
  deliberado para la demo y bloqueante para producción.

---

## Qué falta para que esto sea un producto

1. Autenticación y roles (recepción, odontólogo, gerencia).
2. Adaptador real de WhatsApp Business — la interfaz ya existe, falta la
   implementación y la verificación de número con Meta.
3. Importar los pacientes y la agenda reales de la clínica.
4. Persistencia de la historia en vez de reconstrucción, cuando el volumen crezca.
