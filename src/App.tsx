import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
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
  StudioPreferences,
} from "../shared/types";
import { api } from "./api";
import {
  getPrimaryAssembly,
  getCurrentArtifacts,
  getDomainRevisions,
} from "../shared/artifacts";
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
  | "controls"
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
  const [compact, setCompact] = useState(
    () => localStorage.getItem("holo.compact") !== "false",
  );
  const [dockHeight, setDockHeight] = useState(64);
  const dockRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false),
    [flat, setFlat] = useState(false),
    [selectedPart, setSelectedPart] = useState<string | null>(null),
    [resetKey, setResetKey] = useState(0),
    [zoomKey, setZoomKey] = useState(0);
  const [artifact, setArtifact] = useState<Artifact | null>(null),
    [modelSelection, setModelSelection] = useState<{
      id: string;
      projectId: string;
      primaryId?: string;
      designRevision?: number;
    } | null>(null),
    [pending, setPending] = useState(false),
    [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [live, setLive] = useState<Partial<Record<Station, string>>>({}),
    [activity, setActivity] = useState<Partial<Record<Station, string>>>({}),
    [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [serviceReady, setServiceReady] = useState(false),
    [loading, setLoading] = useState(true),
    [preferencesReady, setPreferencesReady] = useState(false);
  const preferencesRef = useRef<StudioPreferences>({});
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
    Promise.all([api.projects(), api.runtime(), api.preferences()])
      .then(([ps, rt, prefs]) => {
        if (!active) return;
        setProjects(ps);
        setRuntime(rt);
        setServiceReady(true);
        const saved =
          prefs.lastProjectId || localStorage.getItem("holo.project");
        if (prefs.drafts) setDrafts(prefs.drafts);
        if (prefs.model !== undefined) setModel(prefs.model);
        if (prefs.effort !== undefined) setEffort(prefs.effort);
        if (prefs.reducedMotion !== undefined) setReduced(prefs.reducedMotion);
        if (prefs.compactMode !== undefined) setCompact(prefs.compactMode);
        setPreferencesReady(true);
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
          ) {
            setLive({});
            setActivity({});
          }
        } else if (
          event.type === "delta" &&
          event.projectId === projectRef.current?.id
        )
          setLive((old) => ({
            ...old,
            [event.station]: (old[event.station] || "") + event.text,
          }));
        else if (
          event.type === "status" &&
          event.projectId === projectRef.current?.id
        ) {
          setActivity((old) => ({ ...old, [event.station]: event.status }));
        } else if (event.type === "approval") {
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
  preferencesRef.current = {
    lastProjectId: project?.id || null,
    drafts,
    model,
    effort,
    reducedMotion: reduced,
    compactMode: compact,
  };
  useEffect(() => {
    if (!preferencesReady) return;
    const timer = setTimeout(() => {
      void api
        .savePreferences(preferencesRef.current)
        .catch((e) =>
          setError(`Studio preferences could not be saved: ${e.message}`),
        );
    }, 150);
    return () => clearTimeout(timer);
  }, [preferencesReady, project?.id, drafts, model, effort, reduced, compact]);
  useEffect(() => {
    if (!preferencesReady) return;
    const persist = () =>
      navigator.sendBeacon(
        "/api/preferences",
        new Blob([JSON.stringify(preferencesRef.current)], {
          type: "application/json",
        }),
      );
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [preferencesReady]);
  useEffect(() => {
    localStorage.setItem("holo.compact", String(compact));
  }, [compact]);
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setDockHeight(el.getBoundingClientRect().height),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const settings = () => setPanel("settings");
    window.addEventListener("holo:settings", settings);
    return () => window.removeEventListener("holo:settings", settings);
  }, []);
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
    setModelSelection(null);
    setLive({});
    setActivity({});
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
      setActivity({});
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
  const primaryAssembly = project ? getPrimaryAssembly(project) : undefined;
  const selectedModel =
    project &&
    modelSelection?.projectId === project.id &&
    modelSelection.primaryId === primaryAssembly?.id &&
    modelSelection.designRevision === getDomainRevisions(project).design
      ? project.artifacts.find((a) => a.id === modelSelection.id)
      : undefined;
  const visibleModel = selectedModel || primaryAssembly;
  const effectiveArtifactUrl =
    project && visibleModel
      ? api.fileUrl(project.id, visibleModel.path)
      : undefined;
  const currentModels = project
    ? getCurrentArtifacts(project).filter((a) => /\.(glb|stl)$/i.test(a.path))
    : [];
  const selectModel = (id: string) => {
    if (!project) return;
    setModelSelection({
      id,
      projectId: project.id,
      primaryId: primaryAssembly?.id,
      designRevision: getDomainRevisions(project).design,
    });
    setSelectedPart(null);
    setPanel(null);
    setResetKey((k) => k + 1);
  };
  const CurrentIcon = current.icon;
  const isPlasma =
    (!project || project.scene.kind === "plasma") && !effectiveArtifactUrl;
  const workingStation = working[0];
  const workStatus = workingStation
    ? project?.agents[workingStation]?.status === "waiting"
      ? "Waiting for your decision on the action above."
      : activity[workingStation] || project?.agents[workingStation]?.summary
    : "Your request is queued.";
  const titles: Record<Exclude<Panel, null>, string> = {
    controls: "Studio controls",
    projects: "Your projects",
    settings: "Settings",
    intent: "Project intent",
    conversation: "Activity",
    parts: "What’s inside.",
    files: "Project files",
    history: "Revision history",
    export: "Build package",
    file: artifact?.name || "Artifact",
    help: "Navigation",
  };
  const perspectives = (close: boolean) => (
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
              if (close) setPanel(null);
            }}
            onKeyDown={(e) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const nextIndex =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                setStation(STATIONS[nextIndex]);
                (
                  e.currentTarget.parentElement?.children[
                    nextIndex
                  ] as HTMLElement
                )?.focus();
              }
            }}
          >
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
  );
  const viewAction = (action: () => void) => {
    action();
    if (panel === "controls") setPanel(null);
  };
  const viewControls = (
    <div className="view-controls" role="group" aria-label="Object controls">
      <button
        onClick={() => viewAction(() => setZoomKey((k) => k + 1))}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <ZoomIn size={17} />
      </button>
      <button
        onClick={() => viewAction(() => setZoomKey((k) => k - 1))}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <ZoomOut size={17} />
      </button>
      <button
        onClick={() => viewAction(() => setResetKey((k) => k + 1))}
        aria-label="Reset view"
        title="Reset view (R)"
      >
        <RotateCcw size={17} />
      </button>
      {primaryAssembly && visibleModel?.id !== primaryAssembly.id && (
        <button onClick={() => selectModel(primaryAssembly.id)}>
          <Box size={15} />
          Assembly
        </button>
      )}
      {!isPlasma && !effectiveArtifactUrl && (
        <>
          <button
            className={exploded ? "active" : ""}
            aria-pressed={exploded}
            onClick={() => viewAction(() => setExploded((v) => !v))}
          >
            <Layers3 size={15} />
            Explode
          </button>
          {station === "electronics" && !project?.scene.parts.length && (
            <button
              className={flat ? "active" : ""}
              aria-pressed={flat}
              onClick={() => viewAction(() => setFlat((v) => !v))}
            >
              <PanelBottom size={15} />
              Board view
            </button>
          )}
        </>
      )}
    </div>
  );
  return (
    <main
      className={`studio station-${station} ${compact ? "minimal-studio" : "expanded-studio"} ${panel ? "has-tray" : ""}`}
      style={{ "--dock-height": `${dockHeight}px` } as CSSProperties}
    >
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
              exploded={!effectiveArtifactUrl && exploded}
              flat={!effectiveArtifactUrl && flat}
              selectedPart={selectedPart}
              onSelectPart={setSelectedPart}
              resetKey={resetKey}
              zoomKey={zoomKey}
              reducedMotion={reduced}
              busy={busy}
              artifactUrl={effectiveArtifactUrl}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="stage-vignette" />
      {project && !isPlasma && (station !== "planning" || !compact) && (
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
        {busy && workStatus && (
          <button
            className="work-activity"
            onClick={() => setPanel("conversation")}
            aria-label="Follow the work"
            title={workStatus}
          >
            <Loader2 size={13} className="spin" />
            <span>
              <strong>
                {workingStation ? STATION_LABELS[workingStation] : "Planner"}
              </strong>{" "}
              {workStatus}
            </span>
            <MessageSquare size={13} />
          </button>
        )}
        <div
          className={`cockpit ${compact ? "compact" : "expanded"}`}
          ref={dockRef}
        >
          {!compact && (
            <div className="expanded-controls">
              {perspectives(false)}
              <div className="expanded-actions">
                {viewControls}
                <button
                  className="context-button"
                  onClick={() => setPanel("conversation")}
                >
                  <MessageSquare size={15} />
                  Activity
                </button>
                {project && (
                  <button className="context-button" onClick={openContext}>
                    <FileCode2 size={15} />
                    {current.detail}
                  </button>
                )}
                <button
                  className="context-button"
                  onClick={() => setCompact(true)}
                  aria-label="Use minimal cockpit"
                >
                  <Minus size={15} />
                  Minimize
                </button>
              </div>
            </div>
          )}
          <div className="dock-row">
            <button
              className="dock-project"
              onClick={() => setPanel("projects")}
              aria-label={`Holo — open projects. ${project?.name || "New idea"}`}
              aria-haspopup="dialog"
              aria-expanded={panel === "projects"}
              aria-controls="studio-panel"
              title={project?.name || "New idea"}
            >
              <HoloMark size={24} />
              <span>{project?.name || "New idea"}</span>
              <ChevronDown size={12} />
            </button>
            <div className="composer">
              <textarea
                ref={inputRef}
                maxLength={16000}
                disabled={loading}
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
                title={
                  !serviceReady
                    ? "Local workshop disconnected"
                    : busy
                      ? "Stop current work"
                      : "Send to planner (⌘ Enter)"
                }
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
            <button
              className="dock-controls"
              onClick={() => setPanel("controls")}
              aria-label={`Studio controls — ${STATION_LABELS[station]} perspective`}
              aria-haspopup="dialog"
              aria-expanded={panel === "controls"}
              aria-controls="studio-panel"
              title="Perspectives & controls"
            >
              <CurrentIcon size={19} strokeWidth={1.6} />
              <span>{STATION_LABELS[station]}</span>
              <ChevronDown size={12} />
              {(!serviceReady || !runtime?.authenticated) && (
                <span className="connection-indicator" />
              )}
            </button>
          </div>
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
          {panel === "controls" && (
            <div className="controls-panel">
              {perspectives(true)}
              {project && (
                <>
                  <div className="control-section">
                    <div className="section-label">MODEL</div>
                    {currentModels.length > 0 && (
                      <label className="model-picker">
                        <span className="sr-only">Displayed model</span>
                        <select
                          aria-label="Displayed model"
                          value={visibleModel?.id || ""}
                          onChange={(e) => selectModel(e.target.value)}
                        >
                          {visibleModel &&
                            !currentModels.some(
                              (a) => a.id === visibleModel.id,
                            ) && (
                              <option value={visibleModel.id}>
                                {visibleModel.name} · History
                              </option>
                            )}
                          {currentModels.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id === primaryAssembly?.id
                                ? "Assembly · "
                                : a.role === "part"
                                  ? "Part · "
                                  : "Model · "}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {viewControls}
                    {visibleModel && (
                      <button
                        className="model-file-link"
                        onClick={() => showFile(visibleModel)}
                      >
                        <Box size={14} />
                        {visibleModel.name}
                        <span>r{visibleModel.revision}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className="control-section control-links">
                <button onClick={() => setPanel("conversation")}>
                  <MessageSquare size={17} />
                  <span>Activity</span>
                </button>
                {project && (
                  <>
                    <button onClick={openContext}>
                      <CurrentIcon size={17} />
                      <span>{current.detail}</span>
                    </button>
                    <button onClick={() => setPanel("files")}>
                      <FolderOpen size={17} />
                      <span>All files</span>
                    </button>
                    <button onClick={() => setPanel("history")}>
                      <History size={17} />
                      <span>Revision history</span>
                    </button>
                    <button onClick={() => setPanel("export")}>
                      <ArrowDownToLine size={17} />
                      <span>Build package</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPanel("settings")}
                  aria-label="Studio settings"
                >
                  <Settings2 size={17} />
                  <span>Settings</span>
                </button>
                <button onClick={() => setPanel("help")}>
                  <Expand size={17} />
                  <span>Navigation</span>
                </button>
              </div>
              <div className="control-preferences">
                <button
                  className="compact-toggle"
                  role="switch"
                  aria-checked={compact}
                  onClick={() => setCompact((v) => !v)}
                >
                  <span>Minimal cockpit</span>
                  <span className={`toggle-track ${compact ? "on" : ""}`}>
                    <span />
                  </span>
                </button>
                <button
                  className="intelligence-label"
                  onClick={() => setPanel("settings")}
                >
                  <span
                    className={`status-dot ${serviceReady && runtime?.authenticated ? "online" : ""}`}
                  />
                  {!serviceReady
                    ? "Workshop disconnected"
                    : runtime?.authenticated
                      ? models.find((m) => m.id === model)?.displayName ||
                        "Codex connected"
                      : "Connect Codex"}
                  <ChevronDown size={11} />
                </button>
              </div>
            </div>
          )}
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
            <FilesPanel
              key={project.id}
              project={project}
              onSelect={showFile}
            />
          )}
          {panel === "file" && project && artifact && (
            <FilePanel
              project={project}
              artifact={artifact}
              onPreview={() => {
                selectModel(artifact.id);
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
