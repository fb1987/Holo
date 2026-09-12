import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { recipeSourceDirectory } from "./adapters.js";
export interface RecipePackage {
  format: "holo-recipe-package";
  version: 1;
  files: { name: string; base64: string }[];
}
export async function readRecipePackage(): Promise<RecipePackage> {
  let base = recipeSourceDirectory();
  if (!existsSync(path.join(base, "rebuild.mjs")))
    base = path.resolve(base, "../dist-server/recipes");
  const files: RecipePackage["files"] = [];
  const walk = async (directory: string, prefix: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error("Recipe package must not contain symlinks.");
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "source" || prefix.startsWith("source"))
          await walk(path.join(directory, entry.name), name);
      } else if (/\.(?:mjs|ts|py|json|lock|md)$/.test(entry.name))
        files.push({
          name,
          base64: (
            await fs.readFile(path.join(directory, entry.name))
          ).toString("base64"),
        });
    }
  };
  await walk(base, "");
  return { format: "holo-recipe-package", version: 1, files };
}
export function unpackRecipePackage(value: unknown) {
  const bundle = value as RecipePackage;
  if (
    bundle?.format !== "holo-recipe-package" ||
    bundle.version !== 1 ||
    !Array.isArray(bundle.files) ||
    bundle.files.length > 100
  )
    throw new Error("Invalid saved recipe package.");
  let total = 0;
  const names = new Set<string>();
  return bundle.files.map((file) => {
    if (
      typeof file.name !== "string" ||
      !/^[a-zA-Z0-9_./-]+$/.test(file.name) ||
      file.name.startsWith("/") ||
      file.name
        .split("/")
        .some((part) => part === ".." || part === "." || !part) ||
      names.has(file.name) ||
      typeof file.base64 !== "string"
    )
      throw new Error("Invalid recipe package entry.");
    names.add(file.name);
    const data = Buffer.from(file.base64, "base64");
    total += data.length;
    if (total > 4 * 1024 * 1024)
      throw new Error("Recipe package exceeds 4 MiB.");
    return { name: `workshop/${file.name}`, data };
  });
}
