import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StudioError } from "./store.js";

function alive(pid: number) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
/** One local service may own a project directory at a time. */
export async function acquireDataLock(dataDir: string) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, ".workshop.lock"),
    token = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await fs.open(file, "wx", 0o600);
      try {
        await handle.writeFile(
          JSON.stringify({
            pid: process.pid,
            token,
            startedAt: new Date().toISOString(),
          }),
        );
      } finally {
        await handle.close();
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        try {
          const owner = JSON.parse(await fs.readFile(file, "utf8"));
          if (owner.token === token) await fs.unlink(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let owner: { pid?: number; token?: string } | undefined;
      const before = await fs.stat(file).catch(() => undefined);
      if (!before) continue;
      try {
        owner = JSON.parse(await fs.readFile(file, "utf8"));
      } catch {}
      if (owner?.pid && alive(owner.pid))
        throw new StudioError(
          "Another Holo service is already using this project directory. Close it before starting another session.",
          409,
        );
      // A file can briefly be empty while another service writes its owner.
      if (!owner && Date.now() - before.mtimeMs < 5000)
        throw new StudioError(
          "Another Holo service is starting with this project directory. Try again shortly.",
          409,
        );
      const current = await fs.stat(file).catch(() => undefined);
      if (
        !current ||
        current.ino !== before.ino ||
        current.mtimeMs !== before.mtimeMs
      )
        continue;
      await fs.unlink(file).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
  }
  throw new StudioError(
    "The project directory could not be locked. Another Holo service may be starting.",
    409,
  );
}
