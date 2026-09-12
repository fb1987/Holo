import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  engineVersion,
  normalizeDesign,
  requestFromSpec,
  type DesignSpec,
} from "../../shared/design.js";
import type { Fidelity } from "../../recipes/mesh.js";
import { validateGLB, type ValidationReport } from "./validate.js";

export const hash = (value: unknown): string =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export class BuildError extends Error {
  constructor(
    public kind:
      | "invalid-input"
      | "unavailable"
      | "crash"
      | "timeout"
      | "validation"
      | "cancelled"
      | "budget",
    message: string,
  ) {
    super(message);
  }
}
export interface BuildResult {
  dispose: () => Promise<void>;
  spec: DesignSpec;
  specHash: string;
  geometryKey: string;
  outputKey: string;
  directory: string;
  cached: boolean;
  geometryCached: boolean;
  elapsedMs: number;
  validation: ValidationReport;
}
export interface WorkerHealth {
  status: "untested" | "ready" | "unavailable";
  checkedAt?: string;
  elapsedMs?: number;
  detail: string;
}
export interface WorkshopStatus {
  enabled: boolean;
  mesh: WorkerHealth;
  cad: WorkerHealth;
  render: WorkerHealth;
}

/** Two CPU slots shared by projects. Waiters can cancel without starting work. */
export class WorkQueue {
  private active = 0;
  private pending: (() => void)[] = [];
  constructor(private limit = 2) {}
  async run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw new BuildError("cancelled", "Build cancelled.");
    if (this.active >= this.limit)
      await new Promise<void>((resolve, reject) => {
        const enter = () => {
          signal.removeEventListener("abort", abort);
          resolve();
        };
        const abort = () => {
          this.pending = this.pending.filter((item) => item !== enter);
          reject(new BuildError("cancelled", "Build cancelled."));
        };
        signal.addEventListener("abort", abort, { once: true });
        this.pending.push(enter);
      });
    else this.active++;
    try {
      if (signal.aborted) throw new BuildError("cancelled", "Build cancelled.");
      return await work();
    } finally {
      const next = this.pending.shift();
      if (next) next();
      else this.active--;
    }
  }
}

/** Controlled process launcher shared by the installed adapters. */
export async function controlledProcess(
  executable: string,
  args: string[],
  options: {
    cwd: string;
    input: string;
    signal: AbortSignal;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  },
): Promise<string> {
  if (options.signal.aborted)
    throw new BuildError("cancelled", "Build cancelled.");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: {
        PATH: process.env.PATH,
        HOME: options.cwd,
        TMPDIR: options.cwd,
        ELECTRON_RUN_AS_NODE: "1",
        ...options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "",
      failure: BuildError | undefined;
    const stop = (error: BuildError) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const cancel = () => stop(new BuildError("cancelled", "Build cancelled."));
    options.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(
      () => stop(new BuildError("timeout", "Worker exceeded its time budget.")),
      options.timeoutMs ?? 30000,
    );
    const append = (chunk: Buffer, isError: boolean) => {
      if (isError) err += chunk.toString();
      else out += chunk.toString();
      if (out.length + err.length > 32000)
        stop(new BuildError("budget", "Worker exceeded its log budget."));
    };
    child.stdout.on("data", (c) => append(c, false));
    child.stderr.on("data", (c) => append(c, true));
    child.stdin.on("error", () => {});
    child.once("error", (error) => {
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", cancel);
      reject(new BuildError("unavailable", error.message));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", cancel);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new BuildError(
            signal ? "crash" : "validation",
            `Worker ${signal ? `terminated (${signal})` : `exited ${code}`}: ${err.slice(-5000)}`,
          ),
        );
      else resolve(out);
    });
    child.stdin.end(options.input);
  });
}

