import path from "node:path";
import { z } from "zod";
import type { ConceptPreview, Project, StudioEvent } from "../shared/types.js";
import type { AgentRuntime } from "./codex.js";
import type { ModelRoute } from "../shared/routing.js";
import { codexCompatibleSchema } from "./schema.js";

const scalar = z.number().finite().min(-5000).max(5000);
const vec = z.tuple([scalar, scalar, scalar]);
const size = z.tuple([
  z.number().positive().max(5000),
  z.number().positive().max(5000),
  z.number().positive().max(5000),
]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Compact wire format reduces generation time; the renderer receives the standard scene contract.
export const previewSchema = z
  .object({
    dimensions: size,
    color,
    parts: z
      .array(
        z
          .object({
            name: z.string().min(1).max(60),
            shape: z.enum(["box", "cylinder", "sphere", "torus"]),
            position: vec,
            rotation: vec,
            size,
            color,
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();
export const previewJsonSchema = codexCompatibleSchema(
  z.toJSONSchema(previewSchema),
);

export class PreviewManager {
  private active = new Map<
    string,
    { jobId: string; controller?: AbortController; rank: number }
  >();
  private scenes = new Map<string, ConceptPreview>();
  constructor(
    private runtime: AgentRuntime,
    private emit: (event: StudioEvent) => void,
  ) {}
  list() {
    return [...this.scenes.values()];
  }
  begin(projectId: string, jobId: string) {
    this.stop(projectId);
    this.active.set(projectId, { jobId, rank: 0 });
  }
  stop(projectId: string) {
    const jobId = this.active.get(projectId)?.jobId;
    this.active.get(projectId)?.controller?.abort();
    this.active.delete(projectId);
    if (this.scenes.delete(projectId))
      this.emit({ type: "preview", projectId, jobId, preview: null });
  }
  /** Optional work never delays, changes, or fails the canonical job. */
  async generate(
    p: Project,
    jobId: string,
    workspace: string,
    brief: string,
    stage: "sketch" | "concept",
    route: ModelRoute,
    parent: AbortSignal,
  ) {
    const state = this.active.get(p.id);
    if (!state || state.jobId !== jobId || parent.aborted || !route.model)
      return;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    const rank = stage === "sketch" ? 1 : 2;
    const signal = AbortSignal.any([parent, controller.signal]);
    const timeout = setTimeout(
      () => controller.abort(),
      stage === "sketch" ? 45000 : 60000,
    );
    const started = Date.now();
    try {
      const raw = await this.runtime.run({
        ...route,
        cwd: path.join(workspace, "planning"),
        readOnly: true,
        ephemeral: true,
        signal,
        instructions:
          "You are Holo's disposable visual sketch assistant. Return only compact JSON matching the supplied schema. Do not use tools, inspect files, write files, research, or generate CAD. This is an unapproved visual hypothesis, never project intent or a manufacturing design. Use only the brief in this prompt. Make a recognizable silhouette with a few simple primitives. All coordinates and sizes are millimetres, origin is object centre, +Y up, +Z front; rotations radians. Box sizes are width/height/depth; cylinder sizes diameter/height/diameter; torus sizes outer diameter/tube diameter/depth. Fit every part inside dimensions. Represent cavities with separate walls, not a solid box. Avoid unsupported fine details and do not draw text. Keep output small.",
        prompt: `${stage === "sketch" ? "Use 4–8 parts for a rough first silhouette from this unapproved user request" : "Use up to 18 parts to refine the concept from this approved strategic brief"}:\n${brief.slice(0, 8000)}`,
        outputSchema: previewJsonSchema,
        onThread: () => {},
        onEvent: () => {},
      });
      if (
        signal.aborted ||
        this.active.get(p.id) !== state ||
        state.rank > rank
      )
        return;
      const parsed = previewSchema.parse(JSON.parse(raw));
      const preview: ConceptPreview = {
        projectId: p.id,
        jobId,
        stage,
        model: route.model,
        elapsedMs: Date.now() - started,
        scene: {
          kind: "custom",
          color: parsed.color,
          width: parsed.dimensions[0],
          height: parsed.dimensions[1],
          depth: parsed.dimensions[2],
          parts: parsed.parts.map((part, i) => ({
            ...part,
            id: `draft-${i}`,
            domain: "mechanical",
          })),
        },
      };
      state.rank = rank;
      this.scenes.set(p.id, preview);
      this.emit({ type: "preview", projectId: p.id, preview });
    } catch {
      // Timeout, cancellation or malformed draft: keep the last usable view.
    } finally {
      clearTimeout(timeout);
    }
  }
}
