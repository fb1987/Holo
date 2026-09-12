import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import { createStudioServer } from "../server/index.js";
import { ProjectStore, sha256 } from "../server/store.js";
import { StudioEngine } from "../server/engine.js";
import { exportEntries, bomCsv } from "../server/export.js";
import type { AgentRunOptions, AgentRuntime } from "../server/codex.js";
import { StructuredOutputStallError } from "../server/codex.js";
import type { RuntimeStatus, StudioEvent } from "../shared/types.js";
import {
  getCurrentArtifacts,
  getPrimaryAssembly,
} from "../shared/artifacts.js";

const result = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    response: "A real test result.",
    summary: "Updated the concept.",
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
class FakeRuntime extends EventEmitter implements AgentRuntime {
  calls: AgentRunOptions[] = [];
  responses: string[] = [];
  runner?: (options: AgentRunOptions) => Promise<string>;
  status(): RuntimeStatus {
    return {
      available: true,
      connected: true,
      authenticated: true,
      tools: { blender: false, kicad: false, python: true },
    };
  }
  async connect() {
    return this.status();
  }
  async models() {
    return [];
  }
  async login() {
    return {};
  }
  async run(options: AgentRunOptions) {
    this.calls.push(options);
    await options.onThread(options.threadId || `thread-${this.calls.length}`);
    return this.runner
      ? this.runner(options)
      : this.responses.shift() || result();
  }
  respond() {}
  reject() {}
  async close() {}
}
async function temp(t: test.TestContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "holo-engine-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function settled(store: ProjectStore, id: string, engine: StudioEngine) {
  for (let i = 0; i < 300; i++) {
    const p = store.get(id);
    if (
      p.changes.length &&
      p.changes.every((c) => !["queued", "running"].includes(c.status)) &&
      !engine.isBusy(id)
    )
      return p;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Job did not settle.");
}

test("projects persist, blank is plasma, examples clearly identify tentative parts", async (t) => {
  const dir = await temp(t),
    store = new ProjectStore(dir);
  await store.init();
  const blank = await store.create({ name: "An original idea" });
  assert.equal(blank.scene.kind, "plasma");
  assert.equal(blank.source, "original");
  assert.equal(blank.parts.length, 0);
  const wheel = await store.create({ template: "wheel" });
  assert.equal(wheel.source, "example");
  assert.ok(wheel.parts.every((p) => !p.verified));
  assert.match(wheel.messages[0].text, /conceptual example/);
  assert.equal(wheel.artifacts.length, 4);
  const contract = wheel.artifacts.find((a) =>
    a.path.endsWith("behavior-contract.json"),
  )!;
  const contents = JSON.parse(
    await readFile(await store.readArtifact(wheel.id, contract.path), "utf8"),
  );
  assert.equal(contents.status, "conceptual");
  assert.equal(contents.chains[0].id, "button");
  const next = new ProjectStore(dir);
  await next.init();
  assert.equal(next.get(blank.id).name, "An original idea");
  assert.equal(next.list().length, 2);
});
test("all user intent enters planning, affected specialists run in sequence, threads are reused", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create();
  const runtime = new FakeRuntime();
  runtime.responses = [
    result({
      affected: ["design", "software"],
      goals: ["Fit on a desk"],
      name: "Desktop invention",
      description: "A device for a desk.",
    }),
    result({
      scene: {
        kind: "custom",
        color: "#abcdef",
        width: 100,
        height: 60,
        depth: 40,
        parts: [],
      },
      name: "Unauthorized rename",
    }),
    result(),
    result(),
  ];
  const events: StudioEvent[] = [];
  const engine = new StudioEngine(store, runtime, (e) => events.push(e));
  await engine.enqueue(p.id, {
    text: "Make a desktop device",
    station: "software",
  });
  await settled(store, p.id, engine);
  assert.deepEqual(
    runtime.calls.map((c) => path.basename(c.cwd)),
    ["planning", "design", "software"],
  );
  assert.deepEqual(p.goals, ["Fit on a desk"]);
  assert.equal(p.scene.kind, "custom");
  assert.equal(p.revision, 3);
  assert.equal(p.changes[0].status, "completed");
  assert.match(runtime.calls[0].prompt, /software perspective/);
  assert.equal(p.name, "Desktop invention");
  assert.equal(p.description, "A device for a desk.");
  await engine.enqueue(p.id, {
    text: "Explain the approach",
    station: "planning",
  });
  await settled(store, p.id, engine);
  assert.equal(runtime.calls[3].threadId, "thread-1");
  assert.ok(events.some((e) => e.type === "project"));
});
test("cross-domain proposals get one planner arbitration and one bounded correction round", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create(),
    runtime = new FakeRuntime();
  const proposal = {
    proposal: "Allow a wider board",
    reason: "Connector clearance",
    affected: ["design"],
  };
  runtime.responses = [
    result({ affected: ["electronics"] }),
    result({ recommendations: [proposal] }),
    result({ affected: ["design"] }),
    result({ recommendations: [proposal] }),
  ];
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "Add a display", station: "electronics" });
  await settled(store, p.id, engine);
  assert.deepEqual(
    runtime.calls.map((c) => path.basename(c.cwd)),
    ["planning", "electronics", "planning", "design"],
  );
  assert.match(p.messages.at(-1)!.text, /remaining decisions/);
  assert.equal(p.changes[0].status, "completed");
});
test("invalid output leaves structured specification unchanged and shows genuine failure", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create(),
    runtime = new FakeRuntime();
  runtime.responses = ["not valid json"];
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "Build it", station: "design" });
  await settled(store, p.id, engine);
  assert.equal(p.revision, 0);
  assert.equal(p.scene.kind, "plasma");
  assert.equal(p.changes[0].status, "failed");
  assert.match(p.changes[0].error!, /valid Holo result/);
  assert.equal(p.messages.filter((m) => m.role === "assistant").length, 0);
});
test("invalid artifact references roll back the whole specialist result", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create(),
    runtime = new FakeRuntime();
  runtime.responses = [
    result({ affected: ["design"] }),
    result({
      scene: {
        kind: "custom",
        color: "#abcdef",
        width: 100,
        height: 60,
        depth: 40,
        parts: [],
      },
      artifacts: [{ path: "../../private.stl", name: "Invalid file" }],
    }),
  ];
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "Create a shape", station: "design" });
  await settled(store, p.id, engine);
  assert.equal(p.revision, 1);
  assert.equal(p.scene.kind, "plasma");
  assert.equal(p.artifacts.length, 0);
  assert.equal(p.changes[0].status, "failed");
  assert.match(p.changes[0].error!, /Artifact must be inside/);
  const saved = JSON.parse(
    await readFile(path.join(store.root(p.id), "project.json"), "utf8"),
  );
  assert.equal(saved.scene.kind, "plasma");
  assert.equal(saved.revision, 1);
});
test("a geometry-only correction invalidates the old assembly while keeping inspectable history", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create();
  await writeFile(
    path.join(store.workspace(p.id), "design/artifacts/model.stl"),
    "solid old\nendsolid old",
  );
  const old = await store.registerArtifact(
    p,
    "design",
    "design/artifacts/model.stl",
    "Old assembly",
    "assembly",
  );
  assert.equal(getPrimaryAssembly(p)?.id, old.id);
  const runtime = new FakeRuntime();
  runtime.responses = [
    result({ affected: ["design"] }),
    result({
      scene: {
        kind: "custom",
        color: "#abcdef",
        width: 130,
        height: 70,
        depth: 25,
        parts: [],
      },
    }),
  ];
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, {
    text: "Replace the old shape",
    station: "design",
  });
  await settled(store, p.id, engine);
  assert.equal(p.changes[0].status, "completed");
  assert.equal(getPrimaryAssembly(p), undefined);
  assert.equal(getCurrentArtifacts(p, "design").length, 0);
  assert.equal(p.domainState?.design?.revision, 2);
  assert.ok(p.artifacts.some((artifact) => artifact.id === old.id));
  const next = new ProjectStore(store.dataDir);
  await next.init();
  assert.equal(
    getPrimaryAssembly(next.get(p.id)),
    undefined,
    "Reload must not reactivate old geometry",
  );
});

