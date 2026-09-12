import path from "node:path";
import { promises as fs } from "node:fs";
import {
  BuildBroker,
  BuildError,
  type BuildResult,
  type WorkshopStatus,
} from "./broker.js";
import { NativeAdapters } from "./adapters.js";
import { readRecipePackage } from "./package.js";
import {
  recordDomainArtifacts,
  getCurrentArtifacts,
  getDomainRevisions,
} from "../../shared/artifacts.js";
import type {
  Project,
  ChangeRequest,
  ConceptPreview,
  StudioEvent,
  AgentRunRecord,
  Artifact,
} from "../../shared/types.js";
import {
  normalizeDesign,
  recipeVersion,
  engineVersion,
  type DesignSpec,
} from "../../shared/design.js";
import { ProjectStore, now, uid, atomicWrite } from "../store.js";

export class Workshop {
  readonly broker: BuildBroker;
  readonly adapters: NativeAdapters;
  enabled = true;
  private shutdown = new AbortController();
  private probes = new Set<Promise<WorkshopStatus>>();
  private previews = new Map<string, ConceptPreview>();
  private files = new Map<string, string>();
  constructor(
    private store: ProjectStore,
    private emit: (event: StudioEvent) => void,
  ) {
    this.broker = new BuildBroker(store.dataDir);
    this.adapters = new NativeAdapters(store.dataDir);
  }
  async init() {
    // The application-data lock guarantees no previous workshop still owns
    // these unfinished scratch directories when initialization starts.
    for (const root of [
      this.broker.cache,
      path.join(this.store.dataDir, "workshop-native"),
    ]) {
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      for (const name of await fs.readdir(root))
        if (/^(scratch-|leased-)/.test(name))
          await fs.rm(path.join(root, name), { recursive: true, force: true });
    }
    try {
      const settings = JSON.parse(
        await fs.readFile(
          path.join(this.store.dataDir, "workshop.json"),
          "utf8",
        ),
      );
      this.enabled = settings.enabled !== false;
    } catch {}
  }
  status(): WorkshopStatus {
    return {
      enabled: this.enabled,
      mesh: this.broker.health,
      cad: this.adapters.health.cad,
      render: this.adapters.health.render,
    };
  }
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    await atomicWrite(
      path.join(this.store.dataDir, "workshop.json"),
      JSON.stringify({ enabled }),
    );
    return this.status();
  }
  list() {
    return [...this.previews.values()];
  }
  previewFile(projectId: string, jobId: string, specHash: string) {
    return this.files.get(`${projectId}:${jobId}:${specHash}`);
  }
  clear(projectId: string, jobId: string) {
    const preview = this.previews.get(projectId);
    if (preview?.jobId === jobId) {
      this.previews.delete(projectId);
      this.files.delete(`${projectId}:${jobId}:${preview.specHash}`);
      this.emit({
        type: "preview",
        projectId,
        jobId,
        specHash: preview.specHash,
        preview: null,
      });
    }
  }
  private async publish(p: Project) {
    await this.store.save(p);
    this.emit({ type: "project", project: p });
  }
  healthCheck(signal: AbortSignal) {
    const task = this.check(AbortSignal.any([signal, this.shutdown.signal]));
    this.probes.add(task);
    void task.then(
      () => this.probes.delete(task),
      () => this.probes.delete(task),
    );
    return task;
  }
  async close() {
    this.shutdown.abort();
    await Promise.allSettled([...this.probes]);
  }
  private async check(signal: AbortSignal) {
    await this.broker.probe(signal);
    if (this.broker.health.status === "ready") {
      const spec = normalizeDesign({
        recipe: "enclosure",
        version: "1.0.0",
        parameters: [],
        bodyColor: "#eeeeee",
        accentColor: "#222222",
        outputs: ["glb"],
      });
      const result = await this.broker.build(spec, "refined", signal);
      await Promise.allSettled([
        this.adapters.run("cad", result, signal, true),
        this.adapters.run("render", result, signal, true),
      ]);
      await result.dispose();
    }
    return this.status();
  }
  async execute(
    p: Project,
    change: ChangeRequest,
    spec: DesignSpec,
    signal: AbortSignal,
  ): Promise<() => Promise<void>> {
    if (!this.enabled)
      throw new BuildError(
        "unavailable",
        "Built-in recipe operations are disabled. Enable them in Settings to build this model.",
      );
    const inputRevisions = getDomainRevisions(p),
      revision = p.revision;
    const record: AgentRunRecord = {
      station: "design",
      kind: "build",
      recipe: spec.recipe,
      startedAt: now(),
      status: "running",
      toolCalls: 0,
      retries: 0,
    };
    (change.runs ??= []).push(record);
    p.agents.design.status = "working";
    p.agents.design.summary = "Building the approved recipe…";
    await this.publish(p);
    const publishPreview = (
      result: BuildResult,
      stage: "coarse" | "refined",
    ) => {
      if (signal.aborted) return;
      const preview: ConceptPreview = {
        projectId: p.id,
        jobId: change.id,
        specHash: result.specHash,
        stage,
        artifactUrl: `/api/projects/${p.id}/build-preview/${change.id}/${result.specHash}`,
        scene: p.scene,
        model: "Local recipe",
        elapsedMs: result.elapsedMs,
      };
      this.previews.set(p.id, preview);
      this.files.set(
        `${p.id}:${change.id}:${result.specHash}`,
        path.join(result.directory, "assembly.glb"),
      );
      this.emit({ type: "preview", projectId: p.id, preview });
    };
    const leases: BuildResult[] = [];
    try {
      // Coarse and refined share the complete specification and logical topology.
      // The short coarse pass leads; refinement never waits for another model.
      const coarse = await this.broker.build(spec, "coarse", signal);
      leases.push(coarse);
      publishPreview(coarse, "coarse");
      const result = await this.broker.build(spec, "refined", signal);
      leases.push(result);
      if (signal.aborted) throw new BuildError("cancelled", "Build cancelled.");
      if (p.revision !== revision)
        throw new BuildError(
          "validation",
          "Project changed while building; the candidate was not accepted.",
        );
      const candidate = structuredClone(p);
      candidate.revision++;
      const files = [
        "assembly.glb",
        "validation.json",
        "request.json",
        ...(spec.outputs.includes("stl") ? ["assembly.stl"] : []),
      ];
      const artifacts: Artifact[] = [];
      for (const filename of files)
        artifacts.push(
          await this.store.registerBuildArtifact(
            candidate,
            filename,
            await fs.readFile(path.join(result.directory, filename)),
            filename === "assembly.glb"
              ? "assembly"
              : filename.endsWith(".stl")
                ? "part"
                : "document",
          ),
        );
      artifacts.push(
        await this.store.registerBuildArtifact(
          candidate,
          "design.json",
          JSON.stringify(spec, null, 2),
          "source",
        ),
      );
      artifacts.push(
        await this.store.registerBuildArtifact(
          candidate,
          "recipe-lock.json",
          JSON.stringify(
            {
              recipe: spec.recipe,
              version: recipeVersion,
              engine: engineVersion,
              specHash: result.specHash,
              geometryKey: result.geometryKey,
            },
            null,
            2,
          ),
          "source",
        ),
      );
      const sourcePackage = await this.store.registerBuildArtifact(
        candidate,
        "recipe-package.json",
        JSON.stringify(await readRecipePackage()),
        "source",
      );
      artifacts.push(sourcePackage);
      recordDomainArtifacts(
        candidate,
        "design",
        artifacts.map((a) => a.id),
        inputRevisions,
        false,
      );
      const assembly = artifacts.find((a) => a.role === "assembly")!,
        validation = artifacts.find((a) => a.name === "validation.json")!;
      candidate.acceptedDesign = {
        spec,
        specHash: result.specHash,
        geometryKey: result.geometryKey,
        revision: candidate.revision,
        assemblyId: assembly.id,
        validationId: validation.id,
        sourcePackageId: sourcePackage.id,
      };
      candidate.scene = {
        kind: "custom",
        color: spec.materials.body,
        width: spec.interfaces[0].dimensions[0],
        height: spec.interfaces[0].dimensions[1],
        depth: spec.interfaces[0].dimensions[2],
        parts: [],
      };
      if (signal.aborted) throw new BuildError("cancelled", "Build cancelled.");
      Object.assign(p, {
        revision: candidate.revision,
        artifacts: candidate.artifacts,
        domainState: candidate.domainState,
        primaryAssemblyId: assembly.id,
        acceptedDesign: candidate.acceptedDesign,
        scene: candidate.scene,
        source: "original",
      });
      change.specHash = result.specHash;
      change.requiredOutputs = spec.outputs;
      change.deliveredOutputs = [
        "glb",
        ...(spec.outputs.includes("stl") ? ["stl"] : []),
      ];
      Object.assign(record, {
        status: "completed",
        completedAt: now(),
        elapsedMs: result.elapsedMs + coarse.elapsedMs,
        cached: result.cached,
        geometryCached: result.geometryCached,
      });
      p.agents.design.status = "idle";
      p.agents.design.summary = "Model built and validated.";
      p.messages.push({
        id: uid(),
        role: "assistant",
        station: "design",
        jobId: change.id,
        createdAt: now(),
        text: `Built **${spec.recipe}** from recipe ${recipeVersion}. The exported model passed ${result.validation.checks.length} checks, including dimensions and ${spec.recipe === "paneled-ball" ? "panel topology, spherical surfaces and materials" : "closed-solid geometry"}. ${result.cached ? "Reused a validated cached model." : result.geometryCached ? "Reused geometry; applied the requested materials and outputs." : `Local geometry took ${(record.elapsedMs! / 1000).toFixed(2)} seconds.`}\n\nPhysical fit, materials and fabrication remain unassessed.`,
      });
      await this.publish(p);
      await this.store.snapshot(p);
      this.clear(p.id, change.id);
      await coarse.dispose();
      // Native exports run alongside independent specialist work. Their files
      // are committed later at a barrier, so they cannot race domain revisions.
      const extras = (
        spec.outputs.filter(
          (output) => output === "step" || output === "renders",
        ) as ("step" | "renders")[]
      ).map((output) => {
        const kind = output === "step" ? "cad" : "render";
        const run: AgentRunRecord = {
          station: "design",
          kind,
          recipe: spec.recipe,
          startedAt: now(),
          status: "running",
          toolCalls: 0,
          retries: 0,
        };
        change.runs!.push(run);
        const started = performance.now();
        return this.adapters
          .run(kind, result, signal)
          .then((files) => {
            run.status = "completed";
            run.completedAt = now();
            run.elapsedMs = performance.now() - started;
            return {
              output,
              files,
              run,
              error: undefined as unknown,
            };
          })
          .catch((error) => {
            run.status = signal.aborted ? "cancelled" : "failed";
            run.completedAt = now();
            run.elapsedMs = performance.now() - started;
            return {
              output,
              files: [] as { name: string; data: Buffer }[],
              run,
              error,
            };
          });
      });
      const completed = Promise.all(extras).finally(() => result.dispose());
      await this.publish(p);
      let finalized: Promise<void> | undefined;
      return () =>
        (finalized ??= (async () => {
          const outcomes = await completed;
          if (signal.aborted)
            throw new BuildError("cancelled", "Build cancelled.");
          if (
            p.acceptedDesign?.specHash !== result.specHash ||
            p.acceptedDesign?.assemblyId !== assembly.id
          )
            throw new BuildError(
              "validation",
              "Native outputs belong to an older accepted design and were discarded.",
            );
          const succeeded = outcomes.filter((o) => !o.error);
          if (succeeded.length) {
            const candidate = structuredClone(p);
            candidate.revision++;
            const ids = getCurrentArtifacts(p, "design").map((a) => a.id);
            for (const outcome of succeeded)
              for (const file of outcome.files) {
                const artifact = await this.store.registerBuildArtifact(
                  candidate,
                  file.name,
                  file.data,
                  file.name.endsWith(".png")
                    ? "render"
                    : file.name.endsWith(".step")
                      ? "source"
                      : "document",
                );
                ids.push(artifact.id);
              }
            recordDomainArtifacts(
              candidate,
              "design",
              ids,
              inputRevisions,
              false,
            );
            candidate.primaryAssemblyId = p.acceptedDesign!.assemblyId;
            Object.assign(p, {
              revision: candidate.revision,
              artifacts: candidate.artifacts,
              domainState: candidate.domainState,
              primaryAssemblyId: candidate.primaryAssemblyId,
            });
          }
          for (const outcome of outcomes) {
            outcome.run.completedAt ??= now();
            outcome.run.status = outcome.error ? "failed" : "completed";
            if (outcome.error) {
              outcome.run.errorKind =
                outcome.error instanceof BuildError
                  ? outcome.error.kind
                  : "validation";
              p.messages.push({
                id: uid(),
                role: "system",
                station: "design",
                jobId: change.id,
                createdAt: now(),
                text: `The model is available, but ${outcome.output} could not be produced: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
              });
            } else change.deliveredOutputs!.push(outcome.output);
          }
          change.outcome = spec.outputs.every((output) =>
            change.deliveredOutputs!.includes(output),
          )
            ? "succeeded"
            : "partial";
          await this.publish(p);
        })());
    } catch (error) {
      await Promise.all(leases.map((result) => result.dispose()));
      record.status = signal.aborted ? "cancelled" : "failed";
      record.completedAt = now();
      record.errorKind =
        error instanceof BuildError ? error.kind : "validation";
      p.agents.design.status = signal.aborted ? "idle" : "error";
      throw error;
    }
  }
}
