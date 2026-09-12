import { BuildBroker } from "../server/build/broker.js";
import { normalizeDesign, recipeIds } from "../shared/design.js";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
const root = await fs.mkdtemp(
  path.join(os.tmpdir(), "holo-workshop-benchmark-"),
);
const broker = new BuildBroker(root);
try {
  for (const recipe of recipeIds)
    for (const fidelity of ["coarse", "refined"] as const) {
      try {
        const result = await broker.build(
          normalizeDesign({
            recipe,
            version: "1.0.0",
            parameters: [],
            bodyColor: "#ffffff",
            accentColor: "#111111",
            outputs: ["glb", "stl"],
          }),
          fidelity,
          new AbortController().signal,
        );
        console.log(
          JSON.stringify({
            recipe,
            fidelity,
            elapsedMs: Math.round(result.elapsedMs),
            triangles: result.validation.triangles,
            directory: result.directory,
          }),
        );
      } catch (error) {
        console.error(recipe, fidelity, error);
        process.exitCode = 1;
      }
    }
} finally {
  if (!process.env.HOLO_KEEP_BENCHMARK)
    await fs.rm(root, { recursive: true, force: true });
}