test("structured artifact sets register roles and source revision inputs without discarding explanation-only deliverables", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create();
  const runtime = new FakeRuntime();
  runtime.runner = async (options) => {
    if (path.basename(options.cwd) === "planning")
      return result({ goals: ["A tangible object"], affected: ["design"] });
    await writeFile(
      path.join(options.cwd, "artifacts/shipping-form.stl"),
      "solid shape\nendsolid shape",
    );
    return result({
      artifacts: [
        {
          path: "design/artifacts/shipping-form.stl",
          name: "Complete assembly",
          role: "assembly",
        },
      ],
    });
  };
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "Create the design", station: "design" });
  await settled(store, p.id, engine);
  assert.equal(p.changes[0].status, "completed");
  const assembly = getPrimaryAssembly(p)!;
  assert.equal(assembly.role, "assembly");
  assert.equal(p.domainState?.design?.inputRevisions?.planning, 1);
  assert.match(
    runtime.calls[1].instructions,
    /complete current deliverable set/,
  );
  const recorded = structuredClone(p.domainState);
  runtime.runner = undefined;
  runtime.responses = [result()];
  await engine.enqueue(p.id, {
    text: "Explain the design",
    station: "planning",
  });
  await settled(store, p.id, engine);
  assert.equal(getPrimaryAssembly(p)?.id, assembly.id);
  assert.deepEqual(p.domainState, recorded);
});
test("changed planning intent and BOM invalidate unreplaced domain files without disturbing other domains", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create({ template: "wheel" });
  await writeFile(
    path.join(store.workspace(p.id), "electronics/artifacts/board.json"),
    "{}",
  );
  const board = await store.registerArtifact(
    p,
    "electronics",
    "electronics/artifacts/board.json",
  );
  const softwareIds = getCurrentArtifacts(p, "software").map(
    (artifact) => artifact.id,
  );
  assert.ok(getCurrentArtifacts(p, "planning").length);
  const runtime = new FakeRuntime();
  runtime.responses = [
    result({
      goals: ["Build a new device with different controls"],
      affected: ["electronics"],
    }),
    result({
      parts: [
        {
          ...p.parts[0],
          quantity: 2,
          manufacturerPart: null,
          estimatedCost: null,
          currency: null,
          sourceUrl: null,
        },
      ],
    }),
  ];
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, {
    text: "Change the intent and hardware",
    station: "planning",
  });
  await settled(store, p.id, engine);
  assert.equal(p.changes[0].status, "completed");
  assert.deepEqual(getCurrentArtifacts(p, "planning"), []);
  assert.deepEqual(getCurrentArtifacts(p, "electronics"), []);
  assert.deepEqual(
    getCurrentArtifacts(p, "software").map((artifact) => artifact.id),
    softwareIds,
  );
  assert.ok(p.artifacts.some((artifact) => artifact.id === board.id));
  assert.equal(p.domainState?.planning?.revision, 1);
  assert.equal(p.domainState?.electronics?.revision, 2);
});
test("formatting stalls retry once in the same thread without repeating successful tools", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create(),
    runtime = new FakeRuntime();
  let attempts = 0;
  runtime.runner = async () => {
    if (attempts++ === 0) throw new StructuredOutputStallError("stalled");
    return result();
  };
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "Record a goal", station: "planning" });
  await settled(store, p.id, engine);
  assert.equal(runtime.calls.length, 2);
  assert.equal(
    runtime.calls[1].threadId,
    runtime.calls[0].threadId || "thread-1",
  );
  assert.match(runtime.calls[1].prompt, /Do not repeat successful tools/);
  assert.equal(p.changes[0].status, "completed");
  runtime.runner = async () => {
    throw new StructuredOutputStallError("stalled again");
  };
  await engine.enqueue(p.id, { text: "Another request", station: "planning" });
  await settled(store, p.id, engine);
  assert.equal(runtime.calls.length, 4);
  assert.equal(p.changes[1].status, "failed");
});
test("cancel interrupts active work, cancels queued jobs, then accepts a new job", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create(),
    runtime = new FakeRuntime();
  runtime.runner = (options) =>
    new Promise((_, reject) =>
      options.signal?.addEventListener(
        "abort",
        () => reject(new Error("cancelled")),
        { once: true },
      ),
    );
  const engine = new StudioEngine(store, runtime, () => {});
  await engine.enqueue(p.id, { text: "First", station: "planning" });
  for (let i = 0; !runtime.calls.length && i < 100; i++)
    await new Promise((r) => setTimeout(r, 5));
  await engine.enqueue(p.id, { text: "Queued", station: "design" });
  await engine.cancel(p.id);
  await settled(store, p.id, engine);
  assert.ok(p.changes.every((c) => c.status === "cancelled"));
  assert.equal(runtime.calls.length, 1);
  runtime.runner = undefined;
  await engine.enqueue(p.id, { text: "Continue", station: "planning" });
  await settled(store, p.id, engine);
  assert.equal(p.changes.at(-1)!.status, "completed");
});
test("exports preserve artifact bytes and revision hash while denying symlinks and traversal", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create();
  const file = path.join(store.workspace(p.id), "design/artifacts/model.stl");
  await writeFile(file, "solid conceptual\nendsolid conceptual\n");
  const artifact = await store.registerArtifact(
    p,
    "design",
    "design/artifacts/model.stl",
  );
  await store.save(p);
  await writeFile(file, "changed source");
  const stored = await store.readArtifact(p.id, artifact.path);
  assert.match(await readFile(stored, "utf8"), /solid conceptual/);
  const entries = await exportEntries(store, p);
  const manifest = JSON.parse(
    String(entries.find((e) => e.name === "MANIFEST.json")!.data),
  );
  const record = manifest.files.find((f: any) => f.path === artifact.path);
  assert.equal(record.sha256, sha256(await readFile(stored)));
  assert.equal(record.sourceRevision, 0);
  await assert.rejects(
    () => store.readArtifact(p.id, "../project.json"),
    /registered/,
  );
  const outside = path.join(store.dataDir, "private.txt");
  await writeFile(outside, "private");
  await symlink(
    outside,
    path.join(store.workspace(p.id), "design/artifacts/link.stl"),
  );
  await assert.rejects(
    () => store.registerArtifact(p, "design", "design/artifacts/link.stl"),
    /Symbolic links/,
  );
  await assert.rejects(
    () =>
      store.registerArtifact(
        p,
        "design",
        "design/artifacts/../../specification.json",
      ),
    /Invalid artifact path/,
  );
});
test("BOM export escapes formulas and never invents missing prices", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const p = await store.create({ template: "wheel" });
  p.parts[0].name = '=HYPERLINK("bad")';
  const csv = bomCsv(p);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /Unverified proposal/);
  assert.ok(!csv.includes("undefined"));
});
test("artifact listing never imports uncommitted workspace files or overwrites a saved revision", async (t) => {
  const studio = await createStudioServer({
    dataDir: await temp(t),
    runtime: new FakeRuntime(),
  });
  t.after(() => studio.close());
  const p = await studio.store.create();
  const workspaceFile = path.join(
    studio.store.workspace(p.id),
    "design/artifacts/model.stl",
  );
  await writeFile(workspaceFile, "solid accepted\nendsolid accepted");
  const artifact = await studio.store.registerArtifact(
    p,
    "design",
    "design/artifacts/model.stl",
    "Assembly",
    "assembly",
  );
  await studio.store.save(p);
  await writeFile(workspaceFile, "uncommitted replacement from a failed run");
  await writeFile(
    path.join(studio.store.workspace(p.id), "design/artifacts/bracket.stl"),
    "uncommitted new part",
  );
  const server = await studio.listen(0);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const response = await fetch(base + `/api/projects/${p.id}/artifacts`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [artifact]);
  assert.match(
    await readFile(
      await studio.store.readArtifact(p.id, artifact.path),
      "utf8",
    ),
    /solid accepted/,
  );
  assert.equal(getPrimaryAssembly(p)?.id, artifact.id);
  assert.equal(p.revision, 0);
});
test("shipped conceptual behaviour files execute timer completion and wheel input examples", async (t) => {
  const store = new ProjectStore(await temp(t));
  await store.init();
  const enclosure = await store.create({ template: "enclosure" }),
    wheel = await store.create({ template: "wheel" });
  const load = async (id: string) => {
    const p = store.get(id),
      a = p.artifacts.find((a) => a.path.endsWith("/behavior.ts"))!;
    const module = await import(
      pathToFileURL(await store.readArtifact(id, a.path)).href
    );
    return module.default || module;
  };
  const timer = await load(enclosure.id);
  let state = timer.update(timer.initialState, {
    type: "reset",
    durationMs: 1000,
  });
  state = timer.update(state, { type: "button" });
  state = timer.update(state, { type: "tick", elapsedMs: 1200 });
  assert.deepEqual(state, { remainingMs: 0, running: false, completed: true });
  assert.throws(
    () => timer.update(state, { type: "tick", elapsedMs: -1 }),
    /nonnegative/,
  );
  const model = await load(wheel.id);
  for (const example of model.examples)
    assert.deepEqual(model.interpret(example.input), example.expected);
});
test("loopback API rejects hostile origins and form posts, returns persistent projects and downloadable ZIP", async (t) => {
  const studio = await createStudioServer({
    dataDir: await temp(t),
    runtime: new FakeRuntime(),
  });
  const server = await studio.listen(0);
  t.after(() => studio.close());
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const hostile = await fetch(base + "/api/projects", {
    method: "POST",
    headers: {
      Origin: "https://malicious.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(hostile.status, 403);
  const form = await fetch(base + "/api/projects", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(form.status, 415);
  const created = await fetch(base + "/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test invention" }),
  });
  assert.equal(created.status, 201);
  const p = await created.json();
  const list = await (await fetch(base + "/api/projects")).json();
  assert.equal(list[0].name, "Test invention");
  const file = await fetch(
    base + `/api/projects/${p.id}/files?path=project.json`,
  );
  assert.equal(file.status, 403);
  const zip = await fetch(base + `/api/projects/${p.id}/export`);
  assert.equal(zip.headers.get("Content-Type"), "application/zip");
  const bytes = Buffer.from(await zip.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
});
test("a data directory has one server owner and can reopen after close or stale lock", async (t) => {
  const dataDir = await temp(t);
  const first = await createStudioServer({
    dataDir,
    runtime: new FakeRuntime(),
  });
  await assert.rejects(
    () => createStudioServer({ dataDir, runtime: new FakeRuntime() }),
    /already using/,
  );
  await first.close();
  await writeFile(
    path.join(dataDir, ".workshop.lock"),
    JSON.stringify({ pid: 2147483647, token: "stale" }),
  );
  const next = await createStudioServer({
    dataDir,
    runtime: new FakeRuntime(),
  });
  await next.close();
});
test("studio preferences survive service restart on an independently assigned port", async (t) => {
  const dataDir = await temp(t),
    first = await createStudioServer({ dataDir, runtime: new FakeRuntime() });
  const server = await first.listen(0),
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const project = await first.store.create({ name: "Persistent idea" });
  const preferences = {
    lastProjectId: project.id,
    drafts: { [project.id]: "Leave 2 mm for clearance." },
    model: "test-model",
    effort: "high",
    reducedMotion: true,
    compactMode: true,
  };
  const saved = await fetch(base + "/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
  assert.equal(saved.status, 200);
  await first.close();
  const second = await createStudioServer({
    dataDir,
    runtime: new FakeRuntime(),
  });
  t.after(() => second.close());
  const nextServer = await second.listen(0),
    nextBase = `http://127.0.0.1:${(nextServer.address() as { port: number }).port}`;
  assert.deepEqual(
    await (await fetch(nextBase + "/api/preferences")).json(),
    preferences,
  );
  assert.equal(second.store.get(project.id).name, "Persistent idea");
  const invalid = await fetch(nextBase + "/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "not allowed" }),
  });
  assert.equal(invalid.status, 400);
});
