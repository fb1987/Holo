import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Box3, BoxGeometry, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ProjectStore } from "../server/store.js";
import { exportEntries } from "../server/export.js";
import {
  getCurrentArtifacts,
  getPrimaryAssembly,
  normalizeArtifactState,
  recordDomainArtifacts,
} from "../shared/artifacts.js";
import type { Artifact, Project, Station } from "../shared/types.js";

/** Real, asymmetric glTF geometry; no private project or generated fixture files. */
function assemblyGlb(): Buffer {
  const parts = [
    { size: [0.06, 0.03, 0.02], position: [-0.04, 0, 0] },
    { size: [0.04, 0.04, 0.01], position: [0.04, 0.035, 0.01] },
  ];
  const buffers = parts.map((part) => {
    const geometry = new BoxGeometry(...part.size).toNonIndexed();
    return Buffer.from(
      new Float32Array(geometry.attributes.position.array).buffer,
    );
  });
  const bin = Buffer.concat(buffers);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: parts.map((part, index) => ({
      mesh: index,
      translation: part.position,
      name: `Assembly body ${index + 1}`,
    })),
    meshes: parts.map((_, index) => ({
      primitives: [{ attributes: { POSITION: index }, material: index }],
    })),
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.2, 0.8, 0.9, 1] } },
      { pbrMetallicRoughness: { baseColorFactor: [0.7, 0.3, 0.9, 1] } },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: buffers.map((buffer, index) => ({
      buffer: 0,
      byteOffset: buffers
        .slice(0, index)
        .reduce((sum, item) => sum + item.length, 0),
      byteLength: buffer.length,
    })),
    accessors: parts.map((part, index) => ({
      bufferView: index,
      componentType: 5126,
      count: buffers[index].length / 12,
      type: "VEC3",
      min: part.size.map((size) => -size / 2),
      max: part.size.map((size) => size / 2),
    })),
  };
  const encoded = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(padded);
  const output = Buffer.alloc(12 + 8 + padded.length + 8 + bin.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(output, 20);
  output.writeUInt32LE(bin.length, 20 + padded.length);
  output.writeUInt32LE(0x004e4942, 24 + padded.length);
  bin.copy(output, 28 + padded.length);
  return output;
}

async function fixture(t: test.TestContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "holo-artifact-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  await store.init();
  const project = await store.create({ template: "wheel" });
  async function add(
    revision: number,
    domain: Station,
    filename: string,
    data: string | Buffer = "fixture",
    role?: Artifact["role"],
  ) {
    project.revision = revision;
    await writeFile(
      path.join(store.workspace(project.id), domain, "artifacts", filename),
      data,
    );
    return store.registerArtifact(
      project,
      domain,
      `${domain}/artifacts/${filename}`,
      filename,
      role,
    );
  }
  return { store, project, add };
}

test("legacy assembly selection survives newer printable parts and global software revisions", async (t) => {
  const { store, project, add } = await fixture(t);
  const old = await add(2, "design", "device_r1_concept.glb", assemblyGlb());
  const electronics = await add(
    3,
    "electronics",
    "board-definition.json",
    "{}",
  );
  const current = await add(
    5,
    "design",
    "device_r4_concept.glb",
    assemblyGlb(),
  );
  await add(5, "design", "device_r4_concept_mm.stl");
  await add(5, "design", "device_phone_insert_mm.stl");
  const bracket = await add(5, "design", "device_carrier_bracket_mm.stl");
  const software = await add(6, "software", "behavior-contract.json", "{}");
  delete project.domainState;
  delete project.primaryAssemblyId;
  for (const artifact of project.artifacts) delete artifact.role;
  assert.equal(
    project.artifacts
      .filter((artifact) => /\.(glb|stl)$/.test(artifact.path))
      .at(-1)?.id,
    bracket.id,
  );
  assert.equal(getPrimaryAssembly(project)?.id, current.id);
  assert.deepEqual(
    new Set(
      getCurrentArtifacts(project, "design").map(
        (artifact) => artifact.revision,
      ),
    ),
    new Set([5]),
  );
  assert.ok(
    !getCurrentArtifacts(project).some((artifact) => artifact.id === old.id),
  );
  project.artifacts.reverse();
  assert.equal(
    getPrimaryAssembly(project)?.id,
    current.id,
    "Selection must not depend on registration order",
  );

  const file = await readFile(
    await store.readArtifact(project.id, current.path),
  );
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer,
    "",
  );
  const bounds = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
  assert.ok(Math.abs(bounds.x - 0.13) < 1e-6);
  assert.ok(Math.abs(bounds.y - 0.07) < 1e-6);
  assert.ok(Math.abs(bounds.z - 0.025) < 1e-6);
  assert.equal(gltf.scene.children.length, 2);

  const entries = await exportEntries(store, project);
  const manifest = JSON.parse(
    String(entries.find((entry) => entry.name === "MANIFEST.json")!.data),
  );
  assert.equal(manifest.version, 3);
  assert.equal(manifest.primaryAssembly, current.path);
  for (const artifact of [current, electronics, software]) {
    const record = manifest.files.find(
      (entry: { path: string }) => entry.path === artifact.path,
    );
    assert.equal(record.currentRevision, true);
    assert.equal(record.status, "current");
  }
  assert.equal(
    manifest.files.find((entry: { path: string }) => entry.path === old.path)
      .status,
    "historical",
  );
  assert.equal(manifest.domains.design.revision, 5);
  assert.equal(manifest.domains.electronics.revision, 3);
  assert.equal(manifest.domains.electronics.inputRevisions, null);
  assert.equal(manifest.domains.electronics.compatibility, "not-assessed");
  assert.ok(
    entries.some((entry) => entry.name === old.path),
    "History keeps original bytes and paths",
  );
  assert.match(
    String(entries.find((entry) => entry.name === "DELIVERABLES.md")!.data),
    /device_r4_concept.glb/,
  );
});

