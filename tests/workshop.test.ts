import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BuildBroker,
  BuildError,
  controlledProcess,
  hash,
} from "../server/build/broker.js";
import {
  normalizeDesign,
  recipeIds,
  requestFromSpec,
} from "../shared/design.js";
import { buildGeometry } from "../recipes/index.js";
import { serializeGLB, io } from "../server/build/gltf.js";
import { validateGLB } from "../server/build/validate.js";
import { dependencyLayers } from "../server/build/graph.js";
const spec = (
  recipe: (typeof recipeIds)[number] = "paneled-ball",
  parameters: { name: string; value: number }[] = [],
) =>
  normalizeDesign({
    recipe,
    version: "1.0.0",
    parameters,
    bodyColor: "#ffffff",
    accentColor: "#111111",
    outputs: ["glb", "stl"],
  });
async function temp(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "holo-workshop-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("all recipe families export and independently reload at both fidelities", async (t) => {
  const broker = new BuildBroker(await temp(t));
  for (const recipe of recipeIds)
    for (const fidelity of ["coarse", "refined"] as const) {
      const result = await broker.build(
        spec(recipe),
        fidelity,
        new AbortController().signal,
      );
      assert.equal(result.validation.valid, true, recipe);
      assert.ok(result.validation.triangles > 10);
      assert.equal(result.validation.fabrication, "unassessed");
    }
});
test("ball keeps logical adjacency, materials and spherical surfaces across diameter and seam changes", async () => {
  for (const [diameter, seamDepth] of [
    [220, 0.8],
    [220, 0.1],
    [1000, 0.1],
  ])
    for (const fidelity of ["coarse", "refined"] as const) {
      const design = spec("paneled-ball", [
          { name: "diameter", value: diameter },
          { name: "seamDepth", value: seamDepth },
        ]),
        geometry = await buildGeometry(design, fidelity),
        glb = await serializeGLB(geometry, design, hash(design)),
        report = await validateGLB(glb, design, hash(design));
      assert.equal(
        report.valid,
        true,
        JSON.stringify(report.checks.filter((c) => !c.passed)),
      );
      assert.equal(geometry.topology!.faces.length, 32);
      assert.equal(geometry.topology!.vertices.length, 60);
    }
});
test("validator rejects a filled box posing as a container and a model with missing panels", async () => {
  const design = spec("container");
  // An independently authored cube with correct dimensions and identity.
  const w = design.parameters.width / 2,
    h = design.parameters.height / 2,
    d = design.parameters.depth / 2;
  const positions = [
    -w,
    -h,
    -d,
    w,
    -h,
    -d,
    w,
    h,
    -d,
    -w,
    h,
    -d,
    -w,
    -h,
    d,
    w,
    -h,
    d,
    w,
    h,
    d,
    -w,
    h,
    d,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0,
    4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ];
  const glb = await serializeGLB(
    {
      parts: [
        {
          id: "container-body",
          material: "body",
          positions,
          indices,
          closed: true,
        },
      ],
    },
    design,
    hash(design),
  );
  const report = await validateGLB(glb, design, hash(design));
  assert.equal(report.valid, false);
  assert.equal(
    report.checks.find((c) => c.name === "open-cavity")?.passed,
    false,
  );
  const ball = spec(),
    geometry = await buildGeometry(ball, "coarse");
  geometry.parts.splice(0, 1);
  assert.equal(
    (
      await validateGLB(
        await serializeGLB(geometry, ball, hash(ball)),
        ball,
        hash(ball),
      )
    ).valid,
    false,
  );
});
test("wrong exported colors and inward panel winding are rejected", async () => {
  const design = spec(),
    geometry = await buildGeometry(design, "coarse");
  [geometry.parts[0].indices[1], geometry.parts[0].indices[2]] = [
    geometry.parts[0].indices[2],
    geometry.parts[0].indices[1],
  ];
  let data = await serializeGLB(geometry, design, hash(design));
  let report = await validateGLB(data, design, hash(design));
  assert.equal(
    report.checks.find((c) => c.name === "outward-winding")?.passed,
    false,
  );
  const doc = await io().readBinary(data);
  doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getName() === "body")!
    .setBaseColorFactor([1, 0, 0, 1]);
  data = await io().writeBinary(doc);
  report = await validateGLB(data, design, hash(design));
  assert.equal(
    report.checks.find((c) => c.name === "material:body")?.passed,
    false,
  );
});
test("identical builds serialize safely; recolor reuses geometry; missing outputs rebuild", async (t) => {
  const broker = new BuildBroker(await temp(t)),
    signal = new AbortController().signal,
    design = spec();
  const [first, second] = await Promise.all([
    broker.build(design, "refined", signal),
    broker.build(design, "refined", signal),
  ]);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(
    hash(
      (await fs.readFile(path.join(first.directory, "assembly.glb"))).toString(
        "base64",
      ),
    ),
    hash(
      (await fs.readFile(path.join(second.directory, "assembly.glb"))).toString(
        "base64",
      ),
    ),
  );
  const recolored = normalizeDesign({
    ...requestFromSpec(design),
    bodyColor: "#aaeeff",
  });
  const third = await broker.build(recolored, "refined", signal);
  assert.equal(third.geometryKey, first.geometryKey);
  assert.equal(third.geometryCached, true);
  assert.notEqual(third.specHash, first.specHash);
  await fs.rm(path.join(broker.cache, second.outputKey, "assembly.stl"));
  const repaired = await broker.build(design, "refined", signal);
  assert.equal(repaired.cached, false);
  assert.ok(
    (await fs.stat(path.join(repaired.directory, "assembly.stl"))).size > 84,
  );
});
test("worker crash opens a circuit; timeout and cancellation terminate actual child processes", async (t) => {
  const root = await temp(t),
    file = path.join(root, "crash.mjs");
  await fs.writeFile(file, "process.kill(process.pid, 'SIGKILL');");
  const broker = new BuildBroker(root, file);
  await assert.rejects(
    broker.build(spec(), "coarse", new AbortController().signal),
    (e: unknown) => e instanceof BuildError && e.kind === "crash",
  );
  await assert.rejects(
    broker.build(spec(), "coarse", new AbortController().signal),
    (e: unknown) => e instanceof BuildError && e.kind === "unavailable",
  );
  await assert.rejects(
    controlledProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      cwd: root,
      input: "",
      signal: new AbortController().signal,
      timeoutMs: 40,
    }),
    (e: unknown) => e instanceof BuildError && e.kind === "timeout",
  );
  const controller = new AbortController();
  const running = controlledProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { cwd: root, input: "", signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(
    running,
    (e: unknown) => e instanceof BuildError && e.kind === "cancelled",
  );
});
test("health check executes the worker again even when a valid cache exists", async (t) => {
  const root = await temp(t),
    broker = new BuildBroker(root);
  await broker.probe(new AbortController().signal);
  assert.equal(broker.health.status, "ready");
  const missing = new BuildBroker(root, path.join(root, "missing.mjs"));
  await missing.probe(new AbortController().signal);
  assert.equal(missing.health.status, "unavailable");
});
test("parameter and dependency contracts reject unknown input, impossible fit and cycles", () => {
  assert.throws(() => spec("container", [{ name: "code", value: 1 }]));
  assert.throws(() => spec("enclosure", [{ name: "holeDiameter", value: 8 }]));
  assert.deepEqual(
    dependencyLayers(["design", "electronics", "software"], null),
    [["design"], ["electronics"], ["software"]],
  );
  assert.deepEqual(
    dependencyLayers(
      ["electronics", "software"],
      [
        { station: "electronics", requires: [] },
        { station: "software", requires: [] },
      ],
    ),
    [["electronics", "software"]],
  );
  assert.throws(() =>
    dependencyLayers(
      ["design", "electronics"],
      [
        { station: "design", requires: ["electronics"] },
        { station: "electronics", requires: ["design"] },
      ],
    ),
  );
});

test("shared surface relief follows tapered walls and preserves solid validity", async () => {
  for (const recipe of ["container", "enclosure", "cradle"] as const)
    for (const reliefMode of [0, 1]) {
      const plain = spec(recipe);
      const detailed = spec(recipe, [
        { name: "grooveCount", value: 6 },
        { name: "reliefMode", value: reliefMode },
        ...(recipe === "container" ? [{ name: "taper", value: 0.25 }] : []),
      ]);
      if (recipe === "container") plain.parameters.taper = 0.25;
      const geometry = await buildGeometry(detailed, "refined");
      const original = await buildGeometry(plain, "refined");
      assert.notDeepEqual(
        geometry.parts[0].positions,
        original.parts[0].positions,
      );
      const report = await validateGLB(
        await serializeGLB(geometry, detailed, hash(detailed)),
        detailed,
        hash(detailed),
      );
      assert.equal(
        report.valid,
        true,
        `${recipe}/${reliefMode}: ${JSON.stringify(report.checks.filter((c) => !c.passed))}`,
      );
    }
});
