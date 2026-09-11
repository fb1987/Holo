import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  Code2,
  Compass,
  Cpu,
  Expand,
  FileCode2,
  FolderOpen,
  History,
  Layers3,
  Loader2,
  Maximize,
  Minus,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  PanelBottom,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type {
  ApprovalRequest,
  Artifact,
  ModelOption,
  Project,
  RuntimeStatus,
  Station,
  StudioEvent,
} from "../shared/types";
import { api } from "./api";
import { HoloMark, Tray } from "./ui";
import { SceneEvidence } from "./SceneEvidence";
import {
  BUILD_LABELS,
  ConversationPanel,
  ExportPanel,
  FilePanel,
  FilesPanel,
  HistoryPanel,
  IntentPanel,
  PartsPanel,
  ProjectsPanel,
  SettingsPanel,
  STATION_LABELS,
} from "./panels";
const StudioScene = lazy(() => import("./scene/StudioScene"));
const STATIONS: Station[] = ["planning", "design", "electronics", "software"];
const STATION_INFO = {
  planning: {
    icon: Compass,
    caption: "The intention behind the invention.",
    prompt: "Describe an idea, or change what you see…",
    detail: "Intent & decisions",
  },
  design: {
    icon: Box,
    caption: "Give your idea a place in the world.",
    prompt: "Change the shape, feel, or way it fits together…",
    detail: "Design files",
  },
  electronics: {
    icon: Cpu,
    caption: "Discover what makes it come alive.",
    prompt: "Explore the components and connections…",
    detail: "Parts & components",
  },
  software: {
    icon: Code2,
    caption: "Turn physical possibilities into behaviour.",
    prompt: "Describe what your invention should do…",
    detail: "Code & architecture",
  },
};
const EMPTY_SCENE = {
  kind: "plasma" as const,
  color: "#b9dcd6",
  width: 280,
  height: 160,
  depth: 50,
  parts: [],
};
type Panel =
  | "projects"
  | "settings"
  | "intent"
  | "conversation"
  | "parts"
  | "files"
  | "history"
  | "export"
  | "file"
  | "help"
  | null;
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-fallback">
        <div className="fallback-flame" />
        <p>
          3D preview is unavailable in this window.
          <br />
          Your project and specialists are still here.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [station, setStation] = useState<Station>("planning");
  const [panel, setPanel] = useState<Panel>(null),
    [drafts, setDrafts] = useState<Record<string, string>>(() => {
      try {
        return JSON.parse(localStorage.getItem("holo.drafts") || "{}");
      } catch {
        return {};
      }
    }),
    [runtime, setRuntime] = useState<RuntimeStatus | null>(null),
    [models, setModels] = useState<ModelOption[]>([]);
  const draft = drafts[project?.id || "new"] || "";
  const setDraft = (value: string) =>
    setDrafts((old) => ({ ...old, [project?.id || "new"]: value }));
  const [model, setModel] = useState(
      () => localStorage.getItem("holo.model") || "",
    ),
    [effort, setEffort] = useState(
      () => localStorage.getItem("holo.effort") || "high",
    );
  const [reduced, setReduced] = useState(
    () =>
      localStorage.getItem("holo.reduced") === "true" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [exploded, setExploded] = useState(false),
    [flat, setFlat] = useState(false),
    [selectedPart, setSelectedPart] = useState<string | null>(null),
    [resetKey, setResetKey] = useState(0),
    [zoomKey, setZoomKey] = useState(0);
  const [artifact, setArtifact] = useState<Artifact | null>(null),
    [artifactUrl, setArtifactUrl] = useState<string | undefined>(),
    [pending, setPending] = useState(false),
    [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [live, setLive] = useState<Partial<Record<Station, string>>>({}),
    [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [serviceReady, setServiceReady] = useState(false),
    [loading, setLoading] = useState(true);
  const projectRef = useRef(project);
  projectRef.current = project;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const busy = !!project?.changes.some(
    (c) => c.status === "running" || c.status === "queued",
  );
  const working = project
    ? STATIONS.filter(
        (s) =>
          project.agents[s]?.status === "working" ||
          project.agents[s]?.status === "waiting",
      )
    : [];
  const current = STATION_INFO[station];
  const currentAgent = project?.agents[station];
  const absorb = useCallback((p: Project) => {
    setProjects((old) =>
      [p, ...old.filter((x) => x.id !== p.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
    if (projectRef.current?.id === p.id) setProject(p);
  }, []);
  const refreshRuntime = useCallback(async () => {
    try {
      const r = await api.runtime();
      setRuntime(r);
      if (r.connected) {
        setModels(await api.models());
      }
      return r;
    } catch (e) {
      return null;
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([api.projects(), api.runtime()])
      .then(([ps, rt]) => {
        if (!active) return;
        setProjects(ps);
        setRuntime(rt);
        setServiceReady(true);
        const saved = localStorage.getItem("holo.project");
        if (saved) {
          const p = ps.find((p) => p.id === saved);
          if (p) setProject(p);
        }
        if (rt.connected)
          api
            .models()
            .then(setModels)
            .catch(() => {});
      })
      .catch((e) => {
        if (active)
          setError(`The local workshop could not start: ${e.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StudioEvent;
        if (event.type === "project") {
          absorb(event.project);
          if (
            projectRef.current?.id === event.project.id &&
            !event.project.changes.some(
              (c) => c.status === "running" || c.status === "queued",
            )
          )
            setLive({});
        } else if (
          event.type === "delta" &&
          event.projectId === projectRef.current?.id
        )
          setLive((old) => ({
            ...old,
            [event.station]: (old[event.station] || "") + event.text,
          }));
        else if (event.type === "approval") {
          setApprovals((old) => [
            ...old.filter((a) => a.id !== event.approval.id),
            event.approval,
          ]);
        } else if (
          event.type === "error" &&
          (!event.projectId || event.projectId === projectRef.current?.id)
        )
          setError(event.message);
        else if (event.type === "runtime") setRuntime(event.runtime);
      } catch {}
    };
    events.onopen = () => {
      setServiceReady(true);
      void api
        .projects()
        .then((ps) => {
          setProjects(ps);
          const id =
            projectRef.current?.id || localStorage.getItem("holo.project");
          const p = ps.find((p) => p.id === id);
          if (p) setProject(p);
          setError((old) =>
            old.startsWith("The local workshop could not start") ? "" : old,
          );
          setLoading(false);
        })
        .catch(() => {});
      void refreshRuntime();
    };
    events.onerror = () => setServiceReady(false);
    return () => events.close();
  }, [absorb]);
  useEffect(() => {
    if (project) localStorage.setItem("holo.project", project.id);
  }, [project?.id]);
  useEffect(() => {
    localStorage.setItem("holo.drafts", JSON.stringify(drafts));
  }, [drafts]);
  useEffect(() => {
    localStorage.setItem("holo.model", model);
  }, [model]);
  useEffect(() => {
    localStorage.setItem("holo.effort", effort);
  }, [effort]);
  useEffect(() => {
    localStorage.setItem("holo.reduced", String(reduced));
    document.documentElement.dataset.reduced = String(reduced);
  }, [reduced]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const edit =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
      if (edit) return;
      if (e.key === "Escape") {
        setPanel(null);
        setSelectedPart(null);
      }
      if (!panel && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        setStation(STATIONS[Number(e.key) - 1]);
      }
      if (!panel && e.key.toLowerCase() === "r") {
        setResetKey((k) => k + 1);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPanel(null);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panel]);
  useEffect(() => {
    if (flat && station !== "electronics") setFlat(false);
  }, [station, flat]);
  const selectProject = (p: Project) => {
    setProject(p);
    setStation("planning");
    setPanel(null);
    setExploded(false);
    setFlat(false);
    setSelectedPart(null);
    setArtifactUrl(undefined);
    setLive({});
    setError("");
    setResetKey((k) => k + 1);
  };
  const create = async (template: "blank" | "wheel" | "enclosure") => {
    setPending(true);
    try {
      const p = await api.create(template);
      absorb(p);
      selectProject(p);
      setNotice(
        template === "blank"
          ? "A new space for your idea."
          : "Example concept loaded. Orbit it, then make it yours.",
      );
      if (template === "blank")
        setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const rt = await api.connect();
      setRuntime(rt);
      if (rt.connected) setModels(await api.models());
      return rt;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setConnecting(false);
    }
  };
  const login = async () => {
    setConnecting(true);
    try {
      const { authUrl } = await api.login();
      if (authUrl) {
        window.open(authUrl, "_blank", "noopener,noreferrer");
        setNotice("Complete sign-in in your browser, then select Refresh.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };
  const submit = async () => {
    if (!draft.trim() || pending || busy) return;
    setPending(true);
    setError("");
    try {
      let rt = runtime;
      if (!rt?.authenticated) rt = await connect();
      if (!rt?.authenticated) {
        setPanel("settings");
        setError(
          "Connect and sign in to Codex to bring your idea to life. Your prompt is saved here.",
        );
        return;
      }
      let p = project;
      if (!p) {
        p = await api.create("blank");
        setProject(p);
        projectRef.current = p;
        absorb(p);
      }
      await api.send(p.id, draft.trim(), station, model, effort);
      setDrafts((old) => ({ ...old, [project?.id || "new"]: "", [p!.id]: "" }));
      setLive({});
      setPanel(null);
      setNotice(
        "Your planner is considering the request. Explore while the team works.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const update = async (patch: Partial<Project>) => {
    if (!project) return;
    try {
      const p = await api.update(project.id, patch);
      absorb(p);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cancel = async () => {
    if (!project) return;
    try {
      await api.cancel(project.id);
      setLive({});
      setNotice("Work stopped. Your saved project is still here.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const exportPackage = async () => {
    if (!project) return;
    setPending(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/export`);
      if (!r.ok) throw new Error("The build package could not be exported.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/[^a-z0-9]+/gi, "-")}-r${project.revision}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Build package exported, with the current revision manifest.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const approve = async (id: string, decision: "accept" | "decline") => {
    try {
      await api.approve(id, decision);
      setApprovals((old) => old.filter((a) => a.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const openContext = () =>
    setPanel(
      station === "planning"
        ? "intent"
        : station === "electronics"
          ? "parts"
          : "files",
    );
  const showFile = (a: Artifact) => {
    setArtifact(a);
    setPanel("file");
  };
  const sample = project?.source === "example";
  const isPlasma = !project || project.scene.kind === "plasma";
  const summary =
    live[working[0]]?.trim().split("\n").filter(Boolean).at(-1) ||
    currentAgent?.summary;
  const titles: Record<Exclude<Panel, null>, string> = {
    projects: "Your ideas have a home.",
    settings: "The intelligence in your studio.",
    intent: "What this idea is here to do.",
    conversation: "A conversation around the idea.",
    parts: "What’s inside.",
    files:
      station === "software"
        ? "The logic behind the object."
        : "The files taking shape.",
    history: "How the idea has evolved.",
    export: "From possibility to physical.",
    file: artifact?.name || "Artifact",
    help: "Find your way around.",
  };
  return (
    <main className={`studio station-${station} ${panel ? "has-tray" : ""}`}>
      <div className="native-drag-region" />
      <div className="stage">
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-loading">
                <HoloMark size={42} />
              </div>
            }
          >
            <StudioScene
              station={station}
              scene={project?.scene || EMPTY_SCENE}
              exploded={exploded}
              flat={flat}
              selectedPart={selectedPart}
              onSelectPart={setSelectedPart}
              resetKey={resetKey}
              zoomKey={zoomKey}
              reducedMotion={reduced}
              busy={busy}
              artifactUrl={artifactUrl}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="stage-vignette" />
      <div
        className={`idea-caption ${isPlasma ? "initial" : ""}`}
        key={project?.id || "welcome"}
      >
        <div className="eyebrow">
          <span className="caption-line" />
          {isPlasma
            ? "A SPACE FOR POSSIBILITY"
            : sample
              ? "EXAMPLE CONCEPT · MAKE IT YOURS"
              : `YOUR IDEA · REVISION ${project?.revision}`}
          <span className="caption-line" />
        </div>
        <h1>
          {isPlasma && !project
            ? "What would you like to make?"
            : project?.name}
        </h1>
        <p>
          {isPlasma
            ? "Explore the shape. Work through the details. Get it made."
            : current.caption}
        </p>
      </div>
      {!isPlasma && (
        <div className="scene-context">
          <span className="context-rule" />
          <span>
            {station === "electronics"
              ? flat
                ? "CONCEPTUAL BOARD"
                : "LOOKING WITHIN"
              : station === "software"
                ? "PHYSICAL FORM / DIGITAL BEHAVIOUR"
                : station === "design"
                  ? exploded
                    ? "ASSEMBLY EXPLORATION"
                    : "FORM & MATERIAL"
                  : "ONE IDEA. EVERY PERSPECTIVE."}
          </span>
          {project && (
            <span className="mono">
              PRODUCT ENVELOPE
              <br />
              {project.scene.width} × {project.scene.height} ×{" "}
              {project.scene.depth} mm
            </span>
          )}
        </div>
      )}
      {project && !isPlasma && (
        <SceneEvidence
          project={project}
          station={station}
          onOpen={(a) => {
            if (a) showFile(a);
            else openContext();
          }}
        />
      )}
      {selectedPart && (
        <div className="selection-label">
          <span className="status-dot online" />
          {project?.parts.find((p) => p.id === selectedPart)?.name ||
            project?.scene.parts.find((p) => p.id === selectedPart)?.name ||
            selectedPart.replace(/[-_]/g, " ")}
          <button
            aria-label="Clear selected part"
            onClick={() => setSelectedPart(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className="bottom-world">
        {(error || notice) && (
          <div
            className={`toast ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            <span>{error || notice}</span>
            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {approvals
          .filter((a) => a.projectId === project?.id)
          .map((a) => (
            <div className="approval-card" key={a.id} role="alert">
              <div>
                <span className="eyebrow">YOUR DECISION</span>
                <strong>{a.title}</strong>
                <pre>{a.detail}</pre>
              </div>
              <div className="approval-actions">
                <button
                  className="secondary-button"
                  onClick={() => approve(a.id, "decline")}
                >
                  Decline
                </button>
                <button
                  className="primary-button"
                  onClick={() => approve(a.id, "accept")}
                >
                  Allow this action <Check size={15} />
                </button>
              </div>
            </div>
          ))}
        <div className="stage-tools">
          {!project && (
            <div className="starter-actions">
              <button
                onClick={() => create("wheel")}
                disabled={pending || loading}
              >
                <span className="tiny-wheel">◉</span>Explore the wheel{" "}
                <span>↗</span>
              </button>
              <button
                onClick={() => create("enclosure")}
                disabled={pending || loading}
              >
                <Box size={15} />
                Start with an enclosure <span>↗</span>
              </button>
            </div>
          )}
          {project && (
            <>
              <div className="view-controls" aria-label="Object controls">
                <button
                  onClick={() => setZoomKey((k) => k + 1)}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => setZoomKey((k) => k - 1)}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  onClick={() => setResetKey((k) => k + 1)}
                  title="Reset view (R)"
                  aria-label="Reset view"
                >
                  <RotateCcw size={15} />
                </button>
                {!isPlasma && (
                  <>
                    <button
                      className={exploded ? "active" : ""}
                      onClick={() => setExploded((v) => !v)}
                      aria-pressed={exploded}
                    >
                      <Layers3 size={15} />
                      <span>Explode</span>
                    </button>
                    {station === "electronics" && (
                      <button
                        className={flat ? "active" : ""}
                        onClick={() => setFlat((v) => !v)}
                        aria-pressed={flat}
                      >
                        <PanelBottom size={15} />
                        <span>Board view</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => setPanel("help")}
                  aria-label="View navigation help"
                >
                  <Expand size={15} />
                </button>
              </div>
              <button className="context-button" onClick={openContext}>
                {station === "planning" ? (
                  <Compass size={15} />
                ) : station === "electronics" ? (
                  <Cpu size={15} />
                ) : (
                  <FileCode2 size={15} />
                )}{" "}
                {current.detail}
                <ChevronDown size={13} />
              </button>
            </>
          )}
        </div>
        <div className="cockpit">
          <nav
            className="stations"
            role="tablist"
            aria-label="Perspectives around your idea"
          >
            {STATIONS.map((s, i) => {
              const Icon = STATION_INFO[s].icon;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={station === s}
                  tabIndex={station === s ? 0 : -1}
                  className={`station-button ${station === s ? "selected" : ""}`}
                  onClick={() => {
                    setStation(s);
                    setPanel(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const next =
                        STATIONS[(i + (e.key === "ArrowRight" ? 1 : 3)) % 4];
                      setStation(next);
                      (
                        e.currentTarget.parentElement?.children[
                          STATIONS.indexOf(next)
                        ] as HTMLElement
                      )?.focus();
                    }
                  }}
                >
                  <span className="station-orbit-dot" />
                  <Icon size={17} strokeWidth={1.55} />
                  <span>{STATION_LABELS[s]}</span>
                  <kbd>{i + 1}</kbd>
                  {project?.agents[s]?.status === "working" && (
                    <span className="working-indicator" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="composer-shell">
            <div className="composer">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                aria-label="Describe your idea or request a change"
                placeholder={current.prompt}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <button
                className={`send-button ${busy ? "stop" : ""}`}
                disabled={
                  !busy &&
                  (!draft.trim() || pending || loading || !serviceReady)
                }
                onClick={busy ? cancel : submit}
                aria-label={busy ? "Stop current work" : "Send to planner"}
              >
                {pending ? (
                  <Loader2 size={19} className="spin" />
                ) : busy ? (
                  <Square size={16} />
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </div>
            <div className="composer-foot">
              <button
                className="intelligence-label"
                onClick={() => setPanel("settings")}
              >
                <span
                  className={`status-dot ${runtime?.authenticated ? "online" : ""}`}
                />
                {runtime?.authenticated
                  ? models.find((m) => m.id === model)?.displayName || "Codex"
                  : "Connect Codex"}
                <ChevronDown size={11} />
              </button>
              <span className="routing-note">
                {station === "planning"
                  ? "An idea begins with intent."
                  : "Your planner keeps every perspective aligned."}
              </span>
              <kbd>⌘ ↵</kbd>
            </div>
          </div>
          <div className="studio-footer">
            <button
              className="brand"
              onClick={() => setPanel("projects")}
              aria-label="Holo — open projects"
            >
              <HoloMark size={23} />
              <span>HOLO</span>
            </button>
            <span className="footer-divider" />
            <button
              className="project-switch"
              onClick={() => setPanel("projects")}
            >
              <span>{project?.name || "A new possibility"}</span>
              <ChevronDown size={12} />
            </button>
            {project && (
              <span className="revision-label">r{project.revision}</span>
            )}
            <div className="footer-spacer" />
            <button
              className={
                panel === "conversation"
                  ? "footer-button active"
                  : "footer-button"
              }
              onClick={() => setPanel("conversation")}
              aria-label="Open conversation"
              title="Conversation"
            >
              <MessageSquare size={16} />
              {project?.messages.length ? (
                <span>{project.messages.length}</span>
              ) : null}
            </button>
            {project && (
              <>
                <button
                  className="footer-button"
                  onClick={() => setPanel("history")}
                  aria-label="Open revision history"
                  title="Revision history"
                >
                  <History size={16} />
                </button>
                <button
                  className="footer-button export-button"
                  aria-label="Build package"
                  onClick={() => setPanel("export")}
                >
                  <ArrowDownToLine size={16} />
                  <span>Build package</span>
                </button>
              </>
            )}
            <button
              className="footer-button"
              onClick={() => setPanel("settings")}
              aria-label="Studio settings"
              title="Studio settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
        <div className="studio-status" aria-live="polite">
          <span>
            {busy ? (
              <>
                <span className="status-dot online pulse" />
                {working.length
                  ? `${working.map((s) => STATION_LABELS[s]).join(" + ")} working`
                  : "Request queued"}
                <span className="status-separator">·</span>Showing saved
                revision {project?.revision}
              </>
            ) : (
              <>
                <span
                  className={`status-dot ${serviceReady ? "online" : ""}`}
                />
                {loading
                  ? "Opening your studio…"
                  : serviceReady
                    ? "LOCAL STUDIO"
                    : "WORKSHOP DISCONNECTED"}
                {project && (
                  <>
                    <span className="status-separator">/</span>
                    {BUILD_LABELS[project.buildMode]}
                  </>
                )}
              </>
            )}
          </span>
          {busy ? (
            <button onClick={() => setPanel("conversation")}>
              Follow the work <ArrowUp size={11} />
            </button>
          ) : (
            <span className="navigation-hint">
              DRAG TO ORBIT <span>·</span> SCROLL TO EXPLORE
            </span>
          )}
        </div>
      </div>
      {panel && (
        <Tray
          title={titles[panel]}
          kicker={
            panel === "projects"
              ? "HOLO / YOUR STUDIO"
              : panel === "settings"
                ? "HOLO / WORKSHOP"
                : project
                  ? `${project.name} / r${project.revision}`
                  : "HOLO / THE CONVERSATION"
          }
          onClose={closePanel}
          wide={panel === "file" || panel === "conversation"}
          footer={
            panel === "export" && project ? (
              <>
                <div className="review-note">
                  <Sparkles size={17} />
                  <p>
                    <strong>Prepared for review.</strong> Supplier confirmation
                    and physical validation remain separate steps.
                  </p>
                </div>
                <button
                  className="primary-button full-width"
                  disabled={pending || busy}
                  onClick={exportPackage}
                >
                  {pending ? (
                    <Loader2 className="spin" size={17} />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}
                  Export build package
                </button>
              </>
            ) : undefined
          }
        >
          {panel === "projects" && (
            <ProjectsPanel
              projects={projects}
              onCreate={create}
              onSelect={selectProject}
              busy={pending}
            />
          )}
          {panel === "settings" && (
            <SettingsPanel
              runtime={runtime}
              models={models}
              model={model}
              effort={effort}
              setModel={setModel}
              setEffort={setEffort}
              onConnect={connect}
              onLogin={login}
              busy={connecting}
              reduced={reduced}
              setReduced={setReduced}
            />
          )}
          {panel === "intent" && project && (
            <IntentPanel key={project.id} project={project} onUpdate={update} />
          )}
          {panel === "conversation" && (
            <ConversationPanel project={project} live={live} />
          )}
          {panel === "parts" && project && (
            <PartsPanel
              project={project}
              selected={selectedPart}
              onSelect={(id) => {
                setSelectedPart(id);
                setPanel(null);
              }}
            />
          )}
          {panel === "files" && project && (
            <FilesPanel project={project} onSelect={showFile} />
          )}
          {panel === "file" && project && artifact && (
            <FilePanel
              project={project}
              artifact={artifact}
              onPreview={(url) => {
                setArtifactUrl(url);
                setPanel(null);
                setStation("design");
                setResetKey((k) => k + 1);
              }}
            />
          )}
          {panel === "history" && project && <HistoryPanel project={project} />}
          {panel === "export" && project && (
            <ExportPanel
              project={project}
              onExport={exportPackage}
              busy={pending}
              onUpdate={update}
            />
          )}
          {panel === "help" && (
            <div className="help-grid">
              {[
                ["Drag", "Orbit around the object"],
                ["Scroll / pinch", "Move closer or further away"],
                ["Right-drag / two-finger drag", "Pan across the object"],
                ["1 — 4", "Visit a specialist"],
                ["R", "Return to the intended view"],
                ["⌘ K", "Focus your idea prompt"],
                ["⌘ Enter", "Send a request to your planner"],
                ["Escape", "Close the current view"],
              ].map(([key, desc]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
              <p>
                The idea stays at the centre. Change your perspective to see a
                different part of the same invention.
              </p>
            </div>
          )}
        </Tray>
      )}
    </main>
  );
}