test("explicit assembly roles and valid pointers override legacy filename inference", async (t) => {
  const { project, add } = await fixture(t);
  const assembly = await add(
    1,
    "design",
    "shipping-form.stl",
    "solid concept\nendsolid concept",
    "assembly",
  );
  await add(1, "design", "complete.glb", assemblyGlb(), "part");
  assert.equal(getPrimaryAssembly(project)?.id, assembly.id);
  const alternative = await add(
    1,
    "design",
    "full-assembly.glb",
    assemblyGlb(),
    "assembly",
  );
  project.primaryAssemblyId = alternative.id;
  assert.equal(getPrimaryAssembly(project)?.id, alternative.id);
  project.primaryAssemblyId = "missing-file";
  normalizeArtifactState(project);
  assert.equal(project.primaryAssemblyId, alternative.id);
  await assert.rejects(
    () => add(2, "electronics", "board.glb", assemblyGlb(), "assembly"),
    /design domain/,
  );
  await assert.rejects(
    () => add(2, "design", "notes.md", "notes", "assembly"),
    /GLB or STL/,
  );
});

test("domain snapshots preserve explanation-only files and invalidate old geometry explicitly", async (t) => {
  const { store, project, add } = await fixture(t);
  const assembly = await add(
    2,
    "design",
    "full-assembly.glb",
    assemblyGlb(),
    "assembly",
  );
  const electronics = await add(3, "electronics", "board.json", "{}");
  recordDomainArtifacts(project, "electronics", [electronics.id], {
    design: 2,
  });
  project.revision = 4;
  recordDomainArtifacts(project, "design", [], { electronics: 3 });
  assert.equal(getPrimaryAssembly(project)?.id, assembly.id);
  project.revision = 5;
  recordDomainArtifacts(project, "design", [], { electronics: 3 }, false);
  normalizeArtifactState(project);
  assert.equal(getPrimaryAssembly(project), undefined);
  assert.equal(getCurrentArtifacts(project, "design").length, 0);
  assert.ok(
    project.artifacts.some((artifact) => artifact.id === assembly.id),
    "Invalidated geometry remains inspectable history",
  );
  const entries = await exportEntries(store, project);
  const manifest = JSON.parse(
    String(entries.find((entry) => entry.name === "MANIFEST.json")!.data),
  );
  assert.deepEqual(manifest.domains.electronics.changedInputs, [
    { domain: "design", recordedRevision: 2, currentRevision: 5 },
  ]);
  assert.equal(manifest.domains.electronics.compatibility, "not-assessed");
  assert.equal(
    manifest.files.find(
      (entry: { path: string }) => entry.path === electronics.path,
    ).status,
    "current",
  );
});

test("load migration persists presentation metadata without changing project recency or example provenance", async (t) => {
  const { store, project, add } = await fixture(t);
  const untouched = await store.create({ template: "wheel" });
  const assembly = await add(5, "design", "full-assembly.glb", assemblyGlb());
  project.messages.push({
    id: "request",
    role: "user",
    station: "planning",
    text: "Make a new controller",
    createdAt: project.createdAt,
  });
  project.changes.push({
    id: "change",
    summary: "Changed design",
    reason: "User request",
    affected: ["design"],
    status: "completed",
    fromRevision: 0,
    toRevision: 5,
    createdAt: project.createdAt,
  });
  delete project.domainState;
  delete project.primaryAssemblyId;
  for (const artifact of project.artifacts) delete artifact.role;
  const timestamp = project.updatedAt;
  await writeFile(
    path.join(store.root(project.id), "project.json"),
    JSON.stringify(project),
  );
  const next = new ProjectStore(store.dataDir);
  await next.init();
  const migrated = next.get(project.id);
  assert.equal(migrated.updatedAt, timestamp);
  assert.equal(migrated.primaryAssemblyId, assembly.id);
  assert.equal(migrated.source, "original");
  assert.equal(next.get(untouched.id).source, "example");
  assert.equal(
    normalizeArtifactState(migrated),
    false,
    "Migration is idempotent",
  );
  const saved: Project = JSON.parse(
    await readFile(path.join(next.root(project.id), "project.json"), "utf8"),
  );
  assert.equal(saved.primaryAssemblyId, assembly.id);
});
