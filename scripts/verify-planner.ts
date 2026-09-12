/** One opt-in live Codex acceptance request, using an isolated project. */
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStudioServer } from "../server/index.js";
if (process.env.HOLO_LIVE_ACCEPTANCE !== "1")
  throw new Error(
    "Set HOLO_LIVE_ACCEPTANCE=1 to authorize the live model call.",
  );
const root = await mkdtemp(path.join(os.tmpdir(), "holo-planner-acceptance-"));
const studio = await createStudioServer({ dataDir: root });
try {
  const project = await studio.store.create({
    name: "Phase2 acceptance · soccer ball",
  });
  console.log(JSON.stringify({ dataDir: root, projectId: project.id }));
  await studio.engine.enqueue(project.id, {
    text: "Create a classic black and white soccer ball, 220 mm in diameter, with 12 pentagons and 20 hexagons and visible recessed seams. No valve. I want the actual 3D model and editable/rebuildable sources. No electronics, software or renders are needed.",
    station: "planning",
    effort: "low",
  });
  const start = performance.now();
  let last = "";
  while (studio.engine.isBusy(project.id)) {
    const p = studio.store.get(project.id),
      state = JSON.stringify(
        p.changes
          .at(-1)
          ?.runs?.map((r) => ({
            station: r.station,
            kind: r.kind,
            model: r.model,
            effort: r.effort,
            status: r.status,
          })),
      );
    if (state !== last) {
      console.log(state);
      last = state;
    }
    if (performance.now() - start > 240000) {
      await studio.engine.cancel(project.id);
      throw new Error("Live acceptance exceeded four minutes.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const p = studio.store.get(project.id);
  const report = {
    elapsedMs: Math.round(performance.now() - start),
    outcome: p.changes.at(-1)?.outcome,
    recipe: p.acceptedDesign?.spec.recipe,
    runs: p.changes.at(-1)?.runs,
    error: p.changes.at(-1)?.error,
  };
  await writeFile(
    path.join(root, "acceptance.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (report.outcome !== "succeeded" || report.recipe !== "paneled-ball")
    throw new Error(
      "The live planner did not produce a successful deterministic ball.",
    );
} finally {
  await studio.close();
}
