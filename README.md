# Holo

**One idea. Every perspective. A path to making it real.**

Holo is a local invention studio for macOS. Describe something you might build, then move around it through **Plan, Design, Electronics, and Software**. The object stays in the spotlight. The specialists work from one versioned intent, with their own persistent Codex conversations and workspaces.

This is an early, usable application. It includes a procedural flame, interactive 3D reference devices, real Codex orchestration, generated-file inspection, and build-package exports. Examples and generated engineering are clearly distinguished.

## Start using it

The packaged Apple silicon app runs without Node.js. Download it from [Releases](https://github.com/fb1987/Holo/releases), unzip, and move Holo to Applications. It is an ad-hoc signed developer preview, without Apple notarization.

To run from source: macOS, Node.js 22 or newer, and a signed-in [Codex installation](https://learn.chatgpt.com/docs/quickstart) for agent work. The studio and examples work without a model connection. Model usage follows your Codex account or API billing; nothing starts generating until you send a request.

```sh
git clone https://github.com/fb1987/Holo.git
cd Holo
npm install
npm run dev
```

`npm run dev` opens the Mac app and its local workshop. Development uses `~/Library/Application Support/Holo Development` so it can run alongside the installed app without sharing project writes. For a browser-only development session:

```sh
node scripts/dev.mjs --web
```

Then open `http://127.0.0.1:4317`. The backend listens only on loopback.

If your npm version requires approval of dependency installation scripts, approve the known Electron and esbuild installation scripts according to the npm prompt. Holo does not require global npm packages.

## Your first session

1. Open the **Holo project menu** at the top left of the studio to begin a new idea or choose a wheel/enclosure example. These are explicitly conceptual examples with proposed components and example behavior source.
2. Open the perspective control at the right of the prompt, or use keys **1–4**, to visit the four perspectives. Drag to orbit, scroll to zoom, right-drag to pan. Press **R** to reset the view.
3. Open **Intent & decisions** to name the idea and choose DIY, some assembly, or finished supplier assembly.
4. Open **Settings → Connect Codex** from the separate **Studio options** button beside the perspective chooser. Holo discovers your installed Codex and account. Select the available model and thinking depth you want.
5. Describe a change and press **⌘ Enter** or the arrow. For example: “Design a small USB desk controller with two buttons. I want to assemble it without soldering. Create an editable enclosure model and explain what still needs engineering review.”
6. Inspect the ongoing work or stop it from the prompt. The strategist routes the request, specialists produce their artifacts, and recommendations return to the strategist for a bounded correction round.
7. Open **Build package** to export the intent, BOM, available artifacts, assembly and supplier briefs, and a revision manifest with file hashes.

Prompt drafts are saved separately for each idea. The selected idea, drafts, model, thinking depth, and motion preference are also saved in the local workshop, so they survive native app restarts. Closing a panel never discards a draft. Requests that need extra tool permissions appear as explicit action approvals.

The cockpit is a single compact row. The perspective chooser only switches workstations. Its adjacent Studio options button contains model/part selection, Activity, project files, history, export, and settings. Activity is an optional right-side panel that remains open while sending prompts and switching perspectives. Generated designs open on their designated assembly; individual models and printable parts can be selected deliberately. Files separates each perspective’s current deliverables from history, and exports include a current-deliverables index. Existing projects are migrated without regenerating geometry.

## What is real today

- A full-screen Three.js stage with procedural plasma, camera transitions, selectable parts, explosion, conceptual board view, and GLB/STL viewing.
- Local projects with goals, constraints, decisions, revision history, and immutable artifact snapshots.
- Codex app-server authentication, live model discovery, automatic Astra/high planning and Luna execution at the selected depth, persistent specialist sessions, streamed activity, cancellation, and approvals. Explicit model selection overrides all four perspectives.
- Provisional, ephemeral Luna sketches for empty projects: a quick first silhouette during planning, then a refined concept during design. These never become saved CAD or exported deliverables. Measured example latencies and limits are in [the generation review](docs/generation-latency-review.md).
- Planner-first routing, domain ownership, stale-result rejection, and a bounded specialist recommendation cycle.
- Actual tool execution in specialist workspaces. Agents can write source, documents, meshes, and engineering files using available tools.
- Source inspection and software behavior evidence in the stage.
- Real ZIP build packages for DIY, mixed assembly, and supplier review.

## Engineering boundaries

The built-in wheel and enclosure are **conceptual reference geometry**. Their circuit boards and traces illustrate the electronics perspective; they are not fabricated PCB layouts. The example TypeScript models behavior, not flashable firmware.

Generated artifacts can be useful editable starting points, but model output does not prove electrical correctness, dimensional fit, manufacturability, component stock, or physical safety. The app preserves proposed/unverified status. Manufacturing-ready routing, supplier-confirmed quotes, actual purchasing, factory assembly, and physical validation are not automated in this release.

The interactive stage is not a full CAD or PCB editor. Agents work through underlying tools and files. GLB/STL artifacts can replace the concept in the spotlight; CAD, PCB, and other native files are downloadable for their native applications. Semantic highlighting applies to the built-in/declarative scene; an arbitrary imported mesh may not carry component identities.

## Local tools and data

Default project location:

```text
~/Library/Application Support/Holo/
  <project-id>/
    project.json
    revisions/
    workspace/
      specification.json
      planning/
      design/
      electronics/
      software/
```

Each specialist has domain instructions and an `artifacts/` directory. The workshop writes the canonical specification; agents return validated structured changes. A restarted app marks interrupted jobs clearly instead of silently retrying model work.

Install Blender, KiCad, or other tools you want the specialists to use. Holo detects standard application and command-line locations. A Python environment with the `bpy` package can also provide headless Blender. Configure its interpreter in `tools.json` beside the project directories:

```json
{ "blenderPython": "/absolute/path/to/your/python" }
```

The interpreter is checked by importing `bpy`, and the working path is given to specialists. Restart the workshop after changing tool configuration.

Environment overrides:

| Variable              | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `HOLO_CODEX_BIN`      | Explicit Codex executable                   |
| `HOLO_DATA_DIR`       | Project/config directory                    |
| `HOLO_BLENDER_PYTHON` | Python interpreter with `bpy`               |
| `HOLO_PORT`           | Backend port; `0` chooses an available port |
| `HOLO_STATIC_DIR`     | Built frontend directory                    |

Holo stores its own project memory. Signing in does not imply importing all of your ChatGPT conversations or memories. Credentials remain managed by Codex.

## Build a Mac application

```sh
npm run package:mac
```

Packaging checks for at least 2 GiB of free working space before starting because Electron needs temporary unpacked and archived copies.

The resulting `Holo.app` is under `release/`. It runs its own local Node workshop, so Node.js is not needed to launch that packaged app. Codex and engineering tools remain external dependencies. `npm run dist:mac` also produces a ZIP.

Local builds are not notarized for public distribution. Code signing/notarization needs a distributor's Apple credentials; the project does not ship credentials or disable Gatekeeper.

## Develop and verify

```sh
npm run check
npm test
npm run build
```

A ready-to-enable GitHub Actions configuration is in `docs/ci-workflow.example.yml`. Copy it to `.github/workflows/verify.yml` using a GitHub login with workflow permission to enable remote checks.

The tests cover storage, planner routing, domain authority, recommendation bounds, cancellation, output rollback, file isolation, exports, and Codex protocol handling. Independent visual and UX reviews are recorded in `docs/` alongside the implementation notes.

The UI is React + React Three Fiber. Electron hosts it. An Express service orchestrates Codex and manages files. Renderer content has no Node integration; the local API rejects foreign origins and exposes registered artifact snapshots rather than arbitrary filesystem access.

## Direction

Holo starts with small electronic inventions and custom enclosures. The long-term direction is deeper parametric CAD/PCB integration, validated component libraries, supplier catalogues and quoting, and optional remote compute. The central rule stays the same: **the idea remains in place; the user changes perspective.**

MIT licensed. Contributions should preserve that experience and be explicit about the difference between concepts, generated outputs, and verified engineering.
