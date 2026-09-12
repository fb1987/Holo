import archiver from "archiver";
import { readRecipePackage, unpackRecipePackage } from "./build/package.js";
import { promises as fs } from "node:fs";
import type { Response } from "express";
import type { Artifact, Project, Station } from "../shared/types.js";
import { ProjectStore, sha256 } from "./store.js";
import {
  getCurrentArtifacts,
  getDomainRevisions,
  getDomainState,
  getPrimaryAssembly,
  inferArtifactRole,
} from "../shared/artifacts.js";

export function csvCell(value: unknown) {
  let text = value === undefined || value === null ? "" : String(value);
  // Prevent spreadsheet formula execution in downloaded supplier lists.
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function bomCsv(p: Project) {
  const rows = [
    [
      "Item",
      "Quantity",
      "Category",
      "Description",
      "Manufacturer part",
      "Estimated unit cost",
      "Currency",
      "Source",
      "Verification",
    ],
  ];
  for (const part of p.parts)
    rows.push([
      part.name,
      String(part.quantity),
      part.category,
      part.description,
      part.manufacturerPart || "",
      part.estimatedCost === undefined ? "" : String(part.estimatedCost),
      part.currency || "",
      part.sourceUrl || "",
      part.verified
        ? "Recorded as verified — check source evidence"
        : "Unverified proposal",
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export async function exportEntries(store: ProjectStore, p: Project) {
  const currentArtifacts = getCurrentArtifacts(p);
  const currentIds = new Set(currentArtifacts.map((artifact) => artifact.id));
  const domainRevisions = getDomainRevisions(p);
  const primaryAssembly = getPrimaryAssembly(p);
  const domains = Object.fromEntries(
    Object.entries(getDomainState(p)).map(([domain, state]) => [
      domain,
      {
        revision: state.revision,
        files: currentArtifacts
          .filter((artifact) => artifact.domain === domain)
          .map((artifact) => artifact.path),
        inputRevisions: state.inputRevisions ?? null,
        changedInputs: state.inputRevisions
          ? Object.entries(state.inputRevisions)
              .filter(
                ([input, revision]) =>
                  input !== domain &&
                  domainRevisions[input as Station] !== revision,
              )
              .map(([input, revision]) => ({
                domain: input,
                recordedRevision: revision,
                currentRevision: domainRevisions[input as Station] ?? null,
              }))
          : null,
        compatibility: "not-assessed",
      },
    ]),
  );
  const entries: Array<{ name: string; data: Buffer | string }> = [];
  const add = (name: string, data: string | Buffer) =>
    entries.push({ name, data });
  // Retain structured engineering history, omit internal Codex thread IDs.
  const project = {
    ...p,
    agents: Object.fromEntries(
      Object.entries(p.agents).map(([key, { threadId: _, ...agent }]) => [
        key,
        agent,
      ]),
    ),
  };
  add("project.json", JSON.stringify(project, null, 2));
  if (p.acceptedDesign) {
    add("workshop/design.json", JSON.stringify(p.acceptedDesign.spec, null, 2));
    add(
      "workshop/accepted-build.json",
      JSON.stringify(p.acceptedDesign, null, 2),
    );
    const saved = p.artifacts.find(
      (a) => a.id === p.acceptedDesign?.sourcePackageId,
    );
    if (p.acceptedDesign.sourcePackageId && !saved)
      throw new Error("The accepted recipe source package is missing.");
    const bundle = saved
      ? JSON.parse(
          await fs.readFile(await store.readArtifact(p.id, saved.path), "utf8"),
        )
      : await readRecipePackage();
    for (const entry of unpackRecipePackage(bundle))
      add(entry.name, entry.data);
  }
  add("BOM.csv", bomCsv(p));
  add(
    "DELIVERABLES.md",
    `# Current deliverables\n\nProject revision ${p.revision}. Each domain has its own current set; a later software revision does not make the design historical. Current means the latest recorded deliverables, not validated compatibility, physical fit, or manufacturing readiness.\n\n${primaryAssembly ? `Primary assembly: [${primaryAssembly.name}](${encodeURI(primaryAssembly.path)}).` : "No current generated assembly is registered."}\n\n${Object.entries(
      domains,
    )
      .map(
        ([domain, state]) =>
          `## ${domain} · r${state.revision}\n\n${state.files.length ? state.files.map((file) => `- [${file.split("/").at(-1)}](${encodeURI(file)})`).join("\n") : "No current files."}\n\n${state.inputRevisions === null ? "Generation input revisions were not recorded for this legacy set. Compatibility is unassessed." : state.changedInputs?.length ? "Some input domains have changed since generation. Review the changedInputs record in MANIFEST.json; this is not an automatic incompatibility finding." : "Input revision context is recorded in MANIFEST.json. Compatibility remains unassessed."}`,
      )
      .join(
        "\n\n",
      )}\n\n## History\n\n${p.artifacts.length - currentArtifacts.length} earlier artifacts are retained at their original paths for traceability and marked historical in MANIFEST.json. Use the current files listed above for the handoff; historical files are not additional current deliverables.\n`,
  );
  add(
    "INTENT.md",
    `# ${p.name}\n\nRevision ${p.revision} • Build preference: ${p.buildMode}\n\n${p.description || "Description not yet established."}\n\n## Goals\n\n${p.goals.map((x) => "- " + x).join("\n") || "No goals recorded yet."}\n\n## Constraints\n\n${p.constraints.map((x) => "- " + x).join("\n") || "No constraints recorded yet."}\n\n## Decisions\n\n${p.decisions.map((d) => `- ${d.text} — ${d.reason} (r${d.revision})`).join("\n") || "No decisions recorded yet."}\n`,
  );
  add(
    "ASSEMBLY.md",
    `# Assembly handoff\n\nProject: ${p.name}, revision ${p.revision}.\n\nBuild preference: **${p.buildMode}**. This handoff collects the current concept and agent-generated deliverables. It does not certify fit, electrical safety, supplier availability, or a working physical build.\n\n${p.buildMode === "diy" ? "Prepare tools, fabricate parts, assemble electronics, load firmware, and perform the documented checks." : p.buildMode === "mixed" ? "Confirm which parts suppliers assemble and which steps remain at home. Verify connector compatibility and programming responsibilities before ordering." : "Request supplier confirmation of fabrication, board assembly, firmware programming, finishing, and acceptance testing."}\n\nReview generated domain artifacts for actual project-specific assembly instructions. If no such instructions exist, the build package is incomplete. Do not infer a wiring plan from a conceptual preview.\n\n## Specialist notes\n\n${
      p.messages
        .filter((m) => m.role === "assistant")
        .slice(-8)
        .map((m) => `### ${m.station}\n\n${m.text}`)
        .join("\n\n") || "No agent engineering work has been completed yet."
    }\n`,
  );
  add(
    "REQUEST-FOR-QUOTE.md",
    `# Request for quote draft\n\nProject: ${p.name}\nRevision: ${p.revision}\nBuild preference: ${p.buildMode}\n\nPlease review the enclosed files and identify missing information before quoting.\n\n- Confirm quantities, materials, tolerances, and surface finish.\n- Confirm PCB stack-up, fabrication capabilities, parts availability, and substitutions where applicable.\n- Specify assembly, programming, inspection, and functional testing responsibilities.\n- Quote prototype costs, production costs, lead time, shipping, and exclusions separately.\n- Confirm the exact file revisions used and obtain agreement before substitutions affecting fit or function.\n\nThis is a draft handoff, not a purchase order. No supplier has been contacted by exporting it.\n`,
  );
  const manifest: Array<{
    path: string;
    sha256: string;
    bytes: number;
    sourceRevision?: number;
    currentRevision?: boolean;
    domain?: Station;
    role?: Artifact["role"];
    status?: "current" | "historical";
    primaryAssembly?: boolean;
  }> = [];
  for (const artifact of p.artifacts) {
    const file = await store.readArtifact(p.id, artifact.path);
    const data = await fs.readFile(file);
    add(artifact.path, data);
    manifest.push({
      path: artifact.path,
      sha256: sha256(data),
      bytes: data.length,
      sourceRevision: artifact.revision,
      currentRevision: currentIds.has(artifact.id),
      domain: artifact.domain,
      role: inferArtifactRole(artifact),
      status: currentIds.has(artifact.id) ? "current" : "historical",
      primaryAssembly: artifact.id === primaryAssembly?.id,
    });
  }
  for (const entry of entries.filter((e) => !e.name.startsWith("artifacts/")))
    manifest.push({
      path: entry.name,
      sha256: sha256(entry.data),
      bytes: Buffer.byteLength(entry.data),
    });
  add(
    "MANIFEST.json",
    JSON.stringify(
      {
        format: "holo-build-package",
        version: 3,
        acceptedDesign: p.acceptedDesign
          ? {
              specHash: p.acceptedDesign.specHash,
              recipe: p.acceptedDesign.spec.recipe,
              recipeVersion: p.acceptedDesign.spec.recipeVersion,
              revision: p.acceptedDesign.revision,
              validationArtifact: p.acceptedDesign.validationId,
            }
          : null,
        latestOutcome: p.changes.at(-1)?.outcome ?? "unassessed",
        projectId: p.id,
        revision: p.revision,
        readiness: p.readiness,
        generatedAt: new Date().toISOString(),
        primaryAssembly: primaryAssembly?.path ?? null,
        domains,
        currentRevisionMeaning:
          "Membership in the current deliverable set for its domain; not equality with the global project revision or engineering approval.",
        validation:
          "Conceptual and agent-generated outputs require engineering and supplier review. Current domain sets are indexed in DELIVERABLES.md; historical artifacts are retained for traceability. Input snapshots record available context, not declared dependency requirements or validated compatibility.",
        files: manifest,
      },
      null,
      2,
    ),
  );
  return entries;
}
export async function streamExport(
  store: ProjectStore,
  p: Project,
  response: Response,
) {
  const entries = await exportEntries(store, p);
  response.setHeader("Content-Type", "application/zip");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${p.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)}-r${p.revision}.zip"`,
  );
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", () => response.destroy());
  response.on("close", () => archive.abort());
  archive.pipe(response);
  for (const entry of entries) archive.append(entry.data, { name: entry.name });
  await archive.finalize();
}
