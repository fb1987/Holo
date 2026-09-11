import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const children = [];
function run(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) stop(code);
  });
  return child;
}
function stop(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
run("node", ["node_modules/tsx/dist/cli.mjs", "watch", "server/index.ts"]);
run("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"]);
let ready = false;
for (let i = 0; i < 100; i++) {
  try {
    const a = await fetch("http://127.0.0.1:4317");
    const b = await fetch("http://127.0.0.1:4318/api/runtime");
    if (a.ok && b.ok) {
      ready = true;
      break;
    }
  } catch {}
  await delay(200);
}
if (!ready) {
  console.error("The Holo workshop did not become ready.");
  stop(1);
}
if (!process.argv.includes("--web")) {
  const child = run("node_modules/.bin/electron", ["."], {
    HOLO_DEV_URL: "http://127.0.0.1:4317",
  });
  child.on("exit", () => stop());
}
