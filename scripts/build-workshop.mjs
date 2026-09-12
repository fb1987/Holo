import { build } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
await build({
  entryPoints: ["server/build/worker.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist-server/build-worker.js",
});
await build({
  entryPoints: ["recipes/rebuild.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist-server/recipes/rebuild.mjs",
});
for (const directory of ["recipes", "shared", "server/build"]) {
  for (const name of await fs.readdir(directory))
    if (
      name.endsWith(".ts") ||
      name.endsWith(".py") ||
      name.endsWith(".lock")
    ) {
      if (
        directory === "server/build" &&
        !["gltf.ts", "validate.ts"].includes(name)
      )
        continue;
      if (directory === "shared" && name !== "design.ts") continue;
      const output = path.join("dist-server/recipes/source", directory, name);
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.copyFile(path.join(directory, name), output);
    }
}
for (const name of [
  "cad_worker.py",
  "render_worker.py",
  "cad-requirements.lock",
  "render-requirements.lock",
])
  await fs.copyFile(
    path.join("recipes", name),
    path.join("dist-server/recipes", name),
  );
for (const name of [
  "package.json",
  "package-lock.json",
  "REBUILD.md",
  "THIRD-PARTY.md",
])
  await fs.copyFile(
    path.join("recipes/package", name),
    path.join("dist-server/recipes", name),
  );
