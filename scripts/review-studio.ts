/** Isolated, deterministic UI fixture. Never connects to Codex or production data. */
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { createStudioServer } from "../server/index.js";
import type { AgentRuntime, AgentRunOptions } from "../server/codex.js";
import { previewSchema } from "../server/preview.js";
const dimensions = [350, 420, 280];
const blue = "#286dc4";
const parts = [
  { name: "Base", shape: "box", position: [0, -200, 0], size: [330, 20, 260] },
  { name: "Front", shape: "box", position: [0, 0, 125], size: [330, 400, 10] },
  { name: "Back", shape: "box", position: [0, 0, -125], size: [330, 400, 10] },
  { name: "Left", shape: "box", position: [-160, 0, 0], size: [10, 400, 250] },
  { name: "Right", shape: "box", position: [160, 0, 0], size: [10, 400, 250] },
].map((p) => ({ ...p, rotation: [0, 0, 0], color: blue }));
const wire = previewSchema.parse({ dimensions, color: blue, parts });
const scene = {
  kind: "custom",
  color: blue,
  width: 350,
  height: 420,
  depth: 280,
  parts: wire.parts.map((p, i) => ({
    ...p,
    id: `part-${i}`,
    domain: "mechanical",
    description: p.name,
  })),
};
const output = (extra = {}) =>
  JSON.stringify({
    response:
      "**UI test fixture.** This is simulated work for interface review, not generated engineering output.",
    summary: "Updated the review fixture.",
    name: null,
    description: null,
    affected: [],
    goals: null,
    constraints: null,
    scene: null,
    parts: null,
    decisions: [],
    recommendations: [],
    artifacts: [],
    ...extra,
  });
class ReviewRuntime extends EventEmitter implements AgentRuntime {
  status() {
    return {
      available: true,
      connected: true,
      authenticated: true,
      model: "gpt-6-astra",
      tools: { blender: false, kicad: false, python: false },
    };
  }
  async connect() {
    return this.status();
  }
  async models() {
    return ["gpt-6-astra", "gpt-5.6-luna"].map((id) => ({
      id,
      displayName: id,
      isDefault: id === "gpt-6-astra",
      supportedReasoningEfforts: [
        { reasoningEffort: "low" },
        { reasoningEffort: "high" },
      ],
    }));
  }
  async login() {
    return {};
  }
  async run(o: AgentRunOptions) {
    await o.onThread(o.threadId || `review-${path.basename(o.cwd)}`);
    o.onEvent("item/agentMessage/delta", {
      phase: "commentary",
      delta:
        "**Review fixture:** preparing the next visible step.\n\n- Reading the brief\n- Checking the silhouette",
    });
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(t);
        reject(new Error("Cancelled"));
      };
      const t = setTimeout(
        () => {
          o.signal?.removeEventListener("abort", onAbort);
          resolve();
        },
        o.readOnly
          ? 700
          : path.basename(o.cwd) === "planning"
            ? 1800
            : Number(process.env.HOLO_REVIEW_DELAY || 12000),
      );
      if (o.signal?.aborted) onAbort();
      else o.signal?.addEventListener("abort", onAbort, { once: true });
    });
    if (o.readOnly) return JSON.stringify(wire);
    return path.basename(o.cwd) === "planning"
      ? output({
          affected: ["design"],
          name: process.env.HOLO_REVIEW_RECIPE
            ? `Interface review · ${process.env.HOLO_REVIEW_RECIPE}`
            : "Interface review · Recycling bin",
          ...(process.env.HOLO_REVIEW_RECIPE
            ? {
                deliverable: "model",
                designRequest: {
                  recipe: process.env.HOLO_REVIEW_RECIPE,
                  version: "1.0.0",
                  parameters: [],
                  bodyColor:
                    process.env.HOLO_REVIEW_RECIPE === "paneled-ball"
                      ? "#ffffff"
                      : blue,
                  accentColor: "#111111",
                  outputs: ["glb", "stl"],
                },
              }
            : {}),
        })
      : output({ scene });
  }
  respond() {}
  reject() {}
  async close() {}
}
const dir = await mkdtemp("/tmp/holo-ui-review-");
const studio = await createStudioServer({
  dataDir: dir,
  runtime: new ReviewRuntime(),
});
await studio.store.create({
  name: "Interface review · An intentionally long project title for testing",
});
const server = await studio.listen(4319);
console.log(
  JSON.stringify({
    url: "http://127.0.0.1:4319",
    dataDir: dir,
    pid: process.pid,
  }),
);
const close = async () => {
  await studio.close();
  await rm(dir, { recursive: true, force: true });
  process.exit(0);
};
process.once("SIGTERM", close);
process.once("SIGINT", close);
