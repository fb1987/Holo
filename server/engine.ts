import path from "node:path";
import type {
  ApprovalRequest,
  ChangeRequest,
  Project,
  Station,
  StudioEvent,
} from "../shared/types.js";
import {
  StructuredOutputStallError,
  type AgentRuntime,
  type RpcMessage,
} from "./codex.js";
import {
  schemaForStation,
  outputSchema,
  stations,
  type AgentOutput,
} from "./schema.js";
import {
  domainInstructions,
  now,
  ProjectStore,
  StudioError,
  uid,
} from "./store.js";

type Job = {
  id: string;
  text: string;
  station: Station;
  model?: string;
  effort?: string;
};
export class StudioEngine {
  private queues = new Map<string, Job[]>();
  private active = new Map<string, AbortController>();
  private pending = new Map<
    string,
    { approval: ApprovalRequest; rpc: RpcMessage; station: Station }
  >();
  constructor(
    public store: ProjectStore,
    public runtime: AgentRuntime,
    private emit: (event: StudioEvent) => void,
  ) {
    runtime.on("runtime", (runtime) => emit({ type: "runtime", runtime }));
    runtime.on("request", (rpc: RpcMessage) => this.requestApproval(rpc));
  }
  isBusy(id: string) {
    return this.active.has(id) || (this.queues.get(id)?.length || 0) > 0;
  }
  assertIdle(id: string) {
    if (this.isBusy(id))
      throw new StudioError(
        "An agent is updating this project. Wait or cancel before changing project settings.",
        409,
      );
  }
  approvals() {
    return [...this.pending.values()].map((p) => p.approval);
  }
  private async publish(p: Project) {
    await this.store.save(p);
    this.emit({ type: "project", project: p });
  }
  async enqueue(id: string, input: Omit<Job, "id">) {
    const p = this.store.get(id);
    const runtime = await this.runtime.connect();
    if (!runtime.authenticated)
      throw new StudioError("Sign in to Codex before sending a request.", 401);
    const models = await this.runtime.models();
    if (
      input.model &&
      models.length &&
      !models.some((m) => m.id === input.model)
    )
      throw new StudioError(
        "This model is not available from your Codex runtime. Refresh the model list.",
      );
    const selected =
      models.find((m) => m.id === input.model) ||
      models.find((m) => m.isDefault);
    if (
      input.effort &&
      selected?.supportedReasoningEfforts?.length &&
      !selected.supportedReasoningEfforts.some(
        (e) => e.reasoningEffort === input.effort,
      )
    )
      throw new StudioError(
        "The selected reasoning effort is not available for this model.",
      );
    const job: Job = {
      ...input,
      id: uid(),
      model: input.model || selected?.id,
      effort:
        input.effort ||
        (selected?.supportedReasoningEfforts?.some(
          (e) => e.reasoningEffort === "high",
        )
          ? "high"
          : selected?.defaultReasoningEffort || "high"),
    };
    p.messages.push({
      id: uid(),
      role: "user",
      station: input.station,
      text: input.text,
      createdAt: now(),
      jobId: job.id,
    });
    p.changes.push({
      id: job.id,
      summary: input.text.slice(0, 160),
      reason: "User intent awaiting strategic planning.",
      affected: ["planning"],
      status: "queued",
      fromRevision: p.revision,
      createdAt: now(),
    });
    const queue = this.queues.get(id) || [];
    queue.push(job);
    this.queues.set(id, queue);
    await this.publish(p);
    this.schedule(id);
    return { jobId: job.id };
  }
  private schedule(id: string) {
    void this.drain(id).catch((error) =>
      this.emit({
        type: "error",
        projectId: id,
        message:
          error instanceof Error
            ? error.message
            : "The project could not be saved.",
      }),
    );
  }
  private async drain(id: string) {
    if (this.active.has(id)) return;
    const queue = this.queues.get(id);
    if (!queue?.length) return;
    const ctrl = new AbortController();
    this.active.set(id, ctrl);
    try {
      while (queue.length && !ctrl.signal.aborted) {
        const job = queue.shift()!,
          p = this.store.get(id),
          change = p.changes.find((c) => c.id === job.id)!;
        change.fromRevision = p.revision;
        change.status = "running";
        await this.publish(p);
        try {
          const plan = await this.runStation(
            p,
            job,
            "planning",
            ctrl.signal,
            `Interpret and resolve this user intent: ${job.text}\nThe user is looking from the ${job.station} perspective. Set affected only to specialists whose work needs to change. Planning owns goals, constraints, and trade-offs. For visual or geometry requests include design. Do not perform another specialist's work yourself.`,
            change,
          );
          change.reason = plan.summary;
          change.affected = [
            "planning",
            ...new Set(plan.affected.filter((s) => s !== "planning")),
          ];
          const proposals: AgentOutput["recommendations"] = [];
          for (const station of stations.filter(
            (s) => s !== "planning" && change.affected.includes(s),
          )) {
            const result = await this.runStation(
              p,
              job,
              station,
              ctrl.signal,
              `Implement your part of this approved request: ${job.text}\nStrategic brief: ${plan.response}\nWork from the latest ../specification.json and sibling deliverables. Produce useful real artifacts now when the intent calls for them.`,
              change,
            );
            proposals.push(...result.recommendations);
          }
          if (proposals.length) {
            const arbitration = await this.runStation(
              p,
              job,
              "planning",
              ctrl.signal,
              `Arbitrate these specialist recommendations against the user's original intent: ${job.text}\n${JSON.stringify(proposals)}\nApprove only necessary changes. affected is the list of specialists authorized for ONE final correction round. If unresolved alternatives need the user's preference, explain them in response and leave affected empty. Pay particular attention to software changes causing enclosure or PCB footprint changes.`,
              change,
            );
            const leftovers: AgentOutput["recommendations"] = [];
            for (const station of stations.filter(
              (s) => s !== "planning" && arbitration.affected.includes(s),
            )) {
              const result = await this.runStation(
                p,
                job,
                station,
                ctrl.signal,
                `Final correction round authorized by the strategist: ${arbitration.response}\nOriginal intent: ${job.text}\nImplement the approved correction only. Return any unresolved cross-domain issue as a recommendation; do not start another negotiation.`,
                change,
              );
              leftovers.push(...result.recommendations);
            }
            if (leftovers.length)
              p.messages.push({
                id: uid(),
                role: "system",
                station: "planning",
                text:
                  "The specialists reported remaining decisions for your next request:\n" +
                  leftovers
                    .map((r) => `• ${r.proposal} — ${r.reason}`)
                    .join("\n"),
                createdAt: now(),
                jobId: job.id,
              });
          }
          if (ctrl.signal.aborted) throw new Error("Change cancelled.");
          change.status = "completed";
          change.toRevision = p.revision;
          // A completed agent turn is never equivalent to manufacturing verification.
          p.readiness =
            p.scene.kind === "plasma" ? "concept" : "in-development";
        } catch (error) {
          change.status = ctrl.signal.aborted ? "cancelled" : "failed";
          change.error = error instanceof Error ? error.message : String(error);
          p.messages.push({
            id: uid(),
            role: "system",
            station: "planning",
            text: change.error,
            createdAt: now(),
            jobId: job.id,
          });
          if (!ctrl.signal.aborted)
            this.emit({ type: "error", projectId: id, message: change.error });
        }
        for (const station of stations)
          if (
            p.agents[station].status === "working" ||
            p.agents[station].status === "waiting"
          )
            p.agents[station].status = "idle";
        await this.publish(p);
        if (change.status === "completed") await this.store.snapshot(p);
      }
    } finally {
      this.active.delete(id);
      if (this.queues.get(id)?.length) this.schedule(id);
    }
  }
  private async runStation(
    p: Project,
    job: Job,
    station: Station,
    signal: AbortSignal,
    brief: string,
    change: ChangeRequest,
  ) {
    if (signal.aborted) throw new Error("Change cancelled.");
    const agent = p.agents[station];
    agent.status = "working";
    agent.summary =
      station === "planning"
        ? "Aligning intent and consequences…"
        : "Developing this perspective…";
    await this.publish(p);
    const revision = p.revision;
    const instructions =
      domainInstructions(station) +
      `\nRespond using the supplied structured output schema. response is the user-facing explanation in readable Markdown; never claim outputs that do not exist. summary is a short activity summary. Use null for fields that should not change. Every scene part uses millimetres and rotation in radians, scene dimensions use millimetres, right-handed coordinates with +Y up, +Z towards the viewer. Torus size is [outer diameter,tube diameter,depth]. Preserve stable part IDs. Keep geometry within the scene dimensions and use clearly separated mechanical/electronics domains. A procedural scene is a conceptual preview. Only design may change scene. Only electronics may replace parts. Only planning may change goals or constraints. BOM verified must be false: supplier/physical verification is outside this model's authority. Do not run paid API calls, install global software, publish, or contact suppliers. You can create a local deliverable with tools available in your assigned directory. Artifacts paths must be ${station}/artifacts/<filename>, only after writing the real file. Keep final outputs concise enough for the user to understand what changed.\n`;
    const prompt = `Project ${p.name}; revision ${revision}; build preference ${p.buildMode}.\n${brief}\n\n${this.runtime.toolInstructions?.() || ""}\nCurrent canonical specification:\n${JSON.stringify({ description: p.description, goals: p.goals, constraints: p.constraints, scene: p.scene, parts: p.parts, decisions: p.decisions.slice(-20), artifacts: p.artifacts })}\n\nCurrent change ID: ${change.id}. Read local project files if needed. Your workspace is ${station}/; other domain folders are read-only. Planning should set a concise project name when it is still Untitled invention, and maintain a plain-language description of the intended object. Only planning may update name or description; other specialists return null. Preserve a deliberate existing name unless the user's request calls for a rename. If an essential detail is missing, use response to ask the user and do not invent a commitment. Do not use request_user_input tools: Holo displays your response directly. Return a complete structured result.`;
    try {
      const run = (retry = false) =>
        this.runtime.run({
          threadId: agent.threadId,
          cwd: path.join(this.store.workspace(p.id), station),
          model: job.model,
          effort: job.effort,
          instructions,
          prompt: retry
            ? `${prompt}\nYour previous tool work is already present, but the structured response stalled. Do not repeat successful tools. Read existing deliverables and return compact JSON using empty arrays [] where appropriate. No formatting whitespace outside the JSON strings.`
            : prompt,
          outputSchema: schemaForStation(station),
          signal,
          onThread: async (id) => {
            agent.threadId = id;
            await this.publish(p);
          },
          onEvent: (method, params) => {
            if (method === "holo/idle" && agent.status !== "waiting")
              this.emit({
                type: "status",
                projectId: p.id,
                station,
                status:
                  "Waiting for Codex to continue. You can cancel this request at any time.",
              });
            if (method === "error") {
              const message =
                params.error?.message ||
                params.message ||
                "The model provider reported an error.";
              this.emit({
                type: "status",
                projectId: p.id,
                station,
                status: params.willRetry
                  ? `Provider retrying: ${message}`
                  : message,
              });
            }
            if (method === "item/agentMessage/delta") {
              // Structured final JSON is applied atomically below. Commentary is
              // streamed only when the runtime labels it as prose.
              if (params.phase === "commentary")
                this.emit({
                  type: "delta",
                  projectId: p.id,
                  station,
                  text: params.delta,
                });
            }
            if (method === "item/started") {
              const kind = params.item?.type;
              const status =
                kind === "commandExecution"
                  ? "Running project tools…"
                  : kind === "fileChange"
                    ? "Updating project files…"
                    : kind === "webSearch"
                      ? "Researching references…"
                      : kind === "reasoning"
                        ? "Considering the design…"
                        : kind === "agentMessage" &&
                            params.item.phase === "final_answer"
                          ? "Preparing your result…"
                          : undefined;
              if (status)
                this.emit({ type: "status", projectId: p.id, station, status });
            }
          },
        });
      let raw: string;
      try {
        raw = await run();
      } catch (error) {
        if (!(error instanceof StructuredOutputStallError) || signal.aborted)
          throw error;
        this.emit({
          type: "status",
          projectId: p.id,
          station,
          status:
            "Retrying the response format; preserving completed tool work…",
        });
        raw = await run(true);
      }
      if (signal.aborted) throw new Error("Change cancelled.");
      if (p.revision !== revision)
        throw new StudioError(
          "Project revision changed during generation. This result was not applied.",
          409,
        );
      let output: AgentOutput;
      try {
        output = outputSchema.parse(JSON.parse(raw));
      } catch {
        throw new Error(
          "The agent did not return a valid Holo result. No structured design changes were applied. Send a request to retry.",
        );
      }
      // Stage the entire result separately. Invalid or absent deliverables must
      // not commit geometry, BOM, or revision changes to the live project.
      const candidate = structuredClone(p);
      this.applyOutput(candidate, station, output);
      candidate.revision++;
      for (const artifact of output.artifacts)
        await this.store.registerArtifact(
          candidate,
          station,
          artifact.path,
          artifact.name,
        );
      await this.store.scanArtifacts(candidate, station, false);
      if (signal.aborted) throw new Error("Change cancelled.");
      if (p.revision !== revision)
        throw new StudioError(
          "Project changed before this result could be committed.",
          409,
        );
      // New user requests may have joined the queue while files were staged.
      // Preserve those operational records and commit only domain state.
      p.name = candidate.name;
      p.description = candidate.description;
      p.goals = candidate.goals;
      p.constraints = candidate.constraints;
      p.scene = candidate.scene;
      p.parts = candidate.parts;
      p.decisions = candidate.decisions;
      p.artifacts = candidate.artifacts;
      p.revision = candidate.revision;
      p.messages.push({
        id: uid(),
        role: "assistant",
        station,
        text: output.response,
        createdAt: now(),
        jobId: job.id,
      });
      agent.status = "idle";
      agent.summary = output.summary;
      agent.lastRevision = p.revision;
      await this.publish(p);
      await this.store.snapshot(p);
      return output;
    } catch (error) {
      agent.status = signal.aborted ? "idle" : "error";
      agent.summary = error instanceof Error ? error.message : "Agent failed.";
      throw error;
    }
  }
  private applyOutput(p: Project, station: Station, out: AgentOutput) {
    if (station === "planning") {
      if (out.name) p.name = out.name;
      if (out.description !== null) p.description = out.description;
      if (out.goals) p.goals = out.goals;
      if (out.constraints) p.constraints = out.constraints;
    }
    if (station === "design" && out.scene) {
      const ids = out.scene.parts.map((part) => part.id);
      if (new Set(ids).size !== ids.length)
        throw new StudioError("The design contains duplicate scene part IDs.");
      p.scene = out.scene;
    }
    if (station === "electronics" && out.parts)
      p.parts = out.parts.map((part) => {
        const result = Object.fromEntries(
          Object.entries(part).filter(([, v]) => v !== null),
        );
        return { ...result, verified: false } as Project["parts"][number];
      });
    if (station === "planning")
      for (const decision of out.decisions)
        p.decisions.push({
          id: uid(),
          ...decision,
          createdAt: now(),
          revision: p.revision + 1,
        });
  }
  async cancel(id: string) {
    const p = this.store.get(id);
    this.active.get(id)?.abort();
    const queue = this.queues.get(id);
    if (queue) queue.length = 0;
    for (const c of p.changes)
      if (c.status === "queued") {
        c.status = "cancelled";
        c.error = "Cancelled by the user.";
      }
    for (const [approvalId, pending] of this.pending)
      if (pending.approval.projectId === id)
        this.approve(approvalId, "decline");
    await this.publish(p);
    return { ok: true };
  }
  private requestApproval(rpc: RpcMessage) {
    const threadId = rpc.params?.threadId;
    const p = this.store
      .list()
      .find((p) => stations.some((s) => p.agents[s].threadId === threadId));
    const station = p
      ? stations.find((s) => p.agents[s].threadId === threadId)
      : undefined;
    if (
      !p ||
      !station ||
      ![
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/permissions/requestApproval",
      ].includes(rpc.method || "")
    ) {
      this.runtime.reject(
        rpc.id!,
        "Holo does not support this request. Ask the user in the final response instead.",
      );
      return;
    }
    const approval: ApprovalRequest = {
      id: uid(),
      projectId: p.id,
      title: rpc.method?.includes("fileChange")
        ? "Approve file changes"
        : rpc.method?.includes("permissions")
          ? "Approve additional access"
          : "Approve command",
      detail: [
        rpc.params?.reason,
        rpc.params?.command,
        rpc.params?.cwd,
        rpc.params?.permissions
          ? JSON.stringify(rpc.params.permissions, null, 2)
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      method: rpc.method!,
    };
    this.pending.set(approval.id, { approval, rpc, station });
    p.agents[station].status = "waiting";
    void this.publish(p);
    this.emit({ type: "approval", approval });
  }
  approve(id: string, decision: "accept" | "decline") {
    const pending = this.pending.get(id);
    if (!pending) throw new StudioError("Approval is no longer pending.", 404);
    if (pending.rpc.method === "item/permissions/requestApproval")
      this.runtime.respond(pending.rpc.id!, {
        permissions:
          decision === "accept" ? pending.rpc.params.permissions : {},
        scope: "turn",
      });
    else this.runtime.respond(pending.rpc.id!, { decision });
    this.pending.delete(id);
    const p = this.store.get(pending.approval.projectId);
    p.agents[pending.station].status = "working";
    void this.publish(p);
    return { ok: true };
  }
  async close() {
    for (const ctrl of this.active.values()) ctrl.abort();
    await this.runtime.close();
  }
}
