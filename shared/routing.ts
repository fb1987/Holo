import type { ModelOption, Station } from "./types.js";

export interface ModelRoute {
  model?: string;
  effort?: string;
}
export type TeamRoutes = Record<Station, ModelRoute>;
export function supportedEffort(
  model: ModelOption | undefined,
  requested = "high",
) {
  const efforts = model?.supportedReasoningEfforts;
  return !efforts?.length ||
    efforts.some((e) => e.reasoningEffort === requested)
    ? requested
    : model?.defaultReasoningEffort || efforts[0].reasoningEffort;
}
/** Explicit selection applies to the whole team; automatic selection uses domain roles. */
export function teamRoutes(
  models: ModelOption[],
  model?: string,
  effort = "high",
): TeamRoutes {
  const fallback = models.find((m) => m.isDefault) || models[0];
  const pick = (...ids: string[]) =>
    ids.map((id) => models.find((m) => m.id === id)).find(Boolean) || fallback;
  const planner = model ? pick(model) : pick("gpt-6-astra");
  const builder = model ? planner : pick("gpt-5.6-luna", "gpt-5.6-sol");
  const planning = {
    model: planner?.id,
    effort: supportedEffort(planner, model ? effort : "high"),
  };
  const execution = {
    model: builder?.id,
    effort: supportedEffort(builder, effort),
  };
  return {
    planning,
    design: execution,
    electronics: execution,
    software: execution,
  };
}
export function previewRoute(models: ModelOption[]): ModelRoute | undefined {
  // Never fall back to an expensive frontier model for optional, disposable work.
  const model = models.find((m) => m.id === "gpt-5.6-luna");
  return model
    ? { model: model.id, effort: supportedEffort(model, "low") }
    : undefined;
}
