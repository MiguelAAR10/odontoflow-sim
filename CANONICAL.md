# odontoflow-sim — canonical status and boundaries

> This file and the synthetic-boundary repair are the **only** things added after
> promotion. Every other file in this repository is the contributors', and every
> commit below the first canonical one is theirs.

## Authorship

**This codebase was written by Alejandro Marcelo and Leonardo Panduro.**

| Author | Commits |
|---|---|
| **Alejandro Jesus Marcelo CH** (`AlejandroMarceloCh`) | 6 of 7 |
| **Leonardo Panduro** (`leonardopanduro-rgb`) | 1 — `333af34`, "feat: ampliar demo operativa de OdontoFlow" |

It is a **shared codebase**, not one person's. All 7 commits are preserved
intact — never squashed, never rebased, never force-pushed.

- Contributor upstream: https://github.com/AlejandroMarceloCh/odontoflow (remote `alejandro`)
- Donor HEAD at promotion: `b57f7bc6b1eca84a132b61a11ca687bbd5b5e58e` (branch `master`)
- Canonical remote: `git@github.com:MiguelAAR10/odontoflow-sim.git` (remote `origin`, private)

**Do not attribute this code to a later author or agent.** Provenance record:
`odontoflow-planning/CONTRIBUTIONS.md` (Contribution 3).

Note the rename: the contributors' repository is called `odontoflow`, but it is
a **simulator**, not the product. Hence `odontoflow-sim`.

## Role

**Canonical synthetic clinic / ground-truth simulator.** A sibling repository:
its own stack (Vite · React 19 · TypeScript · Tailwind 4 · Vitest), its own
process, zero backend and zero database. Not a submodule of anything.

Workspace: `~/projects/portfolio/AI-EdgeRunners/odontoflow/`
(`odontoflow-planning` · `odontoflow-backend` · `odontoflow-frontend` ·
`odontoflow-voice` · this repo)

## Data classification — SYNTHETIC ONLY

**Every dataset here is invented.** Patients, doctors, treatments, prices,
appointments, waitlist candidates, laboratories, lab jobs, and the patient
behaviour probabilities. None of it is evidence about any real clinic, and none
of it may ever be recorded as such.

| Dataset | Volume |
|---|---|
| Patients | 28 (invented names) |
| Doctors | 4 |
| Treatments | 10, with invented prices |
| Appointments | 60 |
| Waitlist candidates | 5 |
| Laboratories / lab jobs | 3 / 6 |
| Behaviour split | ~62 % confirm · 13 % reschedule · 25 % silence — a **declared assumption**, not a measurement |

**Never promote these into canonical clinic data.** The real catalog comes from
the clinic's tariff sheet. This applies with particular force to
`src/domain/seed.ts`: it is the default **scenario**, not a patient list.

`CONTEO_PREVIO`-style placeholders do not exist here, but note the equivalent
trap: the simulator's `previousNoShows` values are fixed in the seed so risk is
reproducible. They are not history.

### The synthetic boundary is structural, not a convention

`src/components/BandaSintetica.tsx` renders a permanent, non-dismissible band —
**«CLÍNICA SINTÉTICA · DATOS SIMULADOS · NO SON DATOS REALES»** — mounted in the
station shell's sticky header, outside the view switch. It is therefore present
on every view, at every scroll position, on desktop and mobile, with no way to
turn it off.

**Why it is a component with its own sentinel tests.** The README used to claim
the whole interface was labelled synthetic; commit `b57f7bc` removed exactly
those labels (14 deletions across the welcome screen, the shell — desktop *and*
mobile — and the activity view), and **no test noticed**. The README then
asserted something false, and a screenshot of the simulator became
indistinguishable from a real clinic's.

