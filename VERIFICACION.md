# Verificación

Qué se comprobó, cómo, y qué quedó pendiente. Todo reproducible con los comandos
que aparecen aquí.

---

## 1 · Automática

```bash
npm test && npm run build
```

Cobertura del dominio y el runtime por suites:

| Suite | Qué cubre |
|---|---|
| `engine.test.ts` | Las reglas, idempotencia, bordes exactos, citas cerradas/recuperadas que no generan acciones. |
| `transiciones.test.ts` | Máquina de estados: cancelación, recuperación y transiciones ilegales rechazadas. |
| `lista-espera.test.ts` | Filtrado por tratamiento/odontólogo, ventana horaria, orden por antigüedad, primer candidato. |
| `cancelacion.test.ts` | Cancelación → oferta a lista de espera → recuperación (simulada y manual) → cierre. |
| `mundo.test.ts` | Reproducción: recordatorios solos, pacientes que confirman solos, determinismo al ir y volver. |
| `paciente-sim.test.ts` | Determinismo del id, reparto 62/13/25 (±10), más silencio con inasistencias previas. |
| `horario.test.ts` | El reloj nunca cae fuera del horario al avanzar; acota al rango de la demo. |
| `seed.test.ts` | 60 citas, horario respetado, teléfonos únicos, citas pasadas cerradas, determinismo. |
| `reloj-sentinel.test.ts` | Ningún archivo de `src/` lee la hora real del sistema. |
| `render.test.tsx` | Las cinco vistas montan y renderizan sin romperse. |

El centinela del reloj sigue siendo la prueba más importante: si alguien usa la
hora real, adelantar el reloj deja de tener efecto y la demo se rompe en silencio.

---

## 2 · Recorrido de la demo

```bash
npm run verificar
```

Ejecuta contra el runtime puro lo mismo que hará el evaluador en vivo:

```
1 · Punto de partida
2 · Avanzar 24 horas
3 · Avanzar 6 horas más
4 · Cancelar una cita y verla recuperarse
5 · Retroceder en el tiempo
6 · No hay duplicados
7 · Centro de operaciones prioriza acciones
8 · Laboratorios con alerta de retraso
```

---

## 3 · Recorrido manual recomendado

En `http://localhost:4321`, tras pulsar «Iniciar demostración»:

1. **Centro de operaciones** vacío al inicio. Pulsa **Avanzar 24 h** (o tecla `T`).
2. La cola de operaciones se carga con pacientes sin respuesta y
   reprogramaciones. Confirma alguna desde el botón «Confirmar».
3. **Agenda** → selecciona una cita confirmada → **Cancelar cita** (tecla `3`).
   Aparece el mensaje de oferta a la lista de espera.
4. Avanza 1-2 h. La cita pasa a **Recuperada** (azul). El Centro de operaciones
   registra la recuperación.
5. **Doctores** muestra el impacto de la cancelación sobre la jornada del doctor.
6. **Laboratorios** muestra los trabajos próximos a vencer y los retrasos.
7. Arrastra la línea de tiempo hacia atrás: todo vuelve a su estado anterior.

Atajos de teclado: `1`-`6` navegan dominios, `T` avanza 24 h, `Esc` limpia la
selección.

---

## Limitaciones conocidas

- **Diseño optimizado para escritorio.** Es una herramienta de mostrador; en
  móvil se ve pero no se pulió al mismo nivel.
- **Sin autenticación.** Cualquiera con la URL ve y opera todo. Deliberado para
  la demo, bloqueante para producción.
- **Sin adaptador real de WhatsApp.** Los mensajes son simulados; la capa de
  redacción ya está, falta el envío real contra WhatsApp Business.
- **Persistencia ligera.** El estado vive en localStorage, no en una base.
- **La lista de espera no se edita desde la UI.** Los candidatos vienen del
  seed; en un producto real se gestionarían desde recepción.

---

## Qué falta para que esto sea un producto

1. Autenticación y roles (recepción, odontólogo, gerencia).
2. Adaptador real de WhatsApp Business.
3. Importar los pacientes, doctores y la agenda reales de la clínica.
4. Backend de persistencia (FastAPI/Python si se necesita) y dejar de
   reconstruir la historia completa en cada movimiento del reloj.
5. Edición de la lista de espera y de los trabajos de laboratorio desde la UI.
