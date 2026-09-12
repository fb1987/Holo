import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeDesign, requestFromSpec } from "../../shared/design.js";
import { buildGeometry } from "../../recipes/index.js";
import { serializeGLB, serializeSTL } from "./gltf.js";
import { validateGLB } from "./validate.js";
import type { Fidelity, Geometry } from "../../recipes/mesh.js";
import { solidPlan } from "../../recipes/solids.js";

// This entry accepts no command, module name, source text or caller-selected
// output paths. Only the broker supplies a private scratch directory via argv.
const directory = process.argv[2];
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (input.length > 65536) process.exit(2);
});
process.stdin.on(
  "end",
  () =>
    void (async () => {
      const request = JSON.parse(input);
      const spec = normalizeDesign(requestFromSpec(request.spec));
      if (!/^[a-f0-9]{64}$/.test(request.specHash))
        throw new Error("Invalid specification hash.");
      const fidelity: Fidelity =
        request.fidelity === "coarse" ? "coarse" : "refined";
      // Geometry caches are broker-owned data, never executable project code.
      let geometry: Geometry;
      if (request.cachedGeometry === true)
        geometry = JSON.parse(
          await fs.readFile(path.join(directory, "geometry.json"), "utf8"),
        );
      else geometry = await buildGeometry(spec, fidelity);
      const glb = await serializeGLB(geometry, spec, request.specHash),
        validation = await validateGLB(glb, spec, request.specHash);
      if (!validation.valid)
        throw new Error(
          `Geometry validation failed: ${validation.checks
            .filter((c) => !c.passed)
            .map((c) => c.name + ": " + c.detail)
            .join("; ")}`,
        );
      if (glb.length > 32 * 1024 * 1024)
        throw new Error("Model exceeds 32 MiB budget.");
      await fs.writeFile(path.join(directory, "assembly.glb"), glb);
      await fs.writeFile(
        path.join(directory, "geometry.json"),
        JSON.stringify(geometry),
      );
      await fs.writeFile(
        path.join(directory, "validation.json"),
        JSON.stringify(validation, null, 2),
      );
      if (fidelity === "refined") {
        if (spec.outputs.includes("stl"))
          await fs.writeFile(
            path.join(directory, "assembly.stl"),
            serializeSTL(geometry),
          );
        if (spec.recipe !== "paneled-ball")
          await fs.writeFile(
            path.join(directory, "solids.json"),
            JSON.stringify(solidPlan(spec)),
          );
      }
      process.stdout.write(
        JSON.stringify({ ok: true, triangles: validation.triangles }),
      );
    })().catch((error) => {
      process.stderr.write(String(error?.stack ?? error).slice(0, 12000));
      process.exitCode = 1;
    }),
);