`tests/banda-sintetica.test.tsx` exists so that cannot happen twice. It asserts
the wording, the accessible announcement, the absence of any dismiss control,
the absence of responsive display toggles, and — in the spirit of the authors'
own `reloj-sentinel.test.ts` — that the band is mounted **unconditionally**,
**outside** the view switch, **inside** the sticky header, and that no view is
rendered by some parallel shell that would escape it.

**Do not remove or condition that band.** If the design needs to change, change
its appearance; do not weaken its coverage.

## What this repository must NOT do

It produces **synthetic ground truth** for measurement. It is **not** a business
authority and must never directly create:

`Visit` · `ServiceExecution` · `ServiceConsumption` · `Charge` · `Payment` · `InventoryMovement`

The canonical OdontoFlow backend remains the **only** business authority. Stock
truth is `inventory_movements`; money truth is `charges` / `payments`.

**As of V2.1 there is no integration at all** — no FastAPI connection, no intent
adapter, no canonical appointment states, no waitlist or laboratory tables, no
voice vocabulary, no UI ported to the canonical frontend, no agents, no
WhatsApp. The intended architecture, when authorised:

```
scenario → this simulator → synthetic ground truth
                                    ↓
                          FastAPI intent adapter
                                    ↓
                           canonical OdontoFlow
                                    ↓
                             observed state → evaluator
```

Canonical never sees ground truth; it only ever receives **intents** through the
adapter, exactly as it would receive requests from a real clinic. The evaluator
compares the two, and the gap is the measurement. The first requirement for any
of that is not code — it is giving the simulator a **principal** (PF2/PF3).

Map and revised order:
`odontoflow-planning/SYNTHETIC_CLINIC_CONTRIBUTION_MAP.md`.

## Preserved assets — do not refactor for style

These carry the contribution's value and its tests. Change them only for a
stated functional reason:

`src/domain/` (engine, transitions, risk, waitlist, rescheduling, channel,
patient simulation, seed) · `src/runtime/` (world replay, snapshot, schedule,
next event) · `src/store/` · `src/components/` · `scripts/verificar.ts` ·
`README.md` · `VERIFICACION.md` · `tests/`

**Two properties are load-bearing and must survive every future change:**

1. **Determinism.** Behaviour derives from hashed ids, never from `Math.random` or system dates. The timeline can be dragged backwards and the same instant must always rebuild the same world.
2. **The clock sentinel.** `tests/reloj-sentinel.test.ts` (32 assertions) fails if *any* file under `src/` reads real time. The authors' reasoning: if someone uses the system clock, advancing the virtual clock silently stops working and the simulation breaks with no error. **Keep it.**

## Verified baseline

Before the V2.1 boundary repair, on the contributors' own contract:

```bash
npm install
npm run typecheck   # clean
npm test            # 98 passed / 11 files
npm run build       # PASS
npm run verificar   # "Recorrido completo sin fallos" (8 steps)
```

After the repair, the same contract plus the new boundary tests. Current
numbers are in `odontoflow-planning/STATUS.md` and in the V2.1 handoff,
`odontoflow-planning/docs/handoffs/plans/2026-09-03-v2-1-simulator-promotion.md`.

## Known limitations — the authors' own, not hidden

- **No authentication.** Anyone with the URL sees and operates everything. Deliberate for a demo, blocking for production.
- **Light persistence.** State lives in `localStorage`, not a database.
- **Desktop-optimised.** It works on mobile but was not polished to the same level.
- **No real messaging channel.** Messages are simulated; the drafting layer exists, the sending does not.
- **The waitlist is not editable from the UI.** Candidates come from the seed.

## Related

- Provenance and credit: `odontoflow-planning/CONTRIBUTIONS.md`
- Fan-in map and revised V2 order: `odontoflow-planning/SYNTHETIC_CLINIC_CONTRIBUTION_MAP.md`
- Leonardo's visual baseline (a **different** visual lineage from this repo's dark workstation): `odontoflow-planning/VISUAL_BASELINE.md`
- Repository map: `odontoflow-planning/REPOSITORIES.md`
