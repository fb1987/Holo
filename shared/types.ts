import type { DesignSpec } from "./design.js";
export type Station = "planning" | "design" | "electronics" | "software";
export type BuildMode = "diy" | "mixed" | "finished";
export type Vec3 = [number, number, number];
export interface ScenePart {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere" | "torus";
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  domain: "mechanical" | "electronics";
  description?: string;
}
export interface SceneSpec {
  kind: "plasma" | "wheel" | "enclosure" | "custom";
  color: string;
  width: number;
  height: number;
  depth: number;
  exploded?: boolean;
  parts: ScenePart[];
}
export interface Part {
  id: string;
  name: string;
  quantity: number;
  category: string;
  description: string;
  manufacturerPart?: string;
  estimatedCost?: number;
  currency?: string;
  sourceUrl?: string;
  verified: boolean;
}
export interface Artifact {
  id: string;
  name: string;
  path: string;
  kind: "cad" | "mesh" | "pcb" | "code" | "document" | "image" | "other";
  domain: Station;
  revision: number;
  bytes?: number;
  role?: "assembly" | "part" | "source" | "render" | "document" | "other";
}
export interface DomainArtifactState {
  /** Global revision at which this domain's current deliverable set was recorded. */
  revision: number;
  artifactIds: string[];
  /** Available domain revisions at generation start, not a compatibility approval. */
  inputRevisions?: Partial<Record<Station, number>>;
}
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  station: Station;
  text: string;
  createdAt: string;
  jobId?: string;
}
export interface Decision {
  id: string;
  text: string;
  reason: string;
  createdAt: string;
  revision: number;
}
export interface ChangeRequest {
  id: string;
  summary: string;
  reason: string;
  affected: Station[];
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  fromRevision: number;
  toRevision?: number;
  createdAt: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  runs?: AgentRunRecord[];
  outcome?: "succeeded" | "partial" | "blocked" | "failed";
  requiredOutputs?: string[];
  deliveredOutputs?: string[];
  specHash?: string;
}
export interface AgentRunRecord {
  kind?: "agent" | "build" | "cad" | "render";
  recipe?: string;
  cached?: boolean;
  geometryCached?: boolean;
  elapsedMs?: number;
  errorKind?: string;
  station: Station;
  model?: string;
  effort?: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  toolCalls: number;
  retries: number;
}
/** Transient visual hypothesis. Never a deliverable or canonical revision. */
export interface ConceptPreview {
  projectId: string;
  jobId: string;
  stage: "sketch" | "concept" | "coarse" | "refined";
  specHash?: string;
  artifactUrl?: string;
  scene: SceneSpec;
  model: string;
  elapsedMs: number;
}
export interface AgentState {
  station: Station;
  threadId?: string;
  status: "idle" | "working" | "waiting" | "error";
  summary: string;
  lastRevision: number;
}
export interface Project {
  designSpec?: DesignSpec;
  acceptedDesign?: {
    spec: DesignSpec;
    specHash: string;
    geometryKey: string;
    revision: number;
    assemblyId: string;
    validationId: string;
    sourcePackageId?: string;
  };
  source?: "example" | "original";
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  buildMode: BuildMode;
  constraints: string[];
  goals: string[];
  scene: SceneSpec;
  parts: Part[];
  artifacts: Artifact[];
  primaryAssemblyId?: string;
  domainState?: Partial<Record<Station, DomainArtifactState>>;
  messages: Message[];
  decisions: Decision[];
  changes: ChangeRequest[];
  agents: Record<Station, AgentState>;
  readiness: "concept" | "in-development" | "ready-for-review";
}
export interface RuntimeStatus {
  available: boolean;
  connected: boolean;
  authenticated: boolean;
  accountType?: string;
  planType?: string;
  model?: string;
  error?: string;
  tools: { blender: boolean; kicad: boolean; python: boolean };
}
export interface ModelOption {
  id: string;
  displayName: string;
  description?: string;
  isDefault?: boolean;
  supportedReasoningEfforts?: Array<{
    reasoningEffort: string;
    description?: string;
  }>;
  defaultReasoningEffort?: string;
}
export interface ApprovalRequest {
  id: string;
  projectId: string;
  title: string;
  detail: string;
  method: string;
}
export type StudioEvent =
  | { type: "project"; project: Project }
  | {
      type: "preview";
      projectId: string;
      preview: ConceptPreview | null;
      jobId?: string;
      specHash?: string;
    }
  | { type: "delta"; projectId: string; station: Station; text: string }
  | { type: "status"; projectId: string; station: Station; status: string }
  | { type: "approval"; approval: ApprovalRequest }
  | { type: "error"; projectId?: string; message: string }
  | { type: "runtime"; runtime: RuntimeStatus };

export interface StudioPreferences {
  compactMode?: boolean;
  lastProjectId?: string | null;
  drafts?: Record<string, string>;
  model?: string;
  effort?: string;
  reducedMotion?: boolean;
}