export class BuildBroker {
  readonly queue = new WorkQueue(2);
  readonly cache: string;
  health: WorkerHealth = {
    status: "untested",
    detail: "Export and reload probe has not run.",
  };
  private circuitUntil = 0;
  private keys = new Map<string, WorkQueue>();
  private pins = new Map<string, number>();
  private maintenance = Promise.resolve();
  constructor(
    public dataDir: string,
    private workerOverride?: string,
  ) {
    this.cache = path.join(dataDir, "workshop-cache");
  }
  /** Every consumer gets an immutable file snapshot. Cache repair, eviction or
   * another project's exports cannot change files already handed to a job. */
  private async lease(
    result: Omit<BuildResult, "dispose">,
  ): Promise<BuildResult> {
    const directory = await fs.mkdtemp(path.join(this.cache, "leased-"));
    try {
      for (const name of [
        "assembly.glb",
        "assembly.stl",
        "validation.json",
        "request.json",
        "solids.json",
      ]) {
        try {
          await fs.copyFile(
            path.join(result.directory, name),
            path.join(directory, name),
          );
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== "ENOENT" ||
            ["assembly.glb", "validation.json", "request.json"].includes(name)
          )
            throw error;
        }
      }
      return {
        ...result,
        directory,
        dispose: () => fs.rm(directory, { recursive: true, force: true }),
      };
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  async build(
    rawSpec: DesignSpec,
    fidelity: Fidelity,
    signal: AbortSignal,
    force = false,
  ): Promise<BuildResult> {
    await this.maintenance;
    const spec = normalizeDesign(requestFromSpec(rawSpec));
    const specHash = hash(spec),
      geometryKey = hash({
        engineVersion,
        recipe: spec.recipe,
        version: spec.recipeVersion,
        parameters: spec.parameters,
        units: spec.units,
        axes: spec.axes,
        fidelity,
      });
    const outputKey = hash({
      geometryKey,
      materials: spec.materials,
      outputs: spec.outputs,
      specHash,
    });
    const keyQueue = this.keys.get(outputKey) ?? new WorkQueue(1);
    this.keys.set(outputKey, keyQueue);
    this.pins.set(outputKey, (this.pins.get(outputKey) ?? 0) + 1);
    try {
      return await keyQueue.run(signal, () =>
        this.queue.run(signal, async () => {
          const started = performance.now();
          const directory = path.join(this.cache, outputKey);
          try {
            const cached = JSON.parse(
              await fs.readFile(path.join(directory, "result.json"), "utf8"),
            );
            const data = await fs.readFile(
              path.join(directory, "assembly.glb"),
            );
            let intact =
              !force &&
              cached.outputKey === outputKey &&
              cached.glbHash === hash(data.toString("base64"));
            const required = [
              "assembly.glb",
              "validation.json",
              "request.json",
              ...(fidelity === "refined" && spec.outputs.includes("stl")
                ? ["assembly.stl"]
                : []),
              ...(fidelity === "refined" && spec.recipe !== "paneled-ball"
                ? ["solids.json"]
                : []),
            ];
            for (const file of required) {
              const bytes = await fs.readFile(path.join(directory, file));
              intact &&=
                cached.files?.[file] === hash(bytes.toString("base64"));
            }
            if (intact) {
              const validation = await validateGLB(data, spec, specHash);
              if (validation.valid) {
                await fs.utimes(directory, new Date(), new Date());
                return this.lease({
                  ...cached,
                  spec,
                  directory,
                  validation,
                  cached: true,
                  geometryCached: true,
                  elapsedMs: performance.now() - started,
                });
              }
            }
          } catch {}
          if (Date.now() < this.circuitUntil)
            throw new BuildError(
              "unavailable",
              "Mesh worker is paused after a crash. Retry its health check before building again.",
            );
          await fs.mkdir(this.cache, { recursive: true, mode: 0o700 });
          const scratch = await fs.mkdtemp(path.join(this.cache, "scratch-"));
          let geometryCached = false;
          try {
            const geometryPath = path.join(
              this.cache,
              `geometry-${geometryKey}.json`,
            );
            try {
              const stat = await fs.stat(geometryPath);
              if (!force && stat.size <= 48 * 1024 * 1024) {
                await fs.copyFile(
                  geometryPath,
                  path.join(scratch, "geometry.json"),
                );
                geometryCached = true;
              }
            } catch {}
            const base = path.dirname(fileURLToPath(import.meta.url));
            const worker =
              this.workerOverride ??
              (existsSync(path.join(base, "build-worker.js"))
                ? path.join(base, "build-worker.js")
                : path.join(base, "worker.ts"));
            const args = [
              "--max-old-space-size=384",
              ...(worker.endsWith(".ts")
                ? ["--import", createRequire(import.meta.url).resolve("tsx")]
                : []),
              worker,
              scratch,
            ];
            await controlledProcess(
              process.env.HOLO_NODE_EXECUTABLE || process.execPath,
              args,
              {
                cwd: scratch,
                input: JSON.stringify({
                  spec,
                  specHash,
                  fidelity,
                  cachedGeometry: geometryCached,
                }),
                signal,
              },
            );
            const allowedFiles = new Set([
              "assembly.glb",
              "assembly.stl",
              "geometry.json",
              "validation.json",
              "solids.json",
            ]);
            for (const file of await fs.readdir(scratch))
              if (!allowedFiles.has(file))
                await fs.rm(path.join(scratch, file), {
                  recursive: true,
                  force: true,
                });
            const files = await fs.readdir(scratch);
            let bytes = 0;
            for (const file of files)
              bytes += (await fs.stat(path.join(scratch, file))).size;
            if (bytes > 80 * 1024 * 1024)
              throw new BuildError(
                "budget",
                "Build exceeded its 80 MiB output budget.",
              );
            const data = await fs.readFile(path.join(scratch, "assembly.glb")),
              validation = await validateGLB(data, spec, specHash);
            if (!validation.valid)
              throw new BuildError(
                "validation",
                "The exported model failed independent validation.",
              );
            if (signal.aborted)
              throw new BuildError("cancelled", "Build cancelled.");
            const geometryTemp = `${geometryPath}.${randomUUID()}.tmp`;
            await fs.copyFile(
              path.join(scratch, "geometry.json"),
              geometryTemp,
            );
            await fs.rename(geometryTemp, geometryPath);
            await fs.rm(path.join(scratch, "geometry.json"));
            const result = {
              spec,
              specHash,
              geometryKey,
              outputKey,
              directory,
              cached: false,
              geometryCached,
              elapsedMs: performance.now() - started,
              validation,
            };
            await fs.writeFile(
              path.join(scratch, "request.json"),
              JSON.stringify(
                {
                  spec,
                  specHash,
                  geometryKey,
                  outputKey,
                  engineVersion,
                  fidelity,
                },
                null,
                2,
              ),
            );
            const manifest: Record<string, string> = {};
            for (const file of await fs.readdir(scratch))
              manifest[file] = hash(
                (await fs.readFile(path.join(scratch, file))).toString(
                  "base64",
                ),
              );
            await fs.writeFile(
              path.join(scratch, "result.json"),
              JSON.stringify(
                {
                  ...result,
                  directory: undefined,
                  files: manifest,
                  glbHash: hash(data.toString("base64")),
                },
                null,
                2,
              ),
            );
            await fs.rm(directory, { recursive: true, force: true });
            await fs.rename(scratch, directory);
            this.health = {
              status: "ready",
              checkedAt: new Date().toISOString(),
              elapsedMs: result.elapsedMs,
              detail:
                "Production worker generated, exported and independently reloaded a model.",
            };
            return this.lease(result);
          } catch (error) {
            if (
              error instanceof BuildError &&
              (error.kind === "crash" || error.kind === "timeout")
            ) {
              this.circuitUntil = Date.now() + 60000;
              this.health = {
                status: "unavailable",
                checkedAt: new Date().toISOString(),
                detail: error.message,
              };
            }
            throw error;
          } finally {
            await fs.rm(scratch, { recursive: true, force: true });
          }
        }),
      );
    } finally {
      const remaining = (this.pins.get(outputKey) ?? 1) - 1;
      if (remaining) this.pins.set(outputKey, remaining);
      else {
        this.pins.delete(outputKey);
        this.keys.delete(outputKey);
      }
    }
  }
  async probe(signal: AbortSignal) {
    this.circuitUntil = 0;
    const spec = normalizeDesign({
      recipe: "enclosure",
      version: "1.0.0",
      parameters: [],
      bodyColor: "#eeeeee",
      accentColor: "#222222",
      outputs: ["glb"],
    });
    try {
      const result = await this.build(spec, "refined", signal, true);
      await result.dispose();
      this.health = {
        status: "ready",
        checkedAt: new Date().toISOString(),
        elapsedMs: result.elapsedMs,
        detail: "Production worker mesh export and reload passed.",
      };
    } catch (error) {
      this.health = {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
    return this.health;
  }
  /** Cache only; accepted artifacts live in project revisions and are untouched. */
  async prune(keep: Set<string> = new Set()) {
    if (this.pins.size) return;
    const previous = this.maintenance;
    let release!: () => void;
    this.maintenance = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (this.pins.size) return;
      await fs.mkdir(this.cache, { recursive: true, mode: 0o700 });
      const entries = [];
      for (const name of await fs.readdir(this.cache)) {
        if (
          !/^(?:[a-f0-9]{64}|geometry-[a-f0-9]{64}\.json)$/.test(name) ||
          keep.has(name)
        )
          continue;
        const file = path.join(this.cache, name),
          stat = await fs.stat(file);
        let bytes = stat.size;
        if (stat.isDirectory()) {
          bytes = 0;
          for (const child of await fs.readdir(file))
            bytes += (await fs.stat(path.join(file, child))).size;
        }
        entries.push({ file, bytes, time: stat.mtimeMs });
      }
      let total = entries.reduce((n, e) => n + e.bytes, 0);
      for (const entry of entries.sort((a, b) => a.time - b.time))
        if (total > 256 * 1024 * 1024) {
          if (this.pins.size) return;
          await fs.rm(entry.file, { recursive: true, force: true });
          total -= entry.bytes;
        }
    } finally {
      release();
    }
  }
}
