import path from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  controlledProcess,
  BuildError,
  WorkQueue,
  hash,
  type BuildResult,
  type WorkerHealth,
} from "./broker.js";

export function recipeSourceDirectory() {
  const base = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(base, "recipes");
  return existsSync(bundled)
    ? bundled.replace(/\.asar\//, ".asar.unpacked/")
    : path.resolve(base, "../../recipes");
}
export class NativeAdapters {
  readonly queue = new WorkQueue(1);
  health: Record<"cad" | "render", WorkerHealth> = {
    cad: { status: "untested", detail: "STEP adapter has not been tested." },
    render: {
      status: "untested",
      detail: "GLB rendering has not been tested.",
    },
  };
  private circuits = new Map<string, number>();
  constructor(private dataDir: string) {}
  async run(
    kind: "cad" | "render",
    result: BuildResult,
    signal: AbortSignal,
    probe = false,
  ) {
    return this.queue.run(signal, async () => {
      if (!probe && (this.circuits.get(kind) ?? 0) > Date.now())
        throw new BuildError(
          "unavailable",
          `${kind} worker is paused after a failure. Retry its health check.`,
        );
      const python = path.join(
        this.dataDir,
        "runtimes",
        kind === "cad" ? "cadquery-2.6.1" : "blender-5.2.1",
        "bin/python",
      );
      if (!existsSync(python)) {
        this.health[kind] = {
          status: "unavailable",
          detail: `Install the pinned ${kind === "cad" ? "CadQuery 2.6.1" : "Blender 5.2.1"} runtime using Holo's setup script.`,
        };
        throw new BuildError("unavailable", this.health[kind].detail);
      }
      const started = performance.now();
      const root = path.join(this.dataDir, "workshop-native");
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const source = await fs.readFile(
        path.join(
          result.directory,
          kind === "cad" ? "solids.json" : "assembly.glb",
        ),
      );
      const cacheKey = hash({
        kind,
        version: kind === "cad" ? "cadquery-2.6.1" : "blender-5.2.1",
        adapter: hash(
          await fs.readFile(
            path.join(
              recipeSourceDirectory(),
              `${kind === "cad" ? "cad" : "render"}_worker.py`,
            ),
            "utf8",
          ),
        ),
        source: hash(source.toString("base64")),
      });
      const cache = path.join(root, cacheKey);
      const expected =
        kind === "cad"
          ? ["assembly.step", "cad-validation.json"]
          : ["front.png", "rear.png", "oblique.png", "render-evidence.json"];
      const collect = async (directory: string) =>
        Promise.all(
          expected.map(async (name) => ({
            name,
            data: await fs.readFile(path.join(directory, name)),
          })),
        );
      if (!probe)
        try {
          const manifest = JSON.parse(
              await fs.readFile(path.join(cache, "manifest.json"), "utf8"),
            ),
            files = await collect(cache);
          if (
            files.every(
              (file) =>
                manifest[file.name] === hash(file.data.toString("base64")),
            )
          )
            return files;
        } catch {}
      const scratch = await fs.mkdtemp(path.join(root, "scratch-"));
      try {
        await fs.writeFile(
          path.join(scratch, kind === "cad" ? "solids.json" : "assembly.glb"),
          source,
        );
        await controlledProcess(
          python,
          [
            "-I",
            path.join(
              recipeSourceDirectory(),
              `${kind === "cad" ? "cad" : "render"}_worker.py`,
            ),
            scratch,
          ],
          {
            cwd: scratch,
            input: "",
            signal,
            timeoutMs: kind === "cad" ? 60000 : 90000,
            env: { OMP_NUM_THREADS: "2", OPENBLAS_NUM_THREADS: "2" },
          },
        );
        for (const name of expected) {
          const stat = await fs.stat(path.join(scratch, name));
          if (stat.size < 20 || stat.size > 64 * 1024 * 1024)
            throw new BuildError(
              "validation",
              `${name} is missing or exceeds the adapter budget.`,
            );
        }
        if (kind === "cad") {
          const validation = JSON.parse(
            await fs.readFile(
              path.join(scratch, "cad-validation.json"),
              "utf8",
            ),
          );
          if (
            validation.cadquery !== "2.6.1" ||
            !validation.valid ||
            !result.spec.interfaces[0].dimensions.every(
              (n, i) => Math.abs(n - validation.dimensionsMM[i]) < 0.2,
            )
          )
            throw new BuildError(
              "validation",
              "STEP reload does not match the requested envelope or pinned runtime.",
            );
        } else {
          const evidence = JSON.parse(
            await fs.readFile(
              path.join(scratch, "render-evidence.json"),
              "utf8",
            ),
          );
          if (!/^5\.2\.1(?:\s|$)/.test(evidence.blender))
            throw new BuildError(
              "validation",
              "Blender runtime does not match pinned version 5.2.1.",
            );
        }
        this.health[kind] = {
          status: "ready",
          checkedAt: new Date().toISOString(),
          elapsedMs: performance.now() - started,
          detail:
            kind === "cad"
              ? "Production adapter exported and reloaded STEP solids."
              : "Production adapter imported GLB and rendered front, rear and oblique images.",
        };
        const files = await collect(scratch);
        if (
          files.reduce((sum, file) => sum + file.data.length, 0) >
          64 * 1024 * 1024
        )
          throw new BuildError("budget", "Native exports exceed 64 MiB total.");
        await fs.mkdir(cache, { recursive: true });
        const manifest: Record<string, string> = {};
        for (const file of files) {
          await fs.writeFile(path.join(cache, file.name), file.data);
          manifest[file.name] = hash(file.data.toString("base64"));
        }
        await fs.writeFile(
          path.join(cache, "manifest.json"),
          JSON.stringify(manifest),
        );
        this.circuits.delete(kind);
        return files;
      } catch (error) {
        if (!(error instanceof BuildError && error.kind === "cancelled")) {
          this.circuits.set(kind, Date.now() + 60000);
          this.health[kind] = {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            detail: error instanceof Error ? error.message : String(error),
          };
        }
        throw error;
      } finally {
        await fs.rm(scratch, { recursive: true, force: true });
        const entries = [];
        for (const name of await fs.readdir(root))
          if (/^[a-f0-9]{64}$/.test(name)) {
            const directory = path.join(root, name);
            let size = 0;
            for (const file of await fs.readdir(directory))
              size += (await fs.stat(path.join(directory, file))).size;
            entries.push({
              directory,
              size,
              time: (await fs.stat(directory)).mtimeMs,
            });
          }
        let total = entries.reduce((sum, e) => sum + e.size, 0);
        for (const entry of entries.sort((a, b) => a.time - b.time))
          if (total > 128 * 1024 * 1024 && entry.directory !== cache) {
            await fs.rm(entry.directory, { recursive: true, force: true });
            total -= entry.size;
          }
      }
    });
  }
}
