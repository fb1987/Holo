import {
  spawn,
  execFile,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { existsSync, constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { ModelOption, RuntimeStatus } from "../shared/types.js";
import { atomicWrite } from "./store.js";

export interface RpcMessage {
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string };
}
export class StructuredOutputStallError extends Error {}
export interface AgentRunOptions {
  /** Read-only ephemeral concept passes cannot ask for broader execution. */
  readOnly?: boolean;
  ephemeral?: boolean;
  threadId?: string;
  cwd: string;
  model?: string;
  effort?: string;
  instructions: string;
  prompt: string;
  outputSchema: unknown;
  signal?: AbortSignal;
  onThread: (id: string) => Promise<void> | void;
  onEvent: (method: string, params: any) => void;
}
export interface AgentRuntime {
  status(): RuntimeStatus;
  connect(refreshTools?: boolean): Promise<RuntimeStatus>;
  models(): Promise<ModelOption[]>;
  login(): Promise<{ authUrl?: string }>;
  run(options: AgentRunOptions): Promise<string>;
  close(): Promise<void>;
  on(event: "request" | "runtime", listener: (...args: any[]) => void): this;
  respond(id: string | number, result: unknown): void;
  reject(id: string | number, message: string): void;
  toolInstructions?(): string;
}

export function discoverBinary(
  name: string,
  candidates: string[] = [],
): string | undefined {
  const explicit = name === "codex" ? process.env.HOLO_CODEX_BIN : undefined;
  for (const candidate of [
    explicit,
    ...candidates,
    ...(process.env.PATH || "")
      .split(path.delimiter)
      .map((p) => path.join(p, name)),
  ]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return undefined;
}
export class CodexRuntime extends EventEmitter implements AgentRuntime {
  private proc?: ChildProcessWithoutNullStreams;
  private seq = 0;
  private pending = new Map<
    string | number,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private connecting?: Promise<RuntimeStatus>;
  private current: RuntimeStatus;
  private availableModels: ModelOption[] = [];
  private binary?: string;
  private blenderPython?: string;
  private checkingTools?: Promise<void>;
  private toolsChecked = false;
  constructor(
    private cwd: string,
    private command?: { binary: string; args: string[] },
  ) {
    super();
    this.binary =
      command?.binary ||
      discoverBinary("codex", [
        "/Applications/Codex.app/Contents/Resources/codex",
        "/Applications/ChatGPT.app/Contents/Resources/codex",
      ]);
    this.current = {
      available: !!this.binary,
      connected: false,
      authenticated: false,
      tools: {
        blender: !!discoverBinary("blender", [
          "/Applications/Blender.app/Contents/MacOS/Blender",
        ]),
        kicad: !!discoverBinary("kicad-cli", [
          "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli",
        ]),
        python: !!discoverBinary("python3"),
      },
    };
    if (!this.binary)
      this.current.error =
        "Install Codex or set HOLO_CODEX_BIN to its executable.";
  }
  status() {
    return { ...this.current, tools: { ...this.current.tools } };
  }
  async configureTools() {
    if (this.checkingTools) return this.checkingTools;
    this.checkingTools = this.probeTools();
    try {
      await this.checkingTools;
    } finally {
      this.checkingTools = undefined;
      this.toolsChecked = true;
    }
  }
  private async probeTools() {
    const diagnostic = {
      version: 1,
      checkedAt: new Date().toISOString(),
      host: {
        pid: process.pid,
        node: process.versions.node,
        electron: process.versions.electron || null,
        executable: process.execPath,
        cwd: this.cwd,
      },
      blender: {
        source: process.env.HOLO_BLENDER_PYTHON ? "environment" : "tools.json",
        executable: undefined as string | undefined,
        status: "unconfigured",
        error: undefined as string | undefined,
        attempts: [] as Array<Record<string, unknown>>,
      },
    };
    const record = async () => {
      try {
        await atomicWrite(
          path.join(this.cwd, "tool-diagnostics.json"),
          JSON.stringify(diagnostic, null, 2),
        );
      } catch {
        /* Diagnostics must not prevent the workshop from opening. */
      }
    };
    let configured = process.env.HOLO_BLENDER_PYTHON;
    if (!configured) {
      try {
        const settings = JSON.parse(
          await readFile(path.join(this.cwd, "tools.json"), "utf8"),
        );
        if (typeof settings.blenderPython === "string")
          configured = settings.blenderPython;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          diagnostic.blender.error =
            error instanceof Error ? error.message : String(error);
      }
    }
    diagnostic.blender.executable = configured;
    if (!configured || !path.isAbsolute(configured)) {
      if (configured) {
        diagnostic.blender.status = "invalid-path";
        diagnostic.blender.error = "The Blender Python path must be absolute.";
      }
      await record();
      return;
    }
    try {
      await access(configured, constants.X_OK);
    } catch (error) {
      diagnostic.blender.status = "not-executable";
      diagnostic.blender.error =
        error instanceof Error ? error.message : String(error);
      await record();
      return;
    }
    // Retry a transient native-library import failure once, within the same
    // overall startup time budget. Missing/non-executable paths never retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      try {
        const result = await promisify(execFile)(
          configured,
          ["-c", "import bpy; print(bpy.app.version_string)"],
          { cwd: this.cwd, timeout: 7500, maxBuffer: 32768 },
        );
        this.blenderPython = configured;
        this.current.tools.blender = true;
        diagnostic.blender.status = "available";
        diagnostic.blender.attempts.push({
          attempt: attempt + 1,
          durationMs: Date.now() - started,
          success: true,
          stdout: result.stdout.slice(0, 4000),
          stderr: result.stderr.slice(0, 4000),
        });
        await record();
        return;
      } catch (error) {
        const failure = error as Error & {
          code?: string | number;
          signal?: string;
          killed?: boolean;
          stdout?: string;
          stderr?: string;
        };
        diagnostic.blender.status = "import-failed";
        diagnostic.blender.attempts.push({
          attempt: attempt + 1,
          durationMs: Date.now() - started,
          success: false,
          code: failure.code,
          signal: failure.signal,
          killed: failure.killed,
          message: failure.message?.slice(0, 4000),
          stdout: failure.stdout?.slice(0, 4000),
          stderr: failure.stderr?.slice(0, 4000),
        });
      }
    }
    await record();
  }
  toolInstructions() {
    if (this.blenderPython)
      return `A Python environment passed a host-side Blender bpy import probe at ${JSON.stringify(this.blenderPython)}. The host probe does not verify execution inside your restricted workspace. If import crashes, report the unavailable capability once and preserve the existing model; do not repeatedly debug native imports or claim missing exports are complete. Use this exact Python executable to run a project-local script that imports bpy for headless modelling/rendering. Before launching Blender, create a .holo-tmp directory within your own workstation directory and set TMPDIR, TMP and TEMP to that absolute local path for the Python process. Blender requires a writable temporary session directory; the system temp directory is outside your workspace sandbox. This local temporary directory avoids unnecessary requests for broader access. Write .blend, .glb, .stl and rendered output only under your artifacts/ directory. Export GLB with metres as required by glTF, and document dimensions and conversion from the millimetre scene specification. Keep an editable Blender Python script alongside deliverables. No GUI Blender installation is required for this environment.\n`;
    const blender = discoverBinary("blender", [
      "/Applications/Blender.app/Contents/MacOS/Blender",
    ]);
    return blender
      ? `Blender is available at ${JSON.stringify(blender)}. Use --background --python with project-local scripts to produce editable .blend files and preview .glb/.stl deliverables under artifacts/.\n`
      : "";
  }
  async connect(refreshTools = false): Promise<RuntimeStatus> {
    if (this.connecting) return this.connecting;
    // A failed optional native probe must not add two timeouts to every turn.
    // Only startup and an explicit user reconnect refresh its capability.
    if (refreshTools || !this.toolsChecked) await this.configureTools();
    if (this.connecting) return this.connecting;
    if (this.current.connected) {
      await this.readAccount();
      return this.status();
    }
    this.connecting = this.start();
    try {
      return await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }
  private async start() {
    if (!this.binary) throw new Error(this.current.error);
    await access(this.binary, constants.X_OK);
    const environment = { ...process.env };
    delete environment.CODEX_THREAD_ID;
    const proc = spawn(
      this.binary,
      this.command?.args || ["app-server", "--listen", "stdio://"],
      { cwd: this.cwd, env: environment, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.proc = proc;
    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      try {
        this.receive(JSON.parse(line));
      } catch {
        /* Ignore non-protocol startup diagnostics. */
      }
    });
    // Drain stderr, but do not forward logs that can contain paths/auth context.
    proc.stderr.on("data", () => {});
    const disconnected = (error: Error) => {
      if (this.proc !== proc) return;
      this.proc = undefined;
      this.current.connected = false;
      this.current.error = error.message;
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(error);
      }
      this.pending.clear();
      this.emit("disconnect", error);
      this.emit("runtime", this.status());
    };
    proc.on("error", disconnected);
    proc.on("exit", (code, signal) =>
      disconnected(
        new Error(
          `Codex stopped (${signal || code || "closed"}). Reconnect to continue.`,
        ),
      ),
    );
    try {
      await this.request(
        "initialize",
        {
          clientInfo: { name: "holo_studio", title: "Holo", version: "0.1.0" },
          capabilities: { experimentalApi: true },
        },
        20000,
      );
      this.send({ method: "initialized", params: {} });
      this.current.connected = true;
      delete this.current.error;
      await this.readAccount();
      await this.models();
      this.emit("runtime", this.status());
      return this.status();
    } catch (error) {
      proc.kill();
      throw error;
    }
  }
  private receive(message: RpcMessage) {
    if (message.id !== undefined && !message.method) {
      const p = this.pending.get(message.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(message.id);
      if (message.error) p.reject(new Error(message.error.message));
      else p.resolve(message.result);
    } else if (message.method && message.id !== undefined) {
      this.emit("request", message);
    } else if (message.method) {
      this.emit("notification", message.method, message.params || {});
      if (
        message.method === "account/updated" ||
        message.method === "account/login/completed"
      )
        void this.readAccount()
          .then(() => this.emit("runtime", this.status()))
          .catch(() => {});
    }
  }
  private send(message: RpcMessage) {
    if (!this.proc || this.proc.stdin.destroyed)
      throw new Error("Codex is disconnected.");
    this.proc.stdin.write(JSON.stringify(message) + "\n");
  }
  request(method: string, params: unknown = {}, timeout = 30000): Promise<any> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex did not respond to ${method}.`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }
  respond(id: string | number, result: unknown) {
    this.send({ id, result });
  }
  reject(id: string | number, message: string) {
    this.send({ id, error: { code: -32601, message } });
  }
  private async readAccount() {
    const r = await this.request("account/read", { refreshToken: false });
    this.current.authenticated = !!r.account || r.requiresOpenaiAuth === false;
    this.current.accountType = r.account?.type;
    this.current.planType = r.account?.planType;
  }
  async models() {
    if (!this.current.connected) return this.availableModels;
    const r = await this.request("model/list", { limit: 100 });
    this.availableModels = (r.data || []).map((m: any) => ({
      id: m.model || m.id,
      displayName: m.displayName || m.model || m.id,
      description: m.description,
      isDefault: m.isDefault,
      supportedReasoningEfforts: m.supportedReasoningEfforts,
      defaultReasoningEffort: m.defaultReasoningEffort,
    }));
    this.current.model = this.availableModels.find((m) => m.isDefault)?.id;
    return this.availableModels;
  }
  async login() {
    await this.connect();
    const result = await this.request("account/login/start", {
      type: "chatgpt",
    });
    return { authUrl: result.authUrl };
  }
  async run(options: AgentRunOptions): Promise<string> {
    await this.connect();
    if (!this.current.authenticated)
      throw new Error("Sign in to Codex before starting an agent.");
    if (options.signal?.aborted) throw new Error("Change cancelled.");
    let threadId = options.threadId;
    const threadParams = {
      cwd: options.cwd,
      model: options.model,
      approvalPolicy: options.readOnly ? "never" : "on-request",
      approvalsReviewer: "user",
      sandbox: options.readOnly ? "read-only" : "workspace-write",
      ephemeral: options.ephemeral,
      developerInstructions: options.instructions,
    };
    if (threadId)
      await this.request("thread/resume", { ...threadParams, threadId });
    else {
      const result = await this.request("thread/start", threadParams);
      threadId = result.thread.id;
      await options.onThread(threadId!);
    }
    // Cancellation can arrive while the runtime is creating/resuming a thread.
    // Never start a fresh turn after a disposable pass has been superseded.
    if (options.signal?.aborted) {
      if (options.ephemeral)
        void this.request("thread/unsubscribe", { threadId }).catch(() => {});
      throw new Error("Change cancelled.");
    }
    let turnId: string | undefined;
    let finalText = "",
      lastText = "";
    const messages = new Map<string, string>();
    const phases = new Map<string, string>();
    return new Promise<string>((resolve, reject) => {
      let finished = false;
      let formattingFailure: StructuredOutputStallError | undefined;
      const earlyEvents: Array<[string, any]> = [];
      let lastActivity = Date.now(),
        idleReported = false;
      const idleCheck = setInterval(() => {
        if (Date.now() - lastActivity > 120000 && !idleReported) {
          idleReported = true;
          options.onEvent("holo/idle", {
            seconds: Math.floor((Date.now() - lastActivity) / 1000),
          });
        }
      }, 30000);
      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(idleCheck);
        this.off("notification", notification);
        this.off("disconnect", disconnect);
        options.signal?.removeEventListener("abort", abort);
      };
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (options.ephemeral)
          void this.request("thread/unsubscribe", { threadId }).catch(() => {});
        if (error) reject(error);
        else resolve(finalText || lastText);
      };
      const disconnect = (error: Error) => finish(error);
      const abort = () => {
        if (turnId)
          void this.request("turn/interrupt", { threadId, turnId }).catch(
            () => {},
          );
        finish(new Error("Change cancelled."));
      };
      const timer = setTimeout(
        () => {
          if (turnId)
            void this.request("turn/interrupt", { threadId, turnId }).catch(
              () => {},
            );
          finish(
            new Error(
              "Agent reached the 30 minute turn limit. Send a new request to continue.",
            ),
          );
        },
        30 * 60 * 1000,
      );
      const notification = (method: string, params: any) => {
        if (finished) return;
        if (params.threadId !== threadId) return;
        if (!turnId) {
          earlyEvents.push([method, params]);
          return;
        }
        const eventTurnId =
          params.turnId ||
          (method.startsWith("turn/") ? params.turn?.id : undefined);
        if (eventTurnId && eventTurnId !== turnId) return;
        lastActivity = Date.now();
        idleReported = false;
        if (
          method === "item/started" &&
          params.item?.type === "agentMessage" &&
          params.item.phase
        )
          phases.set(params.item.id, params.item.phase);
        options.onEvent(
          method,
          method === "item/agentMessage/delta"
            ? { ...params, phase: phases.get(params.itemId) }
            : params,
        );
        if (method === "item/agentMessage/delta") {
          const text = (messages.get(params.itemId) || "") + params.delta;
          messages.set(params.itemId, text);
          if (
            text.length > 200000 ||
            (text.trimStart().startsWith("{") &&
              (text.match(/\s+$/)?.[0].length || 0) > 2048)
          ) {
            if (!formattingFailure) {
              formattingFailure = new StructuredOutputStallError(
                "Codex stalled while formatting the structured result. The incomplete result was not applied.",
              );
              void this.request("turn/interrupt", { threadId, turnId })
                .then(() => finish(formattingFailure))
                .catch(() => finish(formattingFailure));
            }
            return;
          }
        }
        if (
          method === "item/completed" &&
          params.item?.type === "agentMessage"
        ) {
          lastText = params.item.text || messages.get(params.item.id) || "";
          if (
            params.item.phase === "final_answer" ||
            lastText.trim().startsWith("{")
          )
            finalText = lastText;
        }
        if (method === "turn/completed") {
          if (params.turn?.status === "failed")
            finish(
              new Error(
                errorMessage(
                  params.turn.error?.message ||
                    "Codex could not complete this turn.",
                ),
              ),
            );
          else if (params.turn?.status === "interrupted")
            finish(formattingFailure || new Error("Change cancelled."));
          else {
            for (const item of params.turn?.items || [])
              if (item.type === "agentMessage")
                finalText = item.text || finalText;
            finish();
          }
        }
      };
      this.on("notification", notification);
      this.on("disconnect", disconnect);
      options.signal?.addEventListener("abort", abort, { once: true });
      void this.request(
        "turn/start",
        {
          threadId,
          input: [{ type: "text", text: options.prompt }],
          model: options.model,
          effort: options.effort || "high",
          cwd: options.cwd,
          approvalPolicy: options.readOnly ? "never" : "on-request",
          approvalsReviewer: "user",
          sandboxPolicy: options.readOnly
            ? { type: "readOnly" }
            : {
                type: "workspaceWrite",
                writableRoots: [options.cwd],
                networkAccess: false,
                excludeTmpdirEnvVar: true,
                excludeSlashTmp: true,
              },
          outputSchema: options.outputSchema,
        },
        60000,
      )
        .then((r) => {
          turnId = r.turn.id;
          for (const [method, params] of earlyEvents)
            notification(method, params);
          if (options.signal?.aborted)
            void this.request("turn/interrupt", { threadId, turnId }).catch(
              () => {},
            );
        })
        .catch(finish);
    });
  }
  async close() {
    const proc = this.proc;
    if (!proc) return;
    proc.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        resolve();
      }, 2000);
      proc.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

function errorMessage(message: string) {
  try {
    const parsed = JSON.parse(message);
    return parsed.error?.message || message;
  } catch {
    return message;
  }
}
