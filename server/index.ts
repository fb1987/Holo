import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { z } from "zod";
import type { StudioEvent } from "../shared/types.js";
import { CodexRuntime, type AgentRuntime } from "./codex.js";
import { StudioEngine } from "./engine.js";
import {
  createProjectSchema,
  messageSchema,
  patchProjectSchema,
} from "./schema.js";
import {
  defaultDataDir,
  ProjectStore,
  StudioError,
  now,
  uid,
} from "./store.js";
import { streamExport } from "./export.js";
import { acquireDataLock } from "./lock.js";
import { mountPreferences } from "./preferences.js";

export interface ServerOptions {
  dataDir?: string;
  runtime?: AgentRuntime;
  staticDir?: string;
  allowedOrigins?: string[];
}
export async function createStudioServer(options: ServerOptions = {}) {
  const release = await acquireDataLock(options.dataDir || defaultDataDir());
  try {
    const app = express();
    app.disable("x-powered-by");
    const store = new ProjectStore(options.dataDir || defaultDataDir());
    await store.init();
    const runtime = options.runtime || new CodexRuntime(store.dataDir);
    if (runtime instanceof CodexRuntime) await runtime.configureTools();
    const clients = new Set<Response>();
    const emit = (event: StudioEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) client.write(data);
    };
    const engine = new StudioEngine(store, runtime, emit);
    const allowed = new Set(
      options.allowedOrigins || [
        "http://127.0.0.1:4317",
        "http://localhost:4317",
      ],
    );
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      const host = req.headers.host || "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
        return res
          .status(403)
          .json({ error: "Holo accepts loopback hosts only." });
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}` && !allowed.has(origin))
        return res
          .status(403)
          .json({ error: "Cross-origin access to Holo is not allowed." });
      if (req.path.startsWith("/api/"))
        res.setHeader("Cache-Control", "no-store");
      if (
        ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
        !req.is("application/json")
      )
        return res
          .status(415)
          .json({ error: "Use application/json for Holo requests." });
      next();
    });
    app.use(express.json({ limit: "128kb" }));
    await mountPreferences(app, store.dataDir);
    app.get("/api/runtime", (_req, res) => res.json(runtime.status()));
    app.post("/api/runtime/connect", async (_req, res) =>
      res.json(await runtime.connect()),
    );
    app.post("/api/runtime/login", async (_req, res) =>
      res.json(await runtime.login()),
    );
    app.get("/api/models", async (_req, res) =>
      res.json(await runtime.models()),
    );
    app.get("/api/projects", (_req, res) => res.json(store.list()));
    app.post("/api/projects", async (req, res) => {
      const project = await store.create(createProjectSchema.parse(req.body));
      emit({ type: "project", project });
      res.status(201).json(project);
    });
    app.get("/api/projects/:id", (req, res) =>
      res.json(store.get(req.params.id)),
    );
    app.patch("/api/projects/:id", async (req, res) => {
      const input = patchProjectSchema.parse(req.body),
        p = store.get(req.params.id);
      engine.assertIdle(p.id);
      Object.assign(p, input);
      p.revision++;
      p.decisions.push({
        id: uid(),
        text: "Project preferences updated.",
        reason:
          "User changed the project settings. Specialists will receive the new preferences on the next request.",
        createdAt: now(),
        revision: p.revision,
      });
      await store.save(p);
      await store.snapshot(p);
      emit({ type: "project", project: p });
      res.json(p);
    });
    app.post("/api/projects/:id/messages", async (req, res) =>
      res
        .status(202)
        .json(
          await engine.enqueue(req.params.id, messageSchema.parse(req.body)),
        ),
    );
    app.post("/api/projects/:id/cancel", async (req, res) =>
      res.json(await engine.cancel(req.params.id)),
    );
    app.get("/api/events", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Cache-Control", "no-cache");
      res.flushHeaders();
      clients.add(res);
      res.write(
        `data: ${JSON.stringify({ type: "runtime", runtime: runtime.status() })}\n\n`,
      );
      for (const approval of engine.approvals())
        res.write(
          `data: ${JSON.stringify({ type: "approval", approval })}\n\n`,
        );
      const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
      req.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(res);
      });
    });
    app.post("/api/approvals/:id", async (req, res) => {
      const { decision } = z
        .object({ decision: z.enum(["accept", "decline"]) })
        .strict()
        .parse(req.body);
      res.json(engine.approve(req.params.id, decision));
    });
    app.get("/api/projects/:id/artifacts", async (req, res) => {
      const p = store.get(req.params.id);
      res.json(p.artifacts);
    });
    app.get("/api/projects/:id/files", async (req, res) => {
      const relative = z.string().min(1).max(1024).parse(req.query.path);
      const file = await store.readArtifact(req.params.id, relative);
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      if (/\.(html?|svg|js|mjs)$/i.test(file))
        res.setHeader("Content-Disposition", "attachment");
      res.sendFile(file);
    });
    app.get("/api/projects/:id/export", async (req, res) => {
      const p = store.get(req.params.id);
      engine.assertIdle(p.id);
      await streamExport(store, p, res);
    });
    app.use("/api", (_req, res) =>
      res.status(404).json({ error: "Unknown Holo endpoint." }),
    );
    const staticDir =
      options.staticDir ||
      process.env.HOLO_STATIC_DIR ||
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
    if (existsSync(staticDir)) {
      app.use(express.static(staticDir, { dotfiles: "deny" }));
      app.get("/{*path}", (_req, res) =>
        res.sendFile(path.join(staticDir, "index.html")),
      );
    }
    app.use(
      (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) {
          res.end();
          return;
        }
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: "Invalid request.",
            details: error.issues.map(
              (i) => `${i.path.join(".")}: ${i.message}`,
            ),
          });
          return;
        }
        const status =
          error instanceof StudioError
            ? error.status
            : (error as any)?.status === 400
              ? 400
              : 500;
        res.status(status).json({
          error:
            error instanceof Error
              ? error.message
              : "Holo could not complete this request.",
        });
      },
    );
    let server: Server | undefined;
    return {
      app,
      store,
      engine,
      runtime,
      async listen(port = 4318) {
        if (server) return server;
        server = createServer(app);
        await new Promise<void>((resolve, reject) => {
          server!.once("error", reject);
          server!.listen(port, "127.0.0.1", () => {
            server!.off("error", reject);
            resolve();
          });
        });
        return server;
      },
      async close() {
        try {
          for (const client of clients) client.end();
          clients.clear();
          await engine.close();
          if (server)
            await new Promise<void>((resolve) => {
              server!.close(() => resolve());
              server!.closeAllConnections();
            });
        } finally {
          await release();
        }
      },
    };
  } catch (error) {
    await release();
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const studio = await createStudioServer();
  const port =
    process.env.HOLO_PORT === undefined ? 4318 : Number(process.env.HOLO_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("HOLO_PORT must be an integer from 0 to 65535.");
  const server = await studio.listen(port);
  console.log(`HOLO_READY ${(server.address() as { port: number }).port}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => void studio.close().then(() => process.exit(0)));
}
