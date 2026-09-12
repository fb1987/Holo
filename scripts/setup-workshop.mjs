import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const root =
  process.env.HOLO_DATA_DIR ||
  path.join(os.homedir(), "Library/Application Support/Holo");
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["cad", "render"];
for (const target of targets) {
  if (!["cad", "render"].includes(target))
    throw new Error("Choose cad and/or render.");
  const directory = path.join(
    root,
    "runtimes",
    target === "cad" ? "cadquery-2.6.1" : "blender-5.2.1",
  );
  const run = (args) => {
    const result = spawnSync("uv", args, { stdio: "inherit" });
    if (result.status !== 0)
      throw new Error(result.error?.message || "Runtime setup failed.");
  };
  run([
    "venv",
    "--allow-existing",
    "--python",
    target === "cad" ? "3.12" : "3.13",
    directory,
  ]);
  run([
    "pip",
    "sync",
    "--python",
    path.join(directory, "bin/python"),
    path.resolve("recipes", `${target}-requirements.lock`),
  ]);
}
console.log(
  "Runtimes installed. Use Settings → Test workshop to verify the production path.",
);
