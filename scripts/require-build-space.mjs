import { statfs } from "node:fs/promises";

// Electron packaging temporarily holds both unpacked and archived app copies.
const { bavail, bsize } = await statfs(new URL("../", import.meta.url));
const available = bavail * bsize;
const required = 2 * 1024 ** 3;
if (available < required) {
  console.error(`Holo packaging needs at least 2 GiB of free working space; ${(available / 1024 ** 3).toFixed(2)} GiB is available. Free space before retrying. Packaging has not started.`);
  process.exitCode = 1;
}
