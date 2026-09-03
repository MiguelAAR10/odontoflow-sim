# odontoflow-sim — DEVELOPMENT

## Qué es este repo

**El simulador de clínica sintética de OdontoFlow.** Codebase compartido:
**Alejandro Marcelo** (6 commits) y **Leonardo Panduro** (1 commit,
`333af34`) — todos preservados intactos debajo de este archivo. Motor
puramente determinista: reloj virtual, línea de tiempo reversible, cero base
de datos, cero conexión con el backend canónico.

**Estado verificado (2026-09-03):** 109 tests PASS en el último commit
(`da203a9`). Detalle en `CANONICAL.md` de este repo y en
`odontoflow-planning/SYNTHETIC_CLINIC_CONTRIBUTION_MAP.md`.

> **Nota de estado:** ahora mismo hay trabajo adicional en curso (V2.2 —
> Scenario Configuration) sentado en el árbol de trabajo local, con 150 tests
> pasando pero **todavía sin commitear**. Si tú tienes acceso a esta máquina,
> revisa `git status` antes de empezar algo nuevo. El living brief de esa
> actividad está en
> `odontoflow-planning/docs/handoffs/plans/2026-09-03-v2-2-named-scenario-configuration.md`.

## Función de desarrollo

Este NO es el producto — es un **motor de verdad sintética** para poder
medir, en el futuro, si el backend real detectaría un problema (por ejemplo,
inasistencias) si existiera. La arquitectura objetivo, todavía sin construir:

```
escenario → este simulador → verdad sintética
                                    ↓
                          adaptador de intents (FastAPI)
                                    ↓
                           OdontoFlow canónico
                                    ↓
                             estado observado → evaluador
```

El canónico nunca debe ver la verdad sintética directamente — solo intents,
como si vinieran de una clínica real.

## Cómo arrancar

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # 109 (o 150 con V2.2 sin commitear)
npm run verificar    # recorrido de 8 pasos, debe terminar "sin fallos"
```

## La frontera de datos sintéticos — no la debilites nunca

La interfaz lleva una banda permanente y no descartable:
**«CLÍNICA SINTÉTICA · DATOS SIMULADOS · NO SON DATOS REALES»**, montada en
`src/components/BandaSintetica.tsx`, vigilada por
`tests/banda-sintetica.test.tsx`. Existe porque un commit anterior (`b57f7bc`)
quitó las etiquetas originales sin que ningún test se diera cuenta, y una
captura de pantalla dejó de distinguirse de una clínica real. Cualquier
feature nueva que haga el escenario editable (como V2.2) tiene que mantener
esta banda visible en todas las vistas.

## El centinela del reloj — no lo rompas

`tests/reloj-sentinel.test.ts` falla si CUALQUIER archivo bajo `src/` usa
`new Date()` sin argumentos o `Date.now()`. Es la propiedad más importante del
simulador: si algo lee la hora real, adelantar el reloj virtual deja de tener
efecto y la demo se rompe en silencio.

## Datos — todo es sintético, sin excepción

28 pacientes, 4 doctores, 10 tratamientos, 60 citas: todos inventados. Las
probabilidades de comportamiento (~62% confirma / 13% reprograma / 25%
silencio) son una **suposición declarada, no una medición**. Nada de esto
puede convertirse jamás en dato real de clínica — ver `CANONICAL.md` para el
detalle completo.

## Lo que falta construir, en orden

1. Convertir la semilla fija en escenarios con nombre editables (V2.2, en
   curso — ver la nota de estado arriba).
2. Unir el vocabulario de alias de `odontoflow-voice` al catálogo de
   escenarios.
3. Definir el vocabulario de intents y darle a este simulador un Principal
   real en el backend (el requisito previo a cualquier escritura).
4. Construir el adaptador — primero en modo ensayo (solo registra qué
   enviaría, no envía nada).
5. Construir el evaluador — recién ahí este simulador empieza a producir
   valor medible.

No saltes al paso 4 o 5 sin haber completado el 3 — es la garantía de que
esto nunca se convierte en una segunda fuente de verdad de negocio.
