import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PreviewManager } from "../server/preview.js";
import { teamRoutes, previewRoute } from "../shared/routing.js";
import type { AgentRuntime, AgentRunOptions } from "../server/codex.js";
import type { ModelOption, Project, StudioEvent } from "../shared/types.js";

const models: ModelOption[] = [
  "gpt-6-astra",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
].map((id) => ({
  id,
  displayName: id,
  isDefault: id === "gpt-6-astra",
  defaultReasoningEffort: "low",
  supportedReasoningEfforts: [
    { reasoningEffort: "low" },
    { reasoningEffort: "high" },
  ],
}));
test("automatic team routes planning high and execution at selected effort; manual overrides and availability fallback are explicit", () => {
  assert.deepEqual(teamRoutes(models, undefined, "low").planning, {
    model: "gpt-6-astra",
    effort: "high",
  });
  assert.deepEqual(teamRoutes(models, undefined, "low").design, {
    model: "gpt-5.6-luna",
    effort: "low",
  });
  assert.deepEqual(teamRoutes(models).software, {
    model: "gpt-5.6-luna",
    effort: "high",
  });
  assert.deepEqual(teamRoutes(models, "gpt-5.6-sol", "low").planning, {
    model: "gpt-5.6-sol",
    effort: "low",
  });
  assert.equal(
    teamRoutes(models.filter((m) => m.id !== "gpt-5.6-luna")).design.model,
    "gpt-5.6-sol",
  );
  assert.equal(
    previewRoute(models.filter((m) => m.id !== "gpt-5.6-luna")),
    undefined,
  );
  assert.equal(
    teamRoutes([
      { ...models[1], supportedReasoningEfforts: [{ reasoningEffort: "low" }] },
    ]).design.effort,
    "low",
  );
});
const wire = JSON.stringify({
  dimensions: [100, 100, 100],
  color: "#2288cc",
  parts: [
    {
      name: "Body",
      shape: "box",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [100, 100, 100],
      color: "#2288cc",
    },
  ],
});
class DraftRuntime extends EventEmitter implements AgentRuntime {
  calls: AgentRunOptions[] = [];
  completions: Array<(text: string) => void> = [];
  status() {
    return {
      available: true,
      authenticated: true,
      connected: true,
      tools: { blender: false, kicad: false, python: false },
    };
  }
  async connect() {
    return this.status();
  }
  async models() {
    return models;
  }
  async login() {
    return {};
  }
  run(o: AgentRunOptions) {
    this.calls.push(o);
    return new Promise<string>((resolve) => this.completions.push(resolve));
  }
  respond() {}
  reject() {}
  async close() {}
}
function fixture() {
  const rt = new DraftRuntime(),
    events: StudioEvent[] = [];
  const pm = new PreviewManager(rt, (e) => events.push(e));
  const project = { id: "project", scene: { kind: "plasma" } } as Project;
  const start = (
    job: string,
    stage: "sketch" | "concept",
    signal = new AbortController().signal,
  ) =>
    pm.generate(
      project,
      job,
      "/tmp/isolated-workspace",
      "test",
      stage,
      previewRoute(models)!,
      signal,
    );
  return { rt, pm, events, project, start };
}
test("drafts never mutate the project and stopped jobs cannot resurrect previews", async () => {
  const { rt, pm, project, start, events } = fixture();
  const original = JSON.stringify(project);
  pm.begin(project.id, "one");
  const promise = start("one", "sketch");
  assert.equal(rt.calls[0].readOnly, true);
  assert.equal(rt.calls[0].ephemeral, true);
  rt.completions[0](wire);
  await promise;
  assert.equal(pm.list()[0].stage, "sketch");
  assert.equal(JSON.stringify(project), original);
  const next = start("one", "concept");
  pm.stop(project.id);
  rt.completions[1](wire);
  await next;
  assert.deepEqual(pm.list(), []);
  assert.equal(events.at(-1)?.type, "preview");
  assert.equal((events.at(-1) as any).preview, null);
});
test("refinement wins even if the rough sketch finishes late and replaced jobs stay discarded", async () => {
  const { rt, pm, project, start } = fixture();
  pm.begin(project.id, "old");
  const rough = start("old", "sketch");
  const refined = start("old", "concept");
  assert.equal(rt.calls[0].signal?.aborted, true);
  rt.completions[1](wire);
  await refined;
  rt.completions[0](wire);
  await rough;
  assert.equal(pm.list()[0].stage, "concept");
  const late = start("old", "concept");
  pm.begin(project.id, "new");
  rt.completions[2](wire);
  await late;
  assert.deepEqual(pm.list(), []);
});
test("malformed or cancelled refinement preserves the earlier usable sketch until the job ends", async () => {
  const { rt, pm, project, start } = fixture();
  pm.begin(project.id, "one");
  const rough = start("one", "sketch");
  rt.completions[0](wire);
  await rough;
  const failed = start("one", "concept");
  rt.completions[1]("{bad");
  await failed;
  assert.equal(pm.list()[0].stage, "sketch");
  const controller = new AbortController();
  const cancelled = start("one", "concept", controller.signal);
  controller.abort();
  rt.completions[2](wire);
  await cancelled;
  assert.equal(pm.list()[0].stage, "sketch");
  pm.stop(project.id);
});
