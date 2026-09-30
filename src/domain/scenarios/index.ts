import type { ScenarioDefinition } from "@/domain/scenario";
import { baselineScenario } from "./baseline";
import { noShowHeavyScenario } from "./no-show-heavy";
import { cancellationRecoveryScenario } from "./cancellation-recovery";

export { baselineScenario, noShowHeavyScenario, cancellationRecoveryScenario };

/** Registro de escenarios con nombre. `baseline` es siempre el default. */
export const SCENARIOS: Record<string, ScenarioDefinition> = {
  baseline: baselineScenario,
  "no-show-heavy": noShowHeavyScenario,
  "cancellation-recovery": cancellationRecoveryScenario,
};

export const DEFAULT_SCENARIO_ID = "baseline";

export function listScenarios(): ScenarioDefinition[] {
  return Object.values(SCENARIOS);
}

export function getScenario(id: string): ScenarioDefinition {
  return SCENARIOS[id] ?? SCENARIOS[DEFAULT_SCENARIO_ID];
}
