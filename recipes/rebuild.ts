import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { normalizeDesign, requestFromSpec } from "../shared/design.js";
import { buildGeometry } from "./index.js";
import { solidPlan } from "./solids.js";
import { serializeGLB, serializeSTL } from "../server/build/gltf.js";
import { validateGLB } from "../server/build/validate.js";
const file = path.resolve(process.argv[2] ?? "design.json"),
  output = path.resolve(process.argv[3] ?? "output");
const spec = normalizeDesign(
  requestFromSpec(JSON.parse(await fs.readFile(file, "utf8"))),
);
const specHash = createHash("sha256")
  .update(JSON.stringify(spec))
  .digest("hex");
const geometry = await buildGeometry(spec, "refined"),
  glb = await serializeGLB(geometry, spec, specHash),
  validation = await validateGLB(glb, spec, specHash);
if (!validation.valid)
  throw new Error(JSON.stringify(validation.checks.filter((c) => !c.passed)));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "assembly.glb"), glb);
await fs.writeFile(
  path.join(output, "validation.json"),
  JSON.stringify(validation, null, 2),
);
if (spec.outputs.includes("stl"))
  await fs.writeFile(path.join(output, "assembly.stl"), serializeSTL(geometry));
if (spec.recipe !== "paneled-ball")
  await fs.writeFile(
    path.join(output, "solids.json"),
    JSON.stringify(solidPlan(spec)),
  );
console.log(`Validated ${validation.triangles} triangles. Output: ${output}`);
