import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID, createHash } from "node:crypto";
import type {
  Artifact,
  BuildMode,
  Part,
  Project,
  SceneSpec,
  Station,
} from "../shared/types.js";
import { stations } from "./schema.js";
import { sampleFiles } from "./templates.js";

export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export const defaultDataDir = () =>
  process.env.HOLO_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "Holo");
export const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

function templateScene(template: string): SceneSpec {
  if (template === "blank")
    return {
      kind: "plasma",
      color: "#a48aff",
      width: 160,
      height: 120,
      depth: 50,
      parts: [],
    };
  if (template === "wheel")
    return {
      kind: "wheel",
      color: "#596b72",
      width: 280,
      height: 175,
      depth: 48,
      parts: [],
    };
  return {
    kind: "enclosure",
    color: "#b7c2b9",
    width: 160,
    height: 100,
    depth: 48,
    parts: [],
  };
}
function templateParts(template: string): Part[] {
  if (template === "blank") return [];
  return [
    {
      id: "enclosure",
      name: template === "wheel" ? "Custom wheel shell" : "Custom enclosure",
      quantity: 1,
      category: "Fabrication",
      description:
        "Conceptual geometry. Wall thickness, tolerances, material, and manufacturing process need engineering review.",
      verified: false,
    },
    {
      id: "controller",
      name: "USB-capable microcontroller",
      quantity: 1,
      category: "Electronics",
      description:
        "Placeholder component class. A specific board and compatible electrical design have not been selected.",
      verified: false,
    },
    {
      id: "fasteners",
      name: "Enclosure fastener set",
      quantity: 1,
      category: "Assembly",
      description:
        "Fastener count, size, and mounting positions remain to be designed.",
      verified: false,
    },
  ];
}

