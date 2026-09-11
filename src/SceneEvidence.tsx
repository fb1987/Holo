import { useEffect, useState } from "react";
import { ArrowRight, Code2, Compass, ExternalLink } from "lucide-react";
import type { Artifact, Project, Station } from "../shared/types";
import { api } from "./api";
interface Chain {
  id: string;
  input: string;
  controller: string;
  behavior: string;
  output: string;
  consumer: string;
}
export function SceneEvidence({
  project,
  station,
  onOpen,
}: {
  project: Project;
  station: Station;
  onOpen: (artifact?: Artifact) => void;
}) {
  const [chains, setChains] = useState<Chain[]>([]),
    [code, setCode] = useState("");
  const contract = project.artifacts.find(
    (a) =>
      a.name === "behavior-contract.json" ||
      a.path.endsWith("/behavior-contract.json"),
  );
  const codeFile = project.artifacts
    .filter((a) => a.domain === "software" && a.kind === "code")
    .at(-1);
  useEffect(() => {
    let active = true;
    setChains([]);
    if (contract)
      fetch(api.fileUrl(project.id, contract.path))
        .then((r) => r.json())
        .then((data) => {
          if (active && Array.isArray(data.chains)) setChains(data.chains);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [project.id, contract?.path]);
  useEffect(() => {
    let active = true;
    setCode("");
    if (codeFile)
      fetch(api.fileUrl(project.id, codeFile.path))
        .then((r) => r.text())
        .then((text) => {
          if (active) setCode(text.split("\n").slice(0, 9).join("\n"));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [project.id, codeFile?.path]);
  if (station === "planning" && project.goals.length)
    return (
      <div className="intent-evidence" aria-label="Project intent">
        <span className="evidence-stem" />
        <span className="eyebrow">
          <Compass size={11} />
          THE INTENTION
        </span>
        <p>{project.goals[0]}</p>
        <button onClick={() => onOpen()}>
          See the thinking <ArrowRight size={12} />
        </button>
      </div>
    );
  if (station !== "software") return null;
  const chain = chains[0];
  return (
    <div className="logic-evidence">
      <div className="logic-heading">
        <span className="eyebrow">
          <Code2 size={12} />
          {chain
            ? "EXAMPLE BEHAVIOUR · PROPOSED"
            : codeFile
              ? "GENERATED SOFTWARE"
              : "BEHAVIOUR, WAITING TO BE DEFINED"}
        </span>
        <button onClick={() => onOpen(codeFile)}>
          Open the work <ExternalLink size={12} />
        </button>
      </div>
      {chain ? (
        <>
          <h3>From a physical gesture to a digital action.</h3>
          <div className="behavior-chain">
            {[
              chain.input,
              chain.controller,
              chain.behavior,
              chain.output,
              chain.consumer,
            ].map((step, i) => (
              <div className="behavior-step" key={i}>
                <span className="behavior-node" />
                <small>
                  {
                    [
                      "INPUT",
                      "HARDWARE",
                      "FIRMWARE",
                      "INTERFACE",
                      "EXPERIENCE",
                    ][i]
                  }
                </small>
                <strong>{step}</strong>
                {i < 4 && <ArrowRight size={12} />}
              </div>
            ))}
          </div>
          <p className="logic-footnote">
            An example contract. The board, firmware, and application still need
            to be connected and tested.
          </p>
        </>
      ) : codeFile ? (
        <>
          <h3>{codeFile.name}</h3>
          <pre>
            <code>{code}</code>
          </pre>
        </>
      ) : (
        <>
          <h3>What should happen when you interact with it?</h3>
          <p className="logic-empty">
            Describe a behaviour below. Your software specialist will develop
            the logic alongside the physical design.
          </p>
          <div className="empty-chain">
            <span>Input</span>
            <ArrowRight size={14} />
            <span>Behaviour</span>
            <ArrowRight size={14} />
            <span>Response</span>
          </div>
        </>
      )}
    </div>
  );
}
