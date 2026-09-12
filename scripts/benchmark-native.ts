import { BuildBroker } from "../server/build/broker.js";
import { NativeAdapters } from "../server/build/adapters.js";
import { normalizeDesign } from "../shared/design.js";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "holo-native-benchmark-"));
await fs.symlink(
  path.join(os.homedir(), "Library/Application Support/Holo/runtimes"),
  path.join(root, "runtimes"),
);
const broker = new BuildBroker(root),
  adapters = new NativeAdapters(root);
console.log(root);
for (const recipe of [
  "container",
  "enclosure",
  "cradle",
  "paneled-ball",
] as const) {
  const started = performance.now();
  try {
    const result = await broker.build(
      normalizeDesign({
        recipe,
        version: "1.0.0",
        parameters: [],
        bodyColor: "#ffffff",
        accentColor: "#111111",
        outputs: ["glb"],
      }),
      "refined",
      new AbortController().signal,
    );
    const files = await adapters.run(
      recipe === "paneled-ball" ? "render" : "cad",
      result,
      new AbortController().signal,
      true,
    );
    const out = path.join(root, recipe);
    await fs.mkdir(out);
    for (const file of files)
      await fs.writeFile(path.join(out, file.name), file.data);
    console.log(
      recipe,
      Math.round(performance.now() - started),
      files.map((f) => `${f.name}:${f.data.length}`),
    );
  } catch (error) {
    console.error(recipe, String(error));
    process.exitCode = 1;
  }
}