export class ProjectStore {
  private projects = new Map<string, Project>();
  private writes = new Map<string, Promise<void>>();
  constructor(public dataDir = defaultDataDir()) {}
  async init() {
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    for (const item of await fs.readdir(this.dataDir, {
      withFileTypes: true,
    })) {
      if (!item.isDirectory() || !/^[a-f0-9-]{36}$/.test(item.name)) continue;
      try {
        const p: Project = JSON.parse(
          await fs.readFile(
            path.join(this.dataDir, item.name, "project.json"),
            "utf8",
          ),
        );
        if (p.id !== item.name || !p.agents || !Array.isArray(p.changes))
          continue;
        let interrupted = false;
        for (const c of p.changes)
          if (c.status === "running" || c.status === "queued") {
            c.status = "failed";
            c.error =
              "Holo closed before this change completed. Send a new request to continue.";
            interrupted = true;
          }
        for (const s of stations)
          if (
            p.agents[s].status === "working" ||
            p.agents[s].status === "waiting"
          ) {
            p.agents[s].status = "idle";
            p.agents[s].summary = "Previous session ended.";
          }
        this.projects.set(p.id, p);
        if (interrupted) await this.save(p);
      } catch {
        /* A damaged project is not silently overwritten. */
      }
    }
  }
  list() {
    return [...this.projects.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  get(id: string) {
    const p = this.projects.get(id);
    if (!p) throw new StudioError("Project not found.", 404);
    return p;
  }
  root(id: string) {
    this.get(id);
    return path.join(this.dataDir, id);
  }
  workspace(id: string) {
    return path.join(this.root(id), "workspace");
  }
  async create(
    input: {
      name?: string;
      description?: string;
      buildMode?: BuildMode;
      template?: string;
    } = {},
  ) {
    const template = input.template || "blank",
      time = now();
    const p: Project = {
      id: uid(),
      name:
        input.name ||
        (template === "wheel"
          ? "Steering wheel concept"
          : template === "enclosure"
            ? "Connected enclosure"
            : "Untitled invention"),
      description: input.description || "",
      createdAt: time,
      updatedAt: time,
      revision: 0,
      buildMode: input.buildMode || "mixed",
      constraints: [],
      goals: [],
      scene: templateScene(template),
      parts: templateParts(template),
      artifacts: [],
      messages: [],
      decisions: [],
      changes: [],
      agents: Object.fromEntries(
        stations.map((s) => [
          s,
          {
            station: s,
            status: "idle",
            summary: "Ready when you are.",
            lastRevision: 0,
          },
        ]),
      ) as Project["agents"],
      readiness: "concept",
      source: template === "blank" ? "original" : "example",
    };
    if (template !== "blank")
      p.messages.push({
        id: uid(),
        role: "system",
        station: "planning",
        text: "This is a conceptual example, not an engineered or supplier-verified design. Its geometry and component classes are starting points for exploration.",
        createdAt: time,
      });
    if (template !== "blank") {
      p.goals =
        template === "wheel"
          ? [
              "Explore a compact simulator steering wheel with configurable controls.",
              "Make the control layout easy to understand and reach.",
            ]
          : [
              "Explore an enclosure for a small connected desktop device.",
              "Keep the enclosure accessible for assembly and later revisions.",
            ];
      p.constraints = [
        "Conceptual example: dimensions and fit require engineering review.",
        "Boards, connectors and electrical interfaces are not yet selected.",
      ];
    }
    this.projects.set(p.id, p);
    await fs.mkdir(this.workspace(p.id), { recursive: true, mode: 0o700 });
    for (const station of stations) {
      await fs.mkdir(path.join(this.workspace(p.id), station, "artifacts"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(this.workspace(p.id), station, "AGENTS.md"),
        domainInstructions(station),
      );
    }
    await this.save(p);
    for (const file of sampleFiles(template)) {
      await fs.writeFile(
        path.join(
          this.workspace(p.id),
          file.station,
          "artifacts",
          file.filename,
        ),
        file.content,
      );
      await this.registerArtifact(
        p,
        file.station,
        `${file.station}/artifacts/${file.filename}`,
        file.name,
      );
    }
    if (p.artifacts.length) await this.save(p);
    return p;
  }
  async save(p: Project) {
    p.updatedAt = now();
    this.projects.set(p.id, p);
    const data = JSON.stringify(p, null, 2);
    const spec = JSON.stringify(
      {
        id: p.id,
        name: p.name,
        description: p.description,
        revision: p.revision,
        buildMode: p.buildMode,
        goals: p.goals,
        constraints: p.constraints,
        scene: p.scene,
        parts: p.parts,
        decisions: p.decisions,
        artifacts: p.artifacts,
        readiness: p.readiness,
      },
      null,
      2,
    );
    const previous = this.writes.get(p.id) || Promise.resolve();
    const write = previous
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(this.root(p.id), { recursive: true, mode: 0o700 });
        await atomicWrite(path.join(this.root(p.id), "project.json"), data);
        await fs.mkdir(this.workspace(p.id), { recursive: true });
        await atomicWrite(
          path.join(this.workspace(p.id), "specification.json"),
          spec,
        );
      });
    this.writes.set(p.id, write);
    await write;
  }
  async snapshot(p: Project) {
    const dir = path.join(this.root(p.id), "revisions");
    await fs.mkdir(dir, { recursive: true });
    await atomicWrite(
      path.join(dir, `r${p.revision}.json`),
      JSON.stringify(p, null, 2),
    );
  }
  async registerArtifact(
    p: Project,
    station: Station,
    relative: string,
    name?: string,
  ): Promise<Artifact> {
    const normalized = relative.replaceAll("\\", "/");
    if (!normalized.startsWith(`${station}/artifacts/`))
      throw new StudioError(`Artifact must be inside ${station}/artifacts/.`);
    const source = await safeFile(this.workspace(p.id), normalized);
    const data = await fs.readFile(source);
    if (data.length > 100 * 1024 * 1024)
      throw new StudioError("Artifact exceeds the 100 MB limit.");
    const suffix = normalized.slice(`${station}/artifacts/`.length);
    if (
      suffix.split("/").some((x) => x.startsWith(".")) ||
      /\.(pem|key|env)$/i.test(suffix)
    )
      throw new StudioError(
        "Private and hidden files cannot be registered as artifacts.",
      );
    const out = `artifacts/r${p.revision}/${station}/${suffix}`;
    const destination = path.join(this.root(p.id), out);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await atomicWrite(destination, data);
    const artifact: Artifact = {
      id: sha256(out).slice(0, 20),
      name: name || path.basename(source),
      path: out,
      kind: artifactKind(source),
      domain: station,
      revision: p.revision,
      bytes: data.length,
    };
    p.artifacts = p.artifacts.filter((a) => a.path !== out);
    p.artifacts.push(artifact);
    return artifact;
  }
  async scanArtifacts(p: Project, station?: Station, persist = true) {
    for (const s of station ? [station] : stations) {
      const files = await walkFiles(
        path.join(this.workspace(p.id), s, "artifacts"),
      );
      for (const file of files) {
        const source = `${s}/artifacts/${file}`;
        const already = p.artifacts.find((a) =>
          a.path.endsWith(`/${s}/${file}`),
        );
        if (already) {
          try {
            if (
              sha256(
                await fs.readFile(
                  await safeFile(this.root(p.id), already.path),
                ),
              ) ===
              sha256(
                await fs.readFile(await safeFile(this.workspace(p.id), source)),
              )
            )
              continue;
          } catch {}
        }
        await this.registerArtifact(p, s, source);
      }
    }
    if (persist) await this.save(p);
    return p.artifacts;
  }
  async readArtifact(id: string, relative: string) {
    const p = this.get(id);
    if (!p.artifacts.some((a) => a.path === relative))
      throw new StudioError(
        "Only registered project artifacts can be opened.",
        403,
      );
    return safeFile(this.root(id), relative);
  }
}

export async function atomicWrite(file: string, data: string | Buffer) {
  const temp = `${file}.${uid()}.tmp`;
  await fs.writeFile(temp, data, { mode: 0o600 });
  await fs.rename(temp, file);
}
export async function safeFile(root: string, relative: string) {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes("\0") ||
    relative.split(/[\\/]/).some((x) => x === ".." || x === "")
  )
    throw new StudioError("Invalid artifact path.", 403);
  const resolved = path.resolve(root, relative),
    base = await fs.realpath(root);
  let current = path.resolve(root);
  for (const segment of relative.split(/[\\/]/)) {
    current = path.join(current, segment);
    if ((await fs.lstat(current)).isSymbolicLink())
      throw new StudioError(
        "Symbolic links cannot be exported or opened.",
        403,
      );
  }
  const canonical = await fs.realpath(resolved);
  if (
    !canonical.startsWith(base + path.sep) ||
    (await fs.stat(canonical)).isDirectory()
  )
    throw new StudioError("Artifact is outside the project.", 403);
  return canonical;
}
async function walkFiles(root: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => [])) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory())
      out.push(...(await walkFiles(path.join(root, entry.name), relative)));
    else if (entry.isFile()) out.push(relative);
    if (out.length > 1000)
      throw new StudioError(
        "Too many artifact files. Keep generated deliverables under artifacts/.",
      );
  }
  return out;
}
function artifactKind(file: string): Artifact["kind"] {
  const ext = path.extname(file).toLowerCase();
  if ([".step", ".stp", ".fcstd", ".blend", ".dxf", ".scad"].includes(ext))
    return "cad";
  if ([".stl", ".glb", ".gltf", ".obj", ".3mf"].includes(ext)) return "mesh";
  if ([".kicad_pcb", ".kicad_sch", ".gbr", ".gerber"].includes(ext))
    return "pcb";
  if ([".py", ".ts", ".js", ".c", ".cpp", ".h", ".ino", ".rs"].includes(ext))
    return "code";
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) return "image";
  if ([".md", ".txt", ".pdf", ".csv", ".json"].includes(ext)) return "document";
  return "other";
}
export function domainInstructions(station: Station) {
  return `# Holo ${station} workstation\n\nYou are the ${station} specialist on one invention, working within this directory. Read ../specification.json as the authoritative current revision. Other domains are siblings and are read-only context. Keep your durable notes in MEMORY.md. Write deliverables ONLY in this directory's artifacts/ folder; final structured artifact paths use ${station}/artifacts/<filename>. Do not modify specification.json: Holo validates and commits structured changes. Never access credentials, personal files outside this project, or send messages, purchase parts, deploy, or publish without explicit user authorization. Use installed tools when appropriate and report tool failures truthfully. Do not claim tests, supplier verification, PCB routing, or fabrication readiness without evidence. Output real files; procedural scene previews are conceptual geometry, not manufacturing CAD. Produce STEP/STL with CadQuery/OpenSCAD or Blender outputs where installed; preserve editable source. Pin units in all geometry and documents. Electronics must document power, interfaces, pin mappings, assembly assumptions, and checks still needed. Software must preserve those hardware interfaces and include build/test instructions. Changes that affect another discipline belong in recommendations with footprint and power consequences, for the planning agent to arbitrate.\n`;
}
