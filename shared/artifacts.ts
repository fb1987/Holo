import type {
  Artifact,
  DomainArtifactState,
  Project,
  Station,
} from "./types.js";

const domains: Station[] = ["planning", "design", "electronics", "software"];
const isModel = (artifact: Artifact) => /\.(glb|stl)$/i.test(artifact.path);
const partName =
  /(?:^|[\s_./-])(part|bracket|insert|carrier|clip|button|knob|fastener|screw|spacer|detail)(?:[\s_./-]|$)/i;
const assemblyName =
  /(?:^|[\s_./-])(assembly|assembled|complete|concept|model)(?:[\s_./-]|$)/i;

/** Legacy inference is presentation metadata only; it does not certify the file. */
export function inferArtifactRole(
  artifact: Artifact,
): NonNullable<Artifact["role"]> {
  if (artifact.role) return artifact.role;
  if (isModel(artifact)) {
    const label = `${artifact.name} ${artifact.path}`;
    if (partName.test(label)) return "part";
    if (/\.glb$/i.test(artifact.path) || assemblyName.test(label))
      return "assembly";
    return "other";
  }
  if (artifact.kind === "cad" || artifact.kind === "code") return "source";
  if (artifact.kind === "image") return "render";
  if (artifact.kind === "document") return "document";
  return "other";
}

/** Legacy projects have output batches but no reliable input dependency record. */
function legacyDomainState(
  project: Project,
  domain: Station,
): DomainArtifactState | undefined {
  const artifacts = project.artifacts.filter(
    (artifact) => artifact.domain === domain,
  );
  if (!artifacts.length) return undefined;
  const revision = Math.max(...artifacts.map((artifact) => artifact.revision));
  return {
    revision,
    artifactIds: artifacts
      .filter((artifact) => artifact.revision === revision)
      .map((artifact) => artifact.id),
  };
}

export function getDomainState(
  project: Project,
): NonNullable<Project["domainState"]> {
  return Object.fromEntries(
    domains.flatMap((domain) => {
      const state =
        project.domainState?.[domain] ?? legacyDomainState(project, domain);
      return state ? [[domain, state]] : [];
    }),
  );
}

export function getDomainRevisions(
  project: Project,
): Partial<Record<Station, number>> {
  return Object.fromEntries(
    Object.entries(getDomainState(project)).map(([domain, state]) => [
      domain,
      state.revision,
    ]),
  );
}

export function getCurrentArtifacts(
  project: Project,
  domain?: Station,
): Artifact[] {
  const state = getDomainState(project);
  const ids = new Set(
    (domain ? [domain] : domains).flatMap(
      (key) => state[key]?.artifactIds ?? [],
    ),
  );
  return project.artifacts.filter(
    (artifact) =>
      ids.has(artifact.id) && (!domain || artifact.domain === domain),
  );
}

export function getPrimaryAssembly(project: Project): Artifact | undefined {
  const candidates = getCurrentArtifacts(project, "design").filter(
    (artifact) =>
      isModel(artifact) && inferArtifactRole(artifact) === "assembly",
  );
  const explicit = candidates.find(
    (artifact) => artifact.id === project.primaryAssemblyId,
  );
  if (explicit) return explicit;
  // Prefer the newest assembly, its material-preserving GLB, then a stable path.
  // Array order must never promote a separately exported printable part.
  return candidates.sort(
    (a, b) =>
      b.revision - a.revision ||
      Number(/\.glb$/i.test(b.path)) - Number(/\.glb$/i.test(a.path)) ||
      a.path.localeCompare(b.path),
  )[0];
}

/** Mutates only metadata; stored geometry and history remain intact. */
export function normalizeArtifactState(project: Project): boolean {
  const before = JSON.stringify([
    project.domainState,
    project.primaryAssemblyId,
    project.source,
    project.artifacts.map((artifact) => artifact.role),
  ]);
  project.domainState = getDomainState(project);
  for (const artifact of project.artifacts)
    artifact.role = inferArtifactRole(artifact);
  project.primaryAssemblyId = getPrimaryAssembly(project)?.id;
  if (
    project.source === "example" &&
    project.messages.some((message) => message.role === "user") &&
    project.changes.some((change) => change.status === "completed") &&
    (project.scene.parts.length > 0 ||
      project.artifacts.some((artifact) => artifact.revision > 0))
  )
    project.source = "original";
  return (
    before !==
    JSON.stringify([
      project.domainState,
      project.primaryAssemblyId,
      project.source,
      project.artifacts.map((artifact) => artifact.role),
    ])
  );
}

/** Publish a complete domain deliverable set; canonical changes invalidate old files. */
export function recordDomainArtifacts(
  project: Project,
  domain: Station,
  artifactIds: string[],
  inputRevisions: Partial<Record<Station, number>>,
  preserveWhenEmpty = true,
) {
  project.domainState = getDomainState(project);
  project.domainState[domain] = {
    revision: project.revision,
    artifactIds: artifactIds.length
      ? [...new Set(artifactIds)]
      : preserveWhenEmpty
        ? (project.domainState[domain]?.artifactIds ?? [])
        : [],
    inputRevisions,
  };
  // An earlier valid pointer cannot override a newly published assembly.
  if (domain === "design" && (artifactIds.length || !preserveWhenEmpty))
    delete project.primaryAssemblyId;
  project.primaryAssemblyId = getPrimaryAssembly(project)?.id;
}
