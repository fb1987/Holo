import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  FileCheck2,
  FileQuestion,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Code2,
  File,
  FolderOpen,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Terminal,
} from "lucide-react";
import type {
  Project,
  RuntimeStatus,
  ModelOption,
  BuildMode,
  Station,
  Artifact,
} from "../shared/types";
import { api } from "./api";
import { Empty, Pill } from "./ui";
export const BUILD_LABELS: Record<BuildMode, string> = {
  diy: "Build it myself",
  mixed: "Some assembly",
  finished: "Arrives finished",
};
export const STATION_LABELS: Record<Station, string> = {
  planning: "Plan",
  design: "Design",
  electronics: "Electronics",
  software: "Software",
};
export function ProjectsPanel({
  projects,
  onCreate,
  onSelect,
  busy,
}: {
  projects: Project[];
  onCreate: (template: "blank" | "wheel" | "enclosure") => void;
  onSelect: (p: Project) => void;
  busy: boolean;
}) {
  return (
    <>
      <button
        className="new-idea"
        onClick={() => onCreate("blank")}
        disabled={busy}
      >
        <span className="new-idea-icon">
          <Plus />
        </span>
        <span>
          <strong>Begin with an idea</strong>
          <small>A blank space for something that doesn’t exist yet.</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <div className="section-label">EXPLORE A STARTING POINT</div>
      <div className="sample-grid">
        <button
          className="sample-card"
          disabled={busy}
          onClick={() => onCreate("wheel")}
        >
          <span className="sample-visual wheel-symbol">◉</span>
          <span className="eyebrow">EXAMPLE · INTERACTIVE CONCEPT</span>
          <strong>A wheel, your way.</strong>
          <span>A custom controller. Four ways to understand it.</span>
        </button>
        <button
          className="sample-card"
          disabled={busy}
          onClick={() => onCreate("enclosure")}
        >
          <span className="sample-visual enclosure-symbol">
            <Box size={58} strokeWidth={0.7} />
          </span>
          <span className="eyebrow">EXAMPLE · INTERACTIVE CONCEPT</span>
          <strong>Small box. Big possibility.</strong>
          <span>A home for your next electronic invention.</span>
        </button>
      </div>
      <div className="section-label">
        YOUR STUDIO{" "}
        <span>
          {projects.length} {projects.length === 1 ? "idea" : "ideas"}
        </span>
      </div>
      {projects.length ? (
        projects.map((p) => (
          <button
            className="project-row"
            key={p.id}
            onClick={() => onSelect(p)}
          >
            <span className="project-glyph">
              <Box size={21} />
            </span>
            <span>
              <strong>{p.name}</strong>
              <small>
                {p.description || "A possibility waiting to take shape."}
              </small>
            </span>
            <span className="mono">r{p.revision}</span>
            <ChevronRight size={17} />
          </button>
        ))
      ) : (
        <p className="muted">
          Your ideas stay on this Mac. Start one whenever you’re ready.
        </p>
      )}
    </>
  );
}
export function SettingsPanel({
  runtime,
  models,
  model,
  effort,
  setModel,
  setEffort,
  onConnect,
  onLogin,
  busy,
  reduced,
  setReduced,
}: {
  runtime: RuntimeStatus | null;
  models: ModelOption[];
  model: string;
  effort: string;
  setModel: (v: string) => void;
  setEffort: (v: string) => void;
  onConnect: () => void;
  onLogin: () => void;
  busy: boolean;
  reduced: boolean;
  setReduced: (v: boolean) => void;
}) {
  const selected =
    models.find((m) => m.id === model) || models.find((m) => m.isDefault);
  const levels = selected?.supportedReasoningEfforts || [
    { reasoningEffort: "high", description: "Deep reasoning" },
  ];
  return (
    <>
      <div className="connection-card">
        <span
          className={`connection-glyph ${runtime?.authenticated ? "connected" : ""}`}
        >
          <Radio size={25} />
        </span>
        <div>
          <strong>
            {runtime?.authenticated
              ? "Codex is connected"
              : runtime?.available
                ? "Connect your intelligence"
                : "Find Codex on this Mac"}
          </strong>
          <p>
            {runtime?.authenticated
              ? `${runtime.accountType === "apiKey" ? "API access" : runtime.planType ? "ChatGPT subscription" : "Your Codex account"} · Local project workspace`
              : "Holo uses your local Codex installation. Your account powers the specialists."}
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={onConnect}
        >
          {busy ? (
            <Loader2 size={15} className="spin" />
          ) : (
            <RefreshCw size={15} />
          )}{" "}
          {runtime?.connected ? "Refresh" : "Connect"}
        </button>
      </div>
      {runtime?.error && <p className="error-note">{runtime.error}</p>}
      {runtime?.connected && !runtime.authenticated && (
        <button className="primary-button" onClick={onLogin} disabled={busy}>
          Sign in with ChatGPT <ArrowUpRight size={16} />
        </button>
      )}
      <div className="settings-grid">
        <label>
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Codex default</option>
            {models.map((m) => (
              <option value={m.id} key={m.id}>
                {m.displayName || m.id}
                {m.isDefault ? " · default" : ""}
              </option>
            ))}
          </select>
          <small>The same selected model powers each specialist.</small>
        </label>
        <label>
          Thinking depth
          <select
            value={
              levels.some((l) => l.reasoningEffort === effort)
                ? effort
                : levels[0]?.reasoningEffort
            }
            onChange={(e) => setEffort(e.target.value)}
          >
            {levels.map((l) => (
              <option key={l.reasoningEffort} value={l.reasoningEffort}>
                {l.reasoningEffort === "high"
                  ? "Deep"
                  : l.reasoningEffort === "xhigh"
                    ? "Very deep"
                    : l.reasoningEffort === "max"
                      ? "Maximum"
                      : l.reasoningEffort}{" "}
                thinking
              </option>
            ))}
          </select>
          <small>
            More thinking can take longer and use more of your allowance.
          </small>
        </label>
      </div>
      <div className="section-label">LOCAL WORKSHOP</div>
      <div className="tool-list">
        {(["blender", "kicad", "python"] as const).map((tool) => (
          <div key={tool}>
            <span
              className={
                runtime?.tools[tool] ? "status-dot online" : "status-dot"
              }
            />
            <span>
              {tool === "kicad"
                ? "KiCad"
                : tool === "python"
                  ? "Python"
                  : "Blender"}
            </span>
            <small>{runtime?.tools[tool] ? "Available" : "Not detected"}</small>
          </div>
        ))}
      </div>
      <p className="muted small">
        The interactive concept stage works immediately. Specialists can use
        installed tools to produce CAD, meshes, board files, and code. Projects
        and approvals stay visible here.
      </p>
      <label className="toggle-row">
        <span>
          <strong>Reduce motion</strong>
          <small>Calmer transitions and a stiller studio.</small>
        </span>
        <input
          type="checkbox"
          checked={reduced}
          onChange={(e) => setReduced(e.target.checked)}
        />
      </label>
    </>
  );
}
export function IntentPanel({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
}) {
  const [name, setName] = useState(project.name);
  return (
    <>
      <label className="field-label">
        Name your idea
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== project.name)
              onUpdate({ name: name.trim() });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <p className="project-description">
        {project.description ||
          "Describe what you want to make. Your planning specialist will keep the shape, electronics, and software aligned with your intent."}
      </p>
      <div className="section-label">HOW HANDS-ON DO YOU WANT TO BE?</div>
      <div className="build-mode-grid">
        {(Object.entries(BUILD_LABELS) as [BuildMode, string][]).map(
          ([key, label]) => (
            <button
              aria-pressed={project.buildMode === key}
              className={`mode-option ${project.buildMode === key ? "selected" : ""}`}
              key={key}
              onClick={() => onUpdate({ buildMode: key })}
            >
              <span>
                {project.buildMode === key ? (
                  <Check size={16} />
                ) : (
                  <span className="radio-ring" />
                )}
                {label}
              </span>
              <small>
                {key === "diy"
                  ? "Parts, files, and instructions."
                  : key === "mixed"
                    ? "Outsource the tricky steps."
                    : "Prepare for supplier assembly."}
              </small>
            </button>
          ),
        )}
      </div>
      <div className="intent-columns">
        <div>
          <div className="section-label">WHAT MATTERS</div>
          {project.goals.length ? (
            <ul className="plain-list">
              {project.goals.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Your goals will take shape through the conversation.
            </p>
          )}
        </div>
        <div>
          <div className="section-label">DESIGN BOUNDARIES</div>
          {project.constraints.length ? (
            <ul className="plain-list">
              {project.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Tell Holo about size, budget, tools, and assembly preferences.
            </p>
          )}
        </div>
      </div>
      {project.decisions.length > 0 && (
        <>
          <div className="section-label">DECISIONS THAT SHAPE THIS IDEA</div>
          {project.decisions
            .slice(-5)
            .reverse()
            .map((d) => (
              <div className="decision" key={d.id}>
                <span className="mono">r{d.revision}</span>
                <div>
                  <strong>{d.text}</strong>
                  <p>{d.reason}</p>
                </div>
              </div>
            ))}
        </>
      )}
    </>
  );
}
export function ConversationPanel({
  project,
  live,
}: {
  project: Project | null;
  live: Partial<Record<Station, string>>;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [project?.messages.length, live]);
  return (
    <>
      {!project?.messages.length && !Object.keys(live).length ? (
        <Empty title="Every idea starts with a conversation.">
          Describe what you want to make in the prompt below. The planner will
          carry your intent to the right specialists.
        </Empty>
      ) : (
        <div className="transcript">
          {project?.messages.map((m) => (
            <article key={m.id} className={`message ${m.role}`}>
              <div className="message-byline">
                <span>
                  {m.role === "user"
                    ? "YOU"
                    : m.role === "system"
                      ? "STUDIO"
                      : STATION_LABELS[m.station].toUpperCase()}
                </span>
                <time>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <div className="markdown">
                <Markdown
                  skipHtml
                  components={{
                    img: () => null,
                    a: (props) => (
                      <a {...props} target="_blank" rel="noreferrer" />
                    ),
                  }}
                >
                  {m.text}
                </Markdown>
              </div>
            </article>
          ))}
          {Object.entries(live)
            .filter(([, text]) => text)
            .map(([station, text]) => (
              <article className="message assistant streaming" key={station}>
                <div className="message-byline">
                  <span>
                    <span className="status-dot online pulse" />
                    {STATION_LABELS[station as Station].toUpperCase()}
                  </span>
                  <span>Working</span>
                </div>
                <div className="markdown">
                  <Markdown skipHtml components={{ img: () => null }}>
                    {text}
                  </Markdown>
                </div>
              </article>
            ))}
        </div>
      )}
      <div ref={end} />
    </>
  );
}
export function PartsPanel({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <p className="muted">
        Components are proposals until their exact part, footprint, and
        availability have been checked.
      </p>
      {project.parts.length ? (
        project.parts.map((p) => (
          <button
            className={`part-row ${selected === p.id ? "selected" : ""}`}
            key={p.id}
            onClick={() => onSelect(p.id)}
          >
            <span className="part-number mono">
              {String(p.quantity).padStart(2, "0")}×
            </span>
            <span className="part-details">
              <strong>{p.name}</strong>
              <small>{p.description}</small>
              {p.manufacturerPart && (
                <span className="mono small">{p.manufacturerPart}</span>
              )}
            </span>
            <Pill>{p.verified ? "Source checked" : "Proposed"}</Pill>
          </button>
        ))
      ) : (
        <Empty title="Make room for what’s inside.">
          Ask the planner to select components for your idea. Parts will appear
          here with their purpose and source information.
        </Empty>
      )}
    </>
  );
}
export function FilesPanel({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (a: Artifact) => void;
}) {
  return (
    <>
      {project.artifacts.length ? (
        project.artifacts.map((a) => (
          <button className="file-row" key={a.id} onClick={() => onSelect(a)}>
            <span className="file-icon">
              {a.kind === "code" ? (
                <Code2 size={20} />
              ) : a.kind === "mesh" || a.kind === "cad" ? (
                <Box size={20} />
              ) : (
                <File size={20} />
              )}
            </span>
            <span>
              <strong>{a.name}</strong>
              <small>{a.path}</small>
            </span>
            <Pill>{STATION_LABELS[a.domain]}</Pill>
            <span className="mono">r{a.revision}</span>
            <ChevronRight size={15} />
          </button>
        ))
      ) : (
        <Empty title="The work will live here.">
          Generated CAD, board files, software, and documents appear with their
          revision. Ask Holo to create a concrete artifact.
        </Empty>
      )}
      <p className="muted small">
        The scene can show a conceptual model before engineering files exist.
        Generated files remain available in your exported build package.
      </p>
    </>
  );
}
export function FilePanel({
  project,
  artifact,
  onPreview,
}: {
  project: Project;
  artifact: Artifact;
  onPreview: (url: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const url = api.fileUrl(project.id, artifact.path);
  const mesh = /\.(glb|gltf|stl)$/i.test(artifact.path);
  const image = /\.(png|jpg|jpeg|webp)$/i.test(artifact.path);
  const binary =
    mesh || image || /\.(blend|zip|pdf|step|stp)$/i.test(artifact.path);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    if (binary) {
      setLoading(false);
      return;
    }
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error("The artifact could not be read.");
        const t = await r.text();
        if (!disposed) setText(t);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [url, binary]);
  return (
    <>
      <div className="file-meta">
        <Pill>
          {STATION_LABELS[artifact.domain]} · Revision {artifact.revision}
        </Pill>
        <a className="secondary-button" href={url} download={artifact.name}>
          <ArrowDownToLine size={15} />
          Download
        </a>
      </div>
      {mesh ? (
        <div className="mesh-file">
          <Box size={48} strokeWidth={1} />
          <h3>A model you can explore.</h3>
          <button className="primary-button" onClick={() => onPreview(url)}>
            Bring into the spotlight <ArrowUpRight size={16} />
          </button>
        </div>
      ) : image ? (
        <img className="artifact-image" src={url} alt={artifact.name} />
      ) : loading ? (
        <p className="muted">
          <Loader2 className="spin" size={16} /> Reading artifact…
        </p>
      ) : error ? (
        <p className="error-note">{error}</p>
      ) : binary ? (
        <p className="muted">
          Download this file to open it in its native tool.
        </p>
      ) : (
        <pre className="code-preview">
          <code>{text}</code>
        </pre>
      )}
    </>
  );
}
export function HistoryPanel({ project }: { project: Project }) {
  return (
    <>
      {project.changes.length ? (
        project.changes
          .slice()
          .reverse()
          .map((c) => (
            <article className="change-row" key={c.id}>
              <div className="change-heading">
                <span
                  className={`status-dot ${c.status === "completed" ? "online" : c.status === "failed" ? "failed" : ""}`}
                />
                <strong>{c.summary}</strong>
                <Pill>{c.status}</Pill>
              </div>
              <p>{c.reason}</p>
              <div className="change-domains">
                {c.affected.map((s) => (
                  <span key={s}>{STATION_LABELS[s]}</span>
                ))}
                <span className="mono">
                  r{c.fromRevision}
                  {c.toRevision !== undefined ? ` → r${c.toRevision}` : ""}
                </span>
              </div>
              {c.error && <p className="error-note">{c.error}</p>}
            </article>
          ))
      ) : (
        <Empty title="An idea has a history.">
          Each request will show what changed, which specialists worked on it,
          and the resulting revision.
        </Empty>
      )}
    </>
  );
}
export function ExportPanel({
  project,
  onExport,
  busy,
  onUpdate,
}: {
  project: Project;
  onExport: () => void;
  busy: boolean;
  onUpdate: (patch: Partial<Project>) => void;
}) {
  return (
    <>
      <div className="export-intro">
        <span className="export-symbol">
          <FolderOpen size={42} strokeWidth={1} />
        </span>
        <div>
          <h3>Take the next step into the world.</h3>
          <p>
            One package connecting your intent, parts, and generated files at
            revision {project.revision}.
          </p>
        </div>
      </div>
      <div className="build-mode-grid">
        {(Object.entries(BUILD_LABELS) as [BuildMode, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              aria-pressed={project.buildMode === key}
              className={`mode-option ${project.buildMode === key ? "selected" : ""}`}
              onClick={() => onUpdate({ buildMode: key })}
            >
              <span>
                {project.buildMode === key ? (
                  <Check size={16} />
                ) : (
                  <span className="radio-ring" />
                )}
                {label}
              </span>
            </button>
          ),
        )}
      </div>
      <div className="package-contents">
        {[
          [
            "Project intent & decisions",
            "The reasoning behind what you’re making.",
          ],
          [
            "Bill of materials",
            `${project.parts.length} proposed components, with verification status.`,
          ],
          [
            "Generated artifacts",
            `${project.artifacts.length} files, linked to their revisions.`,
          ],
          [
            "Assembly & supplier brief",
            "A starting point for making or requesting a quote.",
          ],
          [
            "Revision manifest",
            "A record of exactly what this package contains.",
          ],
        ].map(([title, detail]) => (
          <div key={title}>
            <File size={15} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
